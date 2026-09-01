#!/usr/bin/env bash
# Inventario de LLMs locales · SOLO LECTURA
#
# No instala, no borra, no para ni levanta nada. Solo mira y reporta.
#
# Uso, parado en el servidor:
#   bash inventario-llm.sh
#
# O desde tu Ubuntu, sin copiar el archivo:
#   ssh usuario@servidor 'bash -s' < inventario-llm.sh
#
# Con sudo muestra de qué proceso es cada puerto; sin sudo igual funciona,
# solo que algunos puertos salen sin nombre de proceso.

set -u

if [ -t 1 ]; then
  N=$'\033[0m'; B=$'\033[1m'; V=$'\033[32m'; R=$'\033[31m'; A=$'\033[33m'; G=$'\033[90m'
else
  N=""; B=""; V=""; R=""; A=""; G=""
fi

titulo() { printf '\n%s── %s ──%s\n' "$B" "$1" "$N"; }
ok()     { printf '  %s✓%s %s\n' "$V" "$N" "$1"; }
no()     { printf '  %s·%s %s\n' "$G" "$N" "$1"; }
ojo()    { printf '  %s!%s %s\n' "$A" "$N" "$1"; }
dato()   { printf '    %s\n' "$1"; }

hay() { command -v "$1" >/dev/null 2>&1; }

# curl sin proxy y con timeout corto: si el servicio no está, no queremos esperar
pedir() { curl -s --noproxy '*' --max-time 3 "$1" 2>/dev/null; }

printf '\n%s Inventario de LLMs locales %s\n' "$B" "$N"
printf ' %s · %s\n' "$(hostname 2>/dev/null || echo '?')" "$(date '+%Y-%m-%d %H:%M')"

# ─────────────────────────────────────────────────────────────
titulo "La máquina"

if [ -r /etc/os-release ]; then
  dato "$(. /etc/os-release; echo "${PRETTY_NAME:-$NAME}")"
fi
dato "kernel $(uname -r)  ·  $(uname -m)"

if [ -r /proc/cpuinfo ]; then
  nucleos=$(grep -c '^processor' /proc/cpuinfo 2>/dev/null || echo '?')
  modelo=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^ *//')
  dato "${nucleos} núcleos${modelo:+  ·  $modelo}"
fi
if hay free; then
  dato "RAM: $(free -h | awk '/^Mem:/{print $3" usados de "$2"  ·  "$7" disponibles"}')"
fi

# ─────────────────────────────────────────────────────────────
titulo "GPU"

if hay nvidia-smi; then
  nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu \
             --format=csv,noheader 2>/dev/null | while IFS= read -r linea; do
    ok "$linea"
  done
  procs=$(nvidia-smi --query-compute-apps=pid,used_memory,process_name \
                     --format=csv,noheader 2>/dev/null)
  if [ -n "$procs" ]; then
    printf '\n  %sProcesos usando la GPU ahora:%s\n' "$B" "$N"
    printf '%s\n' "$procs" | while IFS= read -r linea; do dato "$linea"; done
  else
    no "ningún proceso está usando la GPU en este momento"
  fi
elif hay rocm-smi; then
  ok "GPU AMD (ROCm)"
  rocm-smi --showproductname 2>/dev/null | sed 's/^/    /'
else
  no "sin nvidia-smi ni rocm-smi · o no hay GPU, o corre todo en CPU"
fi

# ─────────────────────────────────────────────────────────────
titulo "Ollama"

ollama_visto=0

if hay ollama; then
  ollama_visto=1
  ok "binario instalado · $(command -v ollama)"
  v=$(ollama --version 2>/dev/null | head -1); [ -n "$v" ] && dato "$v"
fi

if hay systemctl; then
  estado=$(systemctl is-active ollama 2>/dev/null)
  case "$estado" in
    active)   ollama_visto=1; ok "servicio systemd: activo" ;;
    inactive) no "servicio systemd: parado" ;;
    failed)   ojo "servicio systemd: falló" ;;
  esac
fi

tags=$(pedir http://127.0.0.1:11434/api/tags)
if [ -n "$tags" ]; then
  ollama_visto=1
  ok "API respondiendo en 127.0.0.1:11434"

  printf '\n  %sModelos descargados:%s\n' "$B" "$N"
  if hay jq; then
    printf '%s' "$tags" | jq -r '
      .models[]? |
      "    \(.name)  ·  \((.size/1073741824*10|round)/10) GB  ·  \(.details.parameter_size // "?")  \(.details.quantization_level // "")"
    ' 2>/dev/null
  elif hay python3; then
    printf '%s' "$tags" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for m in d.get("models", []):
    det = m.get("details") or {}
    gb = m.get("size", 0) / 1073741824
    print("    %s  ·  %.1f GB  ·  %s %s" % (
        m.get("name", "?"), gb,
        det.get("parameter_size", "?"), det.get("quantization_level", "")))
' 2>/dev/null
  else
    printf '%s' "$tags" | tr ',' '\n' | grep '"name"' | sed 's/.*"name":"\([^"]*\)".*/    \1/'
  fi

  # Qué está cargado en memoria en este preciso momento
  cargados=$(pedir http://127.0.0.1:11434/api/ps)
  if [ -n "$cargados" ]; then
    printf '\n  %sCargados en memoria ahora:%s\n' "$B" "$N"
    if hay python3; then
      printf '%s' "$cargados" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ms = d.get("models", [])
if not ms:
    print("    (ninguno · se cargan al primer pedido)")
for m in ms:
    gb = m.get("size", 0) / 1073741824
    print("    %s  ·  %.1f GB  ·  hasta %s" % (
        m.get("name", "?"), gb, m.get("expires_at", "?")[:19]))
' 2>/dev/null
    else
      dato "$cargados"
    fi
  fi
elif [ "$ollama_visto" = 1 ]; then
  ojo "instalado pero la API no responde en 11434 · el servicio está caído"
else
  no "no encontrado"
fi

# ─────────────────────────────────────────────────────────────
titulo "Otros motores de inferencia"

# nombre visible | binario | puerto típico | ruta de la API para probar
otros="\
LM Studio|lms|1234|/v1/models
vLLM|vllm|8000|/v1/models
LocalAI|local-ai|8080|/v1/models
llama.cpp (servidor)|llama-server|8080|/v1/models
llamafile|llamafile||
GPT4All|gpt4all||
SGLang|sglang|30000|/v1/models
Text Generation WebUI|text-generation-webui|7860|
Jan||1337|/v1/models
Open WebUI (interfaz)||3000|
Open WebUI (interfaz)||8080|"

hallazgos=$(printf '%s\n' "$otros" | while IFS='|' read -r nombre bin puerto ruta; do
  visto=""
  if [ -n "$bin" ] && hay "$bin"; then
    visto="binario en $(command -v "$bin")"
  fi
  if [ -n "$puerto" ] && [ -n "$ruta" ]; then
    if [ -n "$(pedir "http://127.0.0.1:${puerto}${ruta}")" ]; then
      visto="${visto:+$visto · }API viva en :$puerto"
    fi
  fi
  [ -n "$visto" ] && printf '%s · %s\n' "$nombre" "$visto"
done)

if [ -n "$hallazgos" ]; then
  printf '%s\n' "$hallazgos" | while IFS= read -r l; do ok "$l"; done
else
  no "ninguno de los motores conocidos está instalado ni respondiendo"
fi

# Procesos con pinta de inferencia, por si corre algo con otro nombre
if hay pgrep; then
  sospechosos=$(pgrep -af 'llama|vllm|sglang|text-generation|localai|koboldcpp|exllama|tabbyapi|lmstudio|ollama' 2>/dev/null \
                 | grep -v 'inventario-llm' | head -15)
  if [ -n "$sospechosos" ]; then
    printf '\n  %sProcesos que parecen de inferencia:%s\n' "$B" "$N"
    printf '%s\n' "$sospechosos" | cut -c1-150 | sed 's/^/    /'
  fi
fi

# ─────────────────────────────────────────────────────────────
titulo "Puertos a la escucha"

if hay ss; then
  escuchando=$(ss -tlnp 2>/dev/null || ss -tln 2>/dev/null)
elif hay netstat; then
  escuchando=$(netstat -tlnp 2>/dev/null || netstat -tln 2>/dev/null)
else
  escuchando=""
fi

if [ -n "$escuchando" ]; then
  interesantes=$(printf '%s\n' "$escuchando" \
    | grep -E ':(11434|1234|8000|8080|8081|5000|7860|1337|3000|30000|9997|11435)\b' | head -20)
  if [ -n "$interesantes" ]; then
    printf '%s\n' "$interesantes" | sed 's/^/    /'
    printf '\n'
    # Un puerto abierto en 0.0.0.0 lo ve toda la red, no solo esta máquina
    abiertos=$(printf '%s\n' "$interesantes" \
      | awk '{print $4}' | grep -E '^(0\.0\.0\.0|\[::\]|\*):')
    if [ -n "$abiertos" ]; then
      ojo "escuchando en todas las interfaces · los alcanza cualquiera que llegue a esta máquina:"
      printf '%s\n' "$abiertos" | sed 's/^/      /'
    else
      ok "todo escucha solo en localhost · nada expuesto a la red"
    fi
  else
    no "ningún puerto típico de LLM está escuchando"
  fi
  [ "$(id -u)" != "0" ] && dato "${G}(sin sudo no se ve de qué proceso es cada puerto)${N}"
else
  no "no hay ss ni netstat para revisar puertos"
fi

# ─────────────────────────────────────────────────────────────
titulo "Contenedores Docker"

if hay docker && docker info >/dev/null 2>&1; then
  llm_cont=$(docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null \
    | grep -iE 'ollama|vllm|llama|localai|lmstudio|text-gen|open-webui|openwebui|anythingllm|jan|sglang|tgi|huggingface|litellm')
  if [ -n "$llm_cont" ]; then
    printf '%s\n' "$llm_cont" | sed 's/^/    /'
    printf '\n'
    # Si un Ollama vive adentro de un contenedor, sus modelos no salen en el ollama de arriba
    for c in $(docker ps --format '{{.Names}}' 2>/dev/null | grep -i ollama); do
      lista=$(docker exec "$c" ollama list 2>/dev/null)
      if [ -n "$lista" ]; then
        printf '  %sModelos dentro del contenedor %s:%s\n' "$B" "$c" "$N"
        printf '%s\n' "$lista" | sed 's/^/    /'
      fi
    done
  else
    total=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
    no "${total} contenedores corriendo, ninguno parece de LLM"
  fi
elif hay docker; then
  no "docker instalado pero el daemon no responde para este usuario"
else
  no "sin docker"
fi

# ─────────────────────────────────────────────────────────────
titulo "Modelos en disco"

hubo_modelos=0
for d in "$HOME/.ollama/models" \
         "/usr/share/ollama/.ollama/models" \
         "/var/lib/ollama/models" \
         "$HOME/.cache/huggingface/hub" \
         "$HOME/.cache/lm-studio/models" \
         "$HOME/.local/share/nomic.ai/GPT4All" \
         "$HOME/models" "/opt/models" "/srv/models" "/data/models"; do
  if [ -d "$d" ]; then
    peso=$(du -sh "$d" 2>/dev/null | cut -f1)
    [ -n "$peso" ] && { ok "$peso  ·  $d"; hubo_modelos=1; }
  fi
done

# Archivos .gguf sueltos, acotado para que no barra el disco entero
sueltos=$(find "$HOME" -maxdepth 5 -name '*.gguf' -type f 2>/dev/null | head -10)
if [ -n "$sueltos" ]; then
  hubo_modelos=1
  printf '\n  %sArchivos .gguf sueltos:%s\n' "$B" "$N"
  printf '%s\n' "$sueltos" | while IFS= read -r f; do
    dato "$(du -h "$f" 2>/dev/null | cut -f1)  ·  $f"
  done
fi

[ "$hubo_modelos" = 0 ] && no "no se encontraron modelos en las rutas habituales"

printf '\n%s Fin del inventario · no se modificó nada %s\n\n' "$G" "$N"
