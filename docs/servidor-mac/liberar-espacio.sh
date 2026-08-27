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
#   bash liberar-espacio.sh --docker-seguro  caché e imágenes de Docker,
#                                            SIN tocar los datos
#   bash liberar-espacio.sh --docker-respaldo  guardar los volúmenes en el
#                                              Escritorio antes de borrar
#   bash liberar-espacio.sh --docker      Docker Desktop entero + sus datos
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
    --ollama|--docker|--docker-seguro|--docker-respaldo|--caches|--snapshots) ACCIONES+=("$arg") ;;
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
  rm -rf "$1" 2>/dev/null
  # Las apps de /Applications suelen tener dueño root: reintentar con sudo
  # antes de dar el borrado por perdido.
  [ -e "$1" ] && sudo rm -rf "$1" 2>/dev/null
  [ -e "$1" ] && { bad "no pude borrar $1"; return 1; }
  ok "$2"
}

# La misma lista sirve para borrar y para verificar. Con dos listas separadas,
# una se desactualiza y el script termina diciendo que borró algo que sigue ahí.
rutas_docker() {
  cat <<RUTAS
/Applications/Docker.app
$HOME/Library/Containers/com.docker.docker
$HOME/Library/Group Containers/group.com.docker
$HOME/.docker
$HOME/Library/Application Support/Docker Desktop
$HOME/Library/Caches/com.docker.docker
$HOME/Library/Caches/KSCrashReports
$HOME/Library/Preferences/com.docker.docker.plist
$HOME/Library/Saved Application State/com.electron.docker-frontend.savedState
$HOME/Library/Logs/Docker Desktop
$HOME/Library/HTTPStorages/com.docker.docker
$HOME/Library/Cookies/com.docker.docker.binarycookies
$HOME/Library/LaunchAgents/com.docker.helper.plist
RUTAS
}

rutas_ollama() {
  cat <<RUTAS
$HOME/.ollama
$HOME/Library/Application Support/Ollama
$HOME/Library/Caches/Ollama
$HOME/Library/Caches/com.electron.ollama
$HOME/Library/Preferences/com.electron.ollama.plist
$HOME/Library/Saved Application State/com.electron.ollama.savedState
$HOME/Library/HTTPStorages/com.electron.ollama
$HOME/Library/WebKit/com.electron.ollama
/Applications/Ollama.app
/usr/local/bin/ollama
/opt/homebrew/bin/ollama
RUTAS
}

fila() { # fila <ruta> <qué es>
  local t
  t=$(tam "$1") || return 0
  printf '  \033[1m%-8s\033[0m %s\n' "$t" "$2"
  printf '           \033[90m%s\033[0m\n' "$1"
}

# El CLI de docker habla con el daemon que tenga configurado, y eso puede ser
# otra máquina: basta un `docker context use` o un DOCKER_HOST apuntando a un
# servidor. Un prune corrido desde acá se ejecutaría ALLÁ, sobre datos ajenos
# a esta limpieza. Antes de borrar nada hay que probar que el daemon es local.
docker_es_local() {
  local endpoint ctx
  if [ -n "${DOCKER_HOST:-}" ] && ! printf '%s' "$DOCKER_HOST" | grep -q '^unix://'; then
    bad "DOCKER_HOST apunta a otra máquina: $DOCKER_HOST"
    info "Esto se cancela: limpiar desde acá borraría cosas allá."
    return 1
  fi
  endpoint=$(docker context inspect -f '{{.Endpoints.docker.Host}}' 2>/dev/null)
  if [ -n "$endpoint" ] && ! printf '%s' "$endpoint" | grep -q '^unix://'; then
    ctx=$(docker context show 2>/dev/null)
    bad "el contexto '$ctx' apunta a un daemon remoto: $endpoint"
    info "Esto se cancela: limpiar desde acá borraría cosas allá."
    info "Para ver los contextos:  docker context ls"
    info "Para volver al local:    docker context use default"
    return 1
  fi
  return 0
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
  bash $0 --docker-seguro  caché e imágenes, SIN tocar los datos
  bash $0 --docker-respaldo  guardar los volúmenes antes de borrar nada
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
  say "Ollama · qué hay"
  while IFS= read -r ruta; do
    t=$(tam "$ruta") && printf '    %-7s %s\n' "$t" "$ruta"
  done <<<"$(rutas_ollama)"
  if command -v ollama >/dev/null 2>&1; then
    info "modelos:"; ollama list 2>/dev/null | sed 's/^/      /'
  fi
  confirmar "¿Borrar Ollama entero y TODOS sus modelos?" || return 0

  say "1/3 · Cerrando lo que esté corriendo"
  # Son dos procesos con dos nombres distintos y pkill -x distingue
  # mayúsculas: `Ollama` es la app de la barra de menú, `ollama` el servidor.
  # Matar solo el segundo deja el ícono arriba y la app vuelve a crear ~/.ollama.
  osascript -e 'quit app "Ollama"' 2>/dev/null && ok "app cerrada"
  sleep 1
  pkill -x Ollama 2>/dev/null && ok "proceso Ollama (app) terminado"
  pkill -x ollama 2>/dev/null && ok "proceso ollama (servidor) terminado"
  pkill -f 'Ollama Helper' 2>/dev/null

  say "2/3 · Borrando"
  # Pudo venir por el .app, por Homebrew o por el script de install, y los
  # tres dejan cosas en lugares distintos.
  if command -v brew >/dev/null 2>&1; then
    brew uninstall --cask ollama 2>/dev/null && ok "desinstalado de Homebrew (cask)"
    brew uninstall ollama       2>/dev/null && ok "desinstalado de Homebrew (fórmula)"
  fi
  while IFS= read -r ruta; do
    sacar "$ruta" "$(basename "$ruta")"
  done <<<"$(rutas_ollama)"
  for la in "$HOME"/Library/LaunchAgents/*[oO]llama*; do
    [ -e "$la" ] && sacar "$la" "$(basename "$la")"
  done

  say "3/3 · Verificación"
  restos=0
  while IFS= read -r ruta; do
    [ -e "$ruta" ] && { bad "sigue ahí: $ruta"; restos=1; }
  done <<<"$(rutas_ollama)"
  if pgrep -ix ollama >/dev/null 2>&1; then
    bad "todavía hay un proceso de Ollama corriendo"
    restos=1
  fi
  if [ "$restos" = 0 ]; then
    ok "no quedó nada de Ollama"
    info "Si igual seguís viendo el ícono en la barra de menú, es la app vieja"
    info "todavía en memoria: cerrá sesión y volvé a entrar. Y si reaparece al"
    info "reiniciar, sacala de Ajustes > General > Ítems de inicio."
  fi
  ok "libre ahora: $(libre)"
  ;;

--docker-seguro)
  say "Docker · sacar lo que no son datos"
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    bad "Docker no está corriendo · abrilo y volvé a intentar"
    return 0
  fi
  docker_es_local || return 0
  ok "el daemon es local · esto no toca ninguna otra máquina"
  info "cómo está ahora:"
  docker system df 2>/dev/null | sed 's/^/      /'
  info ""
  # La distinción es toda la gracia de esta opción: la caché de builds y las
  # imágenes sin usar se vuelven a bajar o a construir solas. Los volúmenes
  # son la base de datos. Por eso nunca aparece --volumes acá abajo.
  info "Se saca: caché de builds, imágenes sin usar, contenedores parados."
  info "NO se toca: los volúmenes, que es donde están los datos de Supabase."
  confirmar "¿Dale?" || return 0

  vol_antes=$(docker volume ls -q 2>/dev/null | wc -l | tr -d ' ')

  docker builder prune -af   >/dev/null 2>&1 && ok "caché de builds"
  docker image prune -af     >/dev/null 2>&1 && ok "imágenes sin usar"
  docker container prune -f  >/dev/null 2>&1 && ok "contenedores parados"
  docker network prune -f    >/dev/null 2>&1 && ok "redes sueltas"

  vol_despues=$(docker volume ls -q 2>/dev/null | wc -l | tr -d ' ')
  if [ "$vol_antes" = "$vol_despues" ]; then
    ok "los $vol_despues volúmenes siguen intactos"
  else
    bad "los volúmenes pasaron de $vol_antes a $vol_despues · esto no debía pasar"
  fi

  say "Cómo quedó"
  docker system df 2>/dev/null | sed 's/^/      /'
  # Docker Desktop viejo no devuelve al disco el espacio que se libera adentro
  # del disco virtual: el archivo crece y no se encoge. En las versiones
  # nuevas sí, pero puede tardar un rato en verse.
  info ""
  info "Si el espacio del sistema no cambió, es que el disco virtual de Docker"
  info "no se achicó todavía. Reiniciá Docker Desktop; si aun así no baja, esa"
  info "versión no devuelve el espacio y la única salida es desinstalarlo."
  ok "libre ahora: $(libre)"
  ;;

--docker-respaldo)
  say "Respaldo de los volúmenes"
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    bad "Docker no está corriendo · abrilo y volvé a intentar"; return 0
  fi
  docker_es_local || return 0

  destino="$HOME/Desktop/respaldo-docker"
  vols=$(docker volume ls -q 2>/dev/null)
  [ -n "$vols" ] || { ok "no hay volúmenes que respaldar"; return 0; }

  info "van a $destino"
  printf '%s\n' "$vols" | sed 's/^/      /'
  info ""
  # Un tar de un Postgres en marcha sale roto: las páginas cambian mientras se
  # copia y el respaldo falla justo el día que hace falta. Hay que parar todo
  # antes, aunque eso corte los servicios un rato.
  warn "Esto PARA todos los contenedores: un tar de una base en marcha sale roto."
  info "Después se vuelven a levantar con: docker start \$(docker ps -aq)"
  confirmar "¿Parar todo y respaldar?" || return 0

  mkdir -p "$destino" || { bad "no pude crear $destino"; return 0; }
  corriendo=$(docker ps -q 2>/dev/null)
  if [ -n "$corriendo" ]; then
    docker stop $corriendo >/dev/null 2>&1 && ok "contenedores parados"
  fi

  fallos=0
  for v in $vols; do
    printf '    %-45s ' "$v"
    # alpine + tar corre adentro de Docker, así que no depende de qué haya
    # instalado en la Mac, y monta el volumen de solo lectura.
    if docker run --rm -v "$v":/origen:ro -v "$destino":/destino alpine \
         tar czf "/destino/$v.tgz" -C /origen . >/dev/null 2>&1; then
      printf '\033[32m%s\033[0m\n' "$(tam "$destino/$v.tgz")"
    else
      printf '\033[31mfalló\033[0m\n'; fallos=$((fallos+1))
    fi
  done

  if [ "$fallos" -gt 0 ]; then
    bad "$fallos volúmenes no se pudieron respaldar · NO borres Docker todavía"
  else
    ok "los $(printf '%s\n' "$vols" | wc -l | tr -d ' ') volúmenes quedaron en $destino"
    info "total: $(tam "$destino")"
    info "Para restaurar uno:"
    info "  docker run --rm -v NOMBRE:/destino -v $destino:/origen alpine \\"
    info "    tar xzf /origen/NOMBRE.tgz -C /destino"
  fi
  ;;

--docker)
  say "Docker Desktop · qué hay"
  while IFS= read -r ruta; do
    t=$(tam "$ruta") && printf '    %-7s %s\n' "$t" "$ruta"
  done <<<"$(rutas_docker)"

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker_es_local; then
    v=$(docker volume ls -q 2>/dev/null | wc -l | tr -d ' ')
    c=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
    [ "${c:-0}" -gt 0 ] && bad "hay $c contenedores corriendo · se van a ir con todo"
    if [ "${v:-0}" -gt 0 ]; then
      bad "hay $v volúmenes: son los DATOS de las bases que corrieron acá"
      info "Esto no se deshace. Para guardarlos primero:"
      info "  bash $0 --docker-respaldo"
    fi
  fi
  confirmar "¿Desinstalar Docker Desktop y borrar TODOS sus datos?" || return 0

  say "1/3 · Cerrando Docker"
  osascript -e 'quit app "Docker"' 2>/dev/null && ok "app cerrada"
  sleep 2
  pkill -x Docker 2>/dev/null && ok "proceso terminado"

  say "2/3 · Borrando"
  # El desinstalador propio limpia los symlinks de /usr/local/bin y el
  # privileged helper de /Library/PrivilegedHelperTools, que a mano quedan
  # dando vueltas y hacen que un `docker` fantasma siga respondiendo.
  if [ -x /Applications/Docker.app/Contents/MacOS/uninstall ]; then
    sudo /Applications/Docker.app/Contents/MacOS/uninstall >/dev/null 2>&1 \
      && ok "desinstalador oficial corrido" \
      || warn "el desinstalador oficial falló · sigo a mano"
  fi
  while IFS= read -r ruta; do
    sacar "$ruta" "$(basename "$ruta")"
  done <<<"$(rutas_docker)"
  sudo rm -f /Library/PrivilegedHelperTools/com.docker.vmnetd \
             /Library/PrivilegedHelperTools/com.docker.socket 2>/dev/null

  say "3/3 · Verificación"
  restos=0
  while IFS= read -r ruta; do
    [ -e "$ruta" ] && { bad "sigue ahí: $ruta"; restos=1; }
  done <<<"$(rutas_docker)"
  if command -v docker >/dev/null 2>&1; then
    warn "todavía hay un comando 'docker' en $(command -v docker)"
    info "Suele ser un symlink que dejó Homebrew o un cliente aparte, no"
    info "Docker Desktop. No ocupa espacio; si molesta: brew uninstall docker"
  fi
  [ "$restos" = 0 ] && ok "no quedó nada de Docker Desktop"
  ok "libre ahora: $(libre)"
  ;;

--caches)
  say "Cachés (todo esto se regenera solo)"
  for p in "$HOME/.npm" "$HOME/Library/Caches/Homebrew" \
           "$HOME/Library/Developer/Xcode/DerivedData" "$HOME/Library/Caches/Yarn"; do
    t=$(tam "$p") && info "$t  $p"
  done
  confirmar "¿Vaciarlas?" || return 0

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
  confirmar "¿Borrarlos?" || return 0

  sudo tmutil thinlocalsnapshots / 999999999999 4 && ok "borrados"
  ok "listo · libre ahora: $(libre)"
  ;;
esac
}

for a in "${ACCIONES[@]}"; do ejecutar "$a"; done
