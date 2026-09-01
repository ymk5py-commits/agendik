#!/usr/bin/env bash
# Probar los LLM del servidor · manda una consigna y mide qué tan rápido responde
#
# Sin argumentos no genera nada: lista qué modelos hay y cuáles están cargados.
#
#   bash probar-llm.sh                        qué hay disponible
#   bash probar-llm.sh --modelo llama3.1:8b   probar uno
#   bash probar-llm.sh --todos                probar todos, uno por uno
#   bash probar-llm.sh --prompt "tu texto"    con tu propia consigna
#   bash probar-llm.sh --host 100.82.1.5      apuntar a otra máquina de la red
#   bash probar-llm.sh --puerto 11435         si Ollama no está en el puerto de siempre
#
# Para charlar de ida y vuelta, parado en el servidor, conviene:  ollama run <modelo>

set -u

if [ -t 1 ]; then
  N=$'\033[0m'; B=$'\033[1m'; V=$'\033[32m'; R=$'\033[31m'; A=$'\033[33m'; G=$'\033[90m'
else
  N=""; B=""; V=""; R=""; A=""; G=""
fi

titulo() { printf '\n%s── %s ──%s\n' "$B" "$1" "$N"; }
ok()     { printf '  %s✓%s %s\n' "$V" "$N" "$1"; }
bad()    { printf '  %s✗%s %s\n' "$R" "$N" "$1"; }
ojo()    { printf '  %s!%s %s\n' "$A" "$N" "$1"; }
no()     { printf '  %s·%s %s\n' "$G" "$N" "$1"; }

HOST="127.0.0.1"
PUERTO="11434"
MODELO=""
TODOS=0
ESPERA=300
PROMPT="Explicá en dos oraciones cortas qué es una base de datos relacional."

while [ $# -gt 0 ]; do
  case "$1" in
    --modelo)  MODELO="${2:-}"; shift 2 ;;
    --prompt)  PROMPT="${2:-}"; shift 2 ;;
    --host)    HOST="${2:-}";   shift 2 ;;
    --puerto)  PUERTO="${2:-}"; shift 2 ;;
    --espera)  ESPERA="${2:-}"; shift 2 ;;
    --todos)   TODOS=1; shift ;;
    -h|--help) awk 'NR>1 && !/^#/{exit} NR>1{sub(/^# ?/,""); print}' "$0"; exit 0 ;;
    *) bad "no entiendo '$1' · probá --help"; exit 1 ;;
  esac
done

API="http://${HOST}:${PUERTO}"

PY=""
for c in python3 python; do command -v "$c" >/dev/null 2>&1 && { PY="$c"; break; }; done
if [ -z "$PY" ]; then
  bad "hace falta python3 para armar y leer el JSON de la API"
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  bad "hace falta curl"
  exit 1
fi

# sin proxy: si el servidor tiene uno configurado, no queremos que se meta en medio
pedir() { curl -s --noproxy '*' --max-time 10 "$@" 2>/dev/null; }

printf '\n%s Probando los LLM de %s %s\n' "$B" "$API" "$N"

# ─────────────────────────────────────────────────────────────
titulo "Qué hay"

tags=$(pedir "$API/api/tags")
if [ -z "$tags" ]; then
  bad "la API no responde en $API"
  printf '\n  Cosas para revisar:\n'
  printf '    · ¿está corriendo?      systemctl status ollama\n'
  printf '    · ¿en qué puerto?       ss -tlnp | grep -E ":(11434|11435)"\n'
  printf '    · si apuntás a otra máquina, Ollama tiene que escuchar fuera de\n'
  printf '      localhost, y eso hay que abrirlo a propósito (OLLAMA_HOST).\n\n'
  exit 1
fi

modelos=$("$PY" -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)
for m in d.get("models", []):
    print(m.get("name", ""))
' <<< "$tags")

if [ -z "$modelos" ]; then
  ojo "la API responde pero no hay ningún modelo descargado"
  printf '    Para bajar uno:  ollama pull llama3.2:3b\n\n'
  exit 0
fi

cantidad=$(printf '%s\n' "$modelos" | wc -l | tr -d ' ')
ok "$cantidad modelos disponibles"
printf '%s\n' "$modelos" | sed 's/^/    · /'

cargados=$(pedir "$API/api/ps" | "$PY" -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for m in d.get("models", []):
    print(m.get("name", ""))
' 2>/dev/null)

if [ -n "$cargados" ]; then
  printf '\n'
  ok "ya cargados en memoria (responden al toque):"
  printf '%s\n' "$cargados" | sed 's/^/    · /'
else
  printf '\n'
  no "ninguno está cargado · el primero que pruebes va a tardar en arrancar"
fi

# ─────────────────────────────────────────────────────────────
probar_modelo() {
  m="$1"
  titulo "$m"

  # Armamos el JSON con python para que la consigna pueda tener comillas,
  # acentos o saltos de línea sin romper nada.
  cuerpo=$("$PY" -c '
import sys, json
print(json.dumps({"model": sys.argv[1], "prompt": sys.argv[2], "stream": False}))
' "$m" "$PROMPT")

  arranque=$(date +%s)
  respuesta=$(curl -s --noproxy '*' --max-time "$ESPERA" \
                   -X POST "$API/api/generate" \
                   -H 'Content-Type: application/json' \
                   -d "$cuerpo" 2>/dev/null)
  corte=$?
  transcurrido=$(( $(date +%s) - arranque ))

  if [ $corte -ne 0 ] || [ -z "$respuesta" ]; then
    bad "sin respuesta después de ${transcurrido}s"
    [ $corte -eq 28 ] && printf '    Se pasó del límite de %ss. Subilo con --espera 600.\n' "$ESPERA"
    return 1
  fi

  color=0; [ -t 1 ] && color=1
  "$PY" -c '
import sys, json, textwrap

color = sys.argv[1] == "1"
def c(codigo, t):
    return "\033[%sm%s\033[0m" % (codigo, t) if color else t

try:
    d = json.loads(sys.stdin.read())
except Exception:
    print("  respuesta ilegible de la API"); sys.exit(1)

if "error" in d:
    print("  error de la API: %s" % d["error"]); sys.exit(1)

seg = lambda ns: (ns or 0) / 1e9

carga = seg(d.get("load_duration"))
p_tok = d.get("prompt_eval_count") or 0
p_seg = seg(d.get("prompt_eval_duration"))
g_tok = d.get("eval_count") or 0
g_seg = seg(d.get("eval_duration"))
total = seg(d.get("total_duration"))

print()
print("  " + c("1", "La respuesta"))
texto = (d.get("response") or "").strip()
if not texto:
    print("    (vacía)")
for parrafo in texto.splitlines():
    # textwrap corta entre palabras; partir por cantidad de caracteres
    # dejaba cosas como "colum / nas"
    if parrafo.strip():
        print(textwrap.fill(parrafo, width=78,
                            initial_indent="    ", subsequent_indent="    "))
    else:
        print()

print()
print("  " + c("1", "Los números"))
if carga > 0.05:
    print("    cargar el modelo   %6.1f s   %s" % (carga, c("90", "(solo la primera vez)")))
print("    leer la consigna   %6.1f s   %d tokens" % (p_seg, p_tok))
print("    generar            %6.1f s   %d tokens" % (g_seg, g_tok))
if g_seg > 0:
    vel = g_tok / g_seg
    print("    velocidad          %6.1f tokens/s" % vel)
    if vel < 5:
        print("    %s lento · a esta velocidad seguramente corre en CPU, no en GPU"
              % c("33", "!"))
print("    total              %6.1f s" % total)
' "$color" <<< "$respuesta"
}

# ─────────────────────────────────────────────────────────────
if [ -n "$MODELO" ]; then
  if ! printf '%s\n' "$modelos" | grep -qxF "$MODELO"; then
    printf '\n'
    bad "'$MODELO' no está en la lista de arriba"
    printf '    Ojo que el nombre lleva la etiqueta: llama3.1%s8b, no llama3.1\n\n' ":"
    exit 1
  fi
  probar_modelo "$MODELO"

elif [ "$TODOS" = 1 ]; then
  printf '\n'
  # Cada modelo que se prueba se carga en memoria y desaloja al anterior. En un
  # servidor compartido eso se le nota a quien lo esté usando en ese momento.
  ojo "van a cargarse $cantidad modelos, uno por uno · si alguien más está usando"
  printf '    el servidor, lo va a sentir. Ctrl-C ahora si no es buen momento.\n'
  printf '%s\n' "$modelos" | while IFS= read -r m; do
    [ -n "$m" ] && probar_modelo "$m"
  done

else
  printf '\n%s Para probar uno:%s\n' "$B" "$N"
  primero=$(printf '%s\n' "$modelos" | head -1)
  printf '    bash %s --modelo %s\n' "$(basename "$0")" "$primero"
  printf '\n  Con tu propia consigna:\n'
  printf '    bash %s --modelo %s --prompt "tu pregunta"\n' "$(basename "$0")" "$primero"
  printf '\n  Todos de una:\n'
  printf '    bash %s --todos\n' "$(basename "$0")"
fi

printf '\n'
