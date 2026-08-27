#!/usr/bin/env bash
#
# Mac · ver qué ocupa el disco, y sacar lo que no se usa
#
# Sin argumentos NO borra nada: solo mide y muestra. Empezá por ahí, porque
# lo que uno cree que ocupa y lo que ocupa de verdad casi nunca coinciden.
#
#   bash liberar-espacio.sh
#
# Después, con los números a la vista, una cosa por vez:
#
#   bash liberar-espacio.sh --ollama      modelos de Ollama + la app
#   bash liberar-espacio.sh --docker      Docker Desktop + su disco virtual
#   bash liberar-espacio.sh --caches      cachés de npm, Homebrew, Xcode
#   bash liberar-espacio.sh --snapshots   snapshots locales de Time Machine
#
# Cada uno pregunta antes de borrar; con -y no pregunta.
#
set -uo pipefail

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }

SI_A_TODO=0
# Varias acciones en una corrida. Con una sola variable, `--ollama --caches`
# se quedaba con la última y corría media cosa sin decir nada.
ACCIONES=()
for arg in "$@"; do
  case "$arg" in
    -y|--si)      SI_A_TODO=1 ;;
    --ollama|--docker|--caches|--snapshots) ACCIONES+=("$arg") ;;
    # Un rango fijo de líneas se desfasa en cuanto alguien edita la cabecera
    # y termina imprimiendo el `set -uo pipefail`: cortar en el primer renglón
    # que ya no es comentario.
    -h|--help)    awk 'NR>1 && !/^#/{exit} NR>1{sub(/^# ?/,""); print}' "$0"; exit 0 ;;
    *)            echo "Opción desconocida: $arg"; echo "Probá: bash $0 --help"; exit 1 ;;
  esac
done

confirmar() {
  [ "$SI_A_TODO" = 1 ] && return 0
  printf '\n  \033[1m%s\033[0m [s/N] ' "$1"
  # Sin terminal (por ejemplo si esto viajó por una tubería) read falla y r
  # queda sin definir: default a vacío, que cae en "no". Nunca borrar por
  # no haber podido preguntar.
  { read -r r </dev/tty; } 2>/dev/null || r=""
  case "${r:-}" in [sSyY]*) return 0 ;; *) echo "  cancelado"; return 1 ;; esac
}

# du sobre una ruta que no existe es un error, no un cero: hay que preguntar
# antes, si no la salida se llena de líneas rojas que no significan nada.
tam() { [ -e "$1" ] || return 1; du -sh "$1" 2>/dev/null | awk '{print $1}'; }

# `rm -rf` sobre algo que no existe sale 0: sin este chequeo el script canta
# "✓ app borrada" de una app que nunca estuvo instalada.
sacar() { # sacar <ruta> <qué avisar si estaba>
  [ -e "$1" ] || return 0
  rm -rf "$1" 2>/dev/null && ok "$2" || bad "no pude borrar $1"
}

fila() { # fila <ruta> <qué es>
  local t
  t=$(tam "$1") || return 0
  printf '  \033[1m%-8s\033[0m %s\n' "$t" "$2"
  printf '           \033[90m%s\033[0m\n' "$1"
}

libre() {
  # df sobre APFS miente: cuenta como ocupado el espacio "purgable" que el
  # sistema libera solo cuando hace falta. diskutil dice el número real.
  diskutil info / 2>/dev/null \
    | awk -F: '/Container Free Space|Free Space/ {gsub(/^[ \t]+/,"",$2); print $2; exit}'
}

# =====================================================================
# Sin acción: medir y salir
# =====================================================================
if [ ${#ACCIONES[@]} -eq 0 ]; then
  say "Espacio libre ahora"
  l=$(libre); [ -n "$l" ] && ok "$l" || warn "no pude leerlo (¿no es macOS?)"

  say "Los grandes de siempre"
  fila "$HOME/.ollama"                              "Modelos de Ollama · cada uno pesa entre 2 y 40 GB"
  fila "/Applications/Ollama.app"                   "App de Ollama"
  fila "$HOME/Library/Containers/com.docker.docker" "Disco virtual de Docker · NO se achica solo al borrar contenedores"
  fila "/Applications/Docker.app"                   "App de Docker Desktop"
  fila "$HOME/Library/Developer/Xcode/DerivedData"  "Compilaciones viejas de Xcode · se regeneran solas"
  fila "$HOME/Library/Developer/CoreSimulator"      "Simuladores de iOS"
  fila "$HOME/Library/Caches/Homebrew"              "Descargas de Homebrew ya instaladas"
  fila "$HOME/.npm"                                 "Caché de npm · se regenera sola"
  fila "$HOME/Library/pnpm"                         "Store de pnpm"
  fila "$HOME/Library/Caches/Yarn"                  "Caché de Yarn"
  fila "$HOME/.Trash"                               "Papelera sin vaciar"
  fila "$HOME/Downloads"                            "Descargas"

  say "Snapshots locales de Time Machine"
  # Estos no aparecen en Finder y suelen ser el agujero negro que nadie mira:
  # copias que el sistema guarda en el propio disco entre backup y backup.
  if command -v tmutil >/dev/null 2>&1; then
    n=$(tmutil listlocalsnapshots / 2>/dev/null | grep -c 'com.apple.TimeMachine')
    if [ "${n:-0}" -gt 0 ]; then
      warn "$n snapshots ocupando disco sin aparecer en Finder"
      info "para sacarlos:  bash $0 --snapshots"
    else
      ok "ninguno"
    fi
  else
    warn "sin tmutil (¿no es macOS?)"
  fi

  say "¿Docker está corriendo algo?"
  # Antes de proponer desinstalarlo conviene mirar: el Supabase de este
  # proyecto vive adentro de Docker, y sus datos también.
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    c=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
    v=$(docker volume ls -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "${c:-0}" -gt 0 ]; then
      warn "$c contenedor(es) corriendo ahora:"
      docker ps --format '      {{.Names}}  ({{.Image}})' 2>/dev/null
    else
      ok "ningún contenedor corriendo"
    fi
    [ "${v:-0}" -gt 0 ] && warn "$v volúmenes con datos adentro — desinstalar Docker los borra"
  elif command -v docker >/dev/null 2>&1; then
    ok "Docker instalado pero apagado"
  else
    ok "Docker no está instalado"
  fi

  cat <<FIN

=====================================================================
Esto no borró nada. Con los números de arriba, elegí:

  bash $0 --ollama      los modelos son lo más pesado y se rebajan
  bash $0 --docker      OJO: se lleva puestos los datos de Supabase
  bash $0 --caches      lo más seguro: todo se regenera solo
  bash $0 --snapshots   invisible en Finder, suele liberar varios GB
=====================================================================
FIN
  exit 0
fi

# =====================================================================
ejecutar() {
case "$1" in

--ollama)
  say "Ollama"
  t=$(tam "$HOME/.ollama") && info "modelos: $t"
  if command -v ollama >/dev/null 2>&1; then
    info "modelos instalados:"; ollama list 2>/dev/null | sed 's/^/      /'
  fi
  confirmar "¿Borrar Ollama y TODOS sus modelos?" || exit 0

  pkill -x ollama 2>/dev/null && ok "proceso terminado"
  osascript -e 'quit app "Ollama"' 2>/dev/null

  # Puede haber venido por el .app, por Homebrew o por el script de install:
  # los tres dejan cosas en lugares distintos, así que van los tres.
  sacar "$HOME/.ollama"          "modelos borrados"
  sacar /Applications/Ollama.app "app borrada"
  sudo rm -f /usr/local/bin/ollama 2>/dev/null
  rm -f "$HOME"/Library/LaunchAgents/*ollama* 2>/dev/null
  if command -v brew >/dev/null 2>&1; then
    brew uninstall --cask ollama 2>/dev/null || brew uninstall ollama 2>/dev/null
  fi
  ok "listo · libre ahora: $(libre)"
  ;;

--docker)
  say "Docker Desktop"
  t=$(tam "$HOME/Library/Containers/com.docker.docker") && info "disco virtual: $t"

  # El aviso importante va antes de la pregunta, no después.
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    v=$(docker volume ls -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "${v:-0}" -gt 0 ]; then
      bad "hay $v volúmenes: son los DATOS de las bases que corrieron acá"
      info "Si el Supabase de AGENDAMIENTO vivía en este Docker, esto lo borra."
      info "Para guardarlo antes, en la carpeta del proyecto:"
      info "  npx supabase db dump --local -f respaldo.sql"
    fi
  fi
  confirmar "¿Desinstalar Docker Desktop y borrar sus datos?" || exit 0

  # El desinstalador propio limpia los symlinks de /usr/local/bin y el
  # privileged helper; a mano eso queda dando vueltas.
  if [ -x /Applications/Docker.app/Contents/MacOS/uninstall ]; then
    sudo /Applications/Docker.app/Contents/MacOS/uninstall && ok "desinstalador oficial corrido"
  fi
  osascript -e 'quit app "Docker"' 2>/dev/null
  sacar /Applications/Docker.app "app borrada"
  sacar "$HOME/Library/Containers/com.docker.docker" "disco virtual borrado"
  rm -rf "$HOME/Library/Group Containers/group.com.docker" \
         "$HOME/.docker" \
         "$HOME/Library/Application Support/Docker Desktop" \
         "$HOME/Library/Caches/com.docker.docker" 2>/dev/null
  rm -f "$HOME/Library/LaunchAgents/com.docker.helper.plist" 2>/dev/null
  ok "listo · libre ahora: $(libre)"
  ;;

--caches)
  say "Cachés (todo esto se regenera solo)"
  for p in "$HOME/.npm" "$HOME/Library/Caches/Homebrew" \
           "$HOME/Library/Developer/Xcode/DerivedData" "$HOME/Library/Caches/Yarn"; do
    t=$(tam "$p") && info "$t  $p"
  done
  confirmar "¿Vaciarlas?" || exit 0

  command -v npm  >/dev/null 2>&1 && { npm cache clean --force 2>/dev/null; ok "npm"; }
  command -v brew >/dev/null 2>&1 && { brew cleanup -s 2>/dev/null; rm -rf "$(brew --cache)" 2>/dev/null; ok "Homebrew"; }
  sacar "$HOME/Library/Developer/Xcode/DerivedData" "DerivedData"
  rm -rf "$HOME/Library/Caches/Yarn" 2>/dev/null
  command -v xcrun >/dev/null 2>&1 && { xcrun simctl delete unavailable 2>/dev/null; ok "simuladores muertos"; }
  ok "listo · libre ahora: $(libre)"
  ;;

--snapshots)
  say "Snapshots locales de Time Machine"
  command -v tmutil >/dev/null 2>&1 || { bad "no hay tmutil (¿no es macOS?)"; exit 1; }
  tmutil listlocalsnapshots / 2>/dev/null | sed 's/^/    /'
  info ""
  info "No son tu backup: el backup está en el disco externo. Estos son"
  info "copias que macOS deja en el disco interno entre respaldo y respaldo."
  confirmar "¿Borrarlos?" || exit 0

  sudo tmutil thinlocalsnapshots / 999999999999 4 && ok "borrados"
  ok "listo · libre ahora: $(libre)"
  ;;
esac
}

for a in "${ACCIONES[@]}"; do ejecutar "$a"; done
