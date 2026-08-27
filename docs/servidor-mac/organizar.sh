#!/usr/bin/env bash
#
# Mac · ordenar el Escritorio y las Descargas por tipo de proyecto
#
# Sin argumentos NO mueve nada: muestra el plan y sale. Mover archivos ajenos
# es difícil de deshacer, así que primero se mira y después se decide.
#
#   bash organizar.sh                  ver el plan de las dos carpetas
#   bash organizar.sh --escritorio     aplicarlo al Escritorio
#   bash organizar.sh --descargas      aplicarlo a Descargas
#   bash organizar.sh --deshacer       revertir la última corrida
#
# Se puede excluir lo que no querés que se mueva, las veces que haga falta:
#
#   bash organizar.sh --escritorio --excluir AGENDAMIENTO --excluir Captura.png
#
# Cada corrida deja un registro en ~/.organizar-mac/ y --deshacer lo lee al
# revés para devolver todo a donde estaba.
#
set -uo pipefail

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }

# En un macOS en español el Finder muestra "Escritorio" y "Descargas", pero en
# el disco las carpetas siguen llamándose Desktop y Downloads: el nombre
# traducido es solo de la interfaz.
ESCRITORIO="$HOME/Desktop"
DESCARGAS="$HOME/Downloads"
REGISTROS="$HOME/.organizar-mac"

# Los destinos de primer nivel. Sirven para no volver a entrar a lo que el
# script mismo creó: sin esto, la segunda corrida metería Documentos adentro
# de Varios.
DESTINOS="Proyectos Documentos Hojas Presentaciones Imágenes Multimedia Instaladores Comprimidos Código Varios"

SI_A_TODO=0
ACCIONES=()
EXCLUIDOS=()
esperando_excluir=0
for arg in "$@"; do
  if [ "$esperando_excluir" = 1 ]; then EXCLUIDOS+=("$arg"); esperando_excluir=0; continue; fi
  case "$arg" in
    -y|--si)                        SI_A_TODO=1 ;;
    --excluir)                      esperando_excluir=1 ;;
    --escritorio|--descargas|--deshacer) ACCIONES+=("$arg") ;;
    -h|--help) awk 'NR>1 && !/^#/{exit} NR>1{sub(/^# ?/,""); print}' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg"; echo "Probá: bash $0 --help"; exit 1 ;;
  esac
done
[ "$esperando_excluir" = 1 ] && { bad "--excluir se quedó sin nombre"; exit 1; }

confirmar() {
  [ "$SI_A_TODO" = 1 ] && return 0
  printf '\n  \033[1m%s\033[0m [s/N] ' "$1"
  { read -r r </dev/tty; } 2>/dev/null || r=""
  case "${r:-}" in [sSyY]*) return 0 ;; *) echo "  cancelado"; return 1 ;; esac
}

es_excluido() {
  local n="$1" e
  for e in ${EXCLUIDOS+"${EXCLUIDOS[@]}"}; do [ "$n" = "$e" ] && return 0; done
  for e in $DESTINOS; do [ "$n" = "$e" ] && return 0; done
  return 1
}

# ---------------------------------------------------------------------
# Clasificar
# ---------------------------------------------------------------------
# Una carpeta se clasifica por lo que tiene adentro, no por el nombre: el
# archivo de manifiesto dice de qué stack es el proyecto sin lugar a dudas.
tipo_de_carpeta() {
  local d="$1"
  [ -e "$d/package.json" ]     && { echo "Proyectos/Web";    return; }
  [ -e "$d/pyproject.toml" ] || [ -e "$d/requirements.txt" ] || [ -e "$d/setup.py" ] \
                               && { echo "Proyectos/Python"; return; }
  [ -e "$d/Cargo.toml" ]       && { echo "Proyectos/Rust";   return; }
  [ -e "$d/go.mod" ]           && { echo "Proyectos/Go";     return; }
  [ -e "$d/composer.json" ]    && { echo "Proyectos/PHP";    return; }
  [ -e "$d/pom.xml" ] || [ -e "$d/build.gradle" ] \
                               && { echo "Proyectos/Java";   return; }
  [ -e "$d/Package.swift" ]    && { echo "Proyectos/Swift";  return; }
  ls "$d"/*.xcodeproj  >/dev/null 2>&1 && { echo "Proyectos/Swift"; return; }
  ls "$d"/*.ipynb      >/dev/null 2>&1 && { echo "Proyectos/Datos"; return; }
  # Un .git sin manifiesto reconocible sigue siendo un proyecto: va con los
  # proyectos, no mezclado con carpetas sueltas.
  [ -d "$d/.git" ]             && { echo "Proyectos/Otros";  return; }
  echo "Varios"
}

tipo_de_archivo() {
  # minúsculas a mano: ${x,,} es de bash 4 y macOS trae la 3.2
  local ext
  ext=$(printf '%s' "${1##*.}" | tr 'A-Z' 'a-z')
  case "$ext" in
    pdf|doc|docx|pages|txt|md|rtf|odt|epub)      echo "Documentos" ;;
    xlsx|xls|csv|tsv|numbers)                    echo "Hojas" ;;
    key|ppt|pptx)                                echo "Presentaciones" ;;
    png|jpg|jpeg|gif|heic|webp|svg|tiff|tif|bmp) echo "Imágenes" ;;
    mp4|mov|avi|mkv|m4v|webm|mp3|wav|m4a|aac|flac) echo "Multimedia" ;;
    dmg|pkg|iso)                                 echo "Instaladores" ;;
    zip|tar|gz|tgz|rar|7z|bz2|xz)                echo "Comprimidos" ;;
    js|ts|jsx|tsx|py|sh|sql|json|yml|yaml|html|css|rb|go|rs|java|c|cpp|h) echo "Código" ;;
    *)                                           echo "Varios" ;;
  esac
}

destino_de() {
  local ruta="$1" nombre
  nombre=$(basename "$ruta")
  if [ -d "$ruta" ]; then
    case "$nombre" in *.app) echo "Instaladores"; return ;; esac
    tipo_de_carpeta "$ruta"
  else
    tipo_de_archivo "$nombre"
  fi
}

# Nunca pisar algo que ya está en el destino: si hay choque de nombre, el que
# llega se numera. Perder un archivo por un nombre repetido es inaceptable.
destino_libre() {
  local dir="$1" nombre="$2" n=2 base ext
  [ -e "$dir/$nombre" ] || { printf '%s\n' "$dir/$nombre"; return; }
  if [ -f "$dir/$nombre" ] && case "$nombre" in *.*) true ;; *) false ;; esac; then
    base="${nombre%.*}"; ext=".${nombre##*.}"
  else
    base="$nombre"; ext=""
  fi
  while [ -e "$dir/$base ($n)$ext" ]; do n=$((n+1)); done
  printf '%s\n' "$dir/$base ($n)$ext"
}

# ---------------------------------------------------------------------
# Plan (no toca nada)
# ---------------------------------------------------------------------
plan() {
  local base="$1" etiqueta="$2" entrada nombre dest lista=""
  say "$etiqueta · $base"
  [ -d "$base" ] || { warn "no existe"; return 0; }

  for entrada in "$base"/*; do
    [ -e "$entrada" ] || continue
    nombre=$(basename "$entrada")
    if es_excluido "$nombre"; then
      lista="$lista~se queda	$nombre
"
      continue
    fi
    dest=$(destino_de "$entrada")
    lista="$lista$dest	$nombre
"
  done
  [ -z "$lista" ] && { ok "no hay nada suelto para ordenar"; return 0; }

  # Agrupado por destino, que es como se revisa un plan de movimientos: uno
  # quiere ver qué va a parar a cada carpeta, no recorrer una lista alfabética
  # de archivos. De paso evita alinear columnas a mano, que con acentos sale
  # torcido porque printf cuenta bytes y no caracteres.
  printf '%s' "$lista" | LC_ALL=C sort | (
    prev=""
    while IFS=$'\t' read -r d n; do
      if [ "$d" != "$prev" ]; then
        if [ "$d" = "~se queda" ]; then
          printf '\n    \033[90mse quedan donde están\033[0m\n'
        else
          printf '\n    \033[36m%s\033[0m\n' "$d"
        fi
        prev="$d"
      fi
      printf '        %s\n' "$n"
    done
  )
  return 0
}

# ---------------------------------------------------------------------
# Aplicar
# ---------------------------------------------------------------------
aplicar() {
  local base="$1" etiqueta="$2" entrada nombre dest destino_final movidos=0 registro

  [ -d "$base" ] || { bad "no existe: $base"; return 0; }
  plan "$base" "$etiqueta"
  confirmar "¿Mover todo eso?" || return 0

  mkdir -p "$REGISTROS"
  registro="$REGISTROS/$(date +%Y%m%d-%H%M%S)-$(basename "$base").tsv"

  for entrada in "$base"/*; do
    [ -e "$entrada" ] || continue
    nombre=$(basename "$entrada")
    es_excluido "$nombre" && continue

    dest=$(destino_de "$entrada")
    mkdir -p "$base/$dest" || { bad "no pude crear $base/$dest"; continue; }
    destino_final=$(destino_libre "$base/$dest" "$nombre")

    if mv "$entrada" "$destino_final" 2>/dev/null; then
      # El registro se escribe recién después de que el mv salió bien: anotar
      # antes dejaría en el log movimientos que nunca pasaron, y --deshacer
      # trataría de revertirlos.
      printf '%s\t%s\n' "$entrada" "$destino_final" >> "$registro"
      movidos=$((movidos+1))
    else
      bad "no pude mover $nombre"
    fi
  done

  if [ "$movidos" = 0 ]; then
    ok "no hubo nada que mover"
    rm -f "$registro"
  else
    ok "$movidos cosas movidas"
    info "para revertir esto: bash $0 --deshacer"
  fi
}

# Después de devolver todo, las carpetas que creamos quedan vacías. Se sacan
# con rmdir a propósito y no con rm -rf: si adentro quedó algo que el registro
# no cubre, rmdir falla y lo deja donde está en vez de llevárselo puesto.
limpiar_vacias() {
  local base="$1" d
  for d in $DESTINOS; do
    [ -d "$base/$d" ] || continue
    rmdir "$base/$d"/* 2>/dev/null
    rmdir "$base/$d"   2>/dev/null
  done
}

# ---------------------------------------------------------------------
deshacer() {
  say "Deshacer"
  local ultimo linea origen destino vueltas=0
  ultimo=$(ls -1t "$REGISTROS"/*.tsv 2>/dev/null | head -1)
  [ -n "$ultimo" ] || { warn "no hay ninguna corrida registrada"; return 0; }

  info "última corrida: $(basename "$ultimo")"
  info "$(wc -l < "$ultimo" | tr -d ' ') movimientos"
  confirmar "¿Devolver todo a donde estaba?" || return 0

  # Al revés, por si una carpeta se movió adentro de otra que también se movió.
  while IFS=$'\t' read -r destino origen; do
    [ -n "${origen:-}" ] || continue
    if [ ! -e "$destino" ]; then bad "ya no está: $destino"; continue; fi
    if [ -e "$origen" ]; then bad "el origen está ocupado: $origen"; continue; fi
    mv "$destino" "$origen" 2>/dev/null \
      && vueltas=$((vueltas+1)) \
      || bad "no pude devolver $(basename "$destino")"
  done <<<"$(awk -F'\t' '{print $2"\t"$1}' "$ultimo" | tail -r 2>/dev/null || awk -F'\t' '{print $2"\t"$1}' "$ultimo" | tac)"

  ok "$vueltas cosas devueltas"
  if [ "$vueltas" -gt 0 ]; then
    limpiar_vacias "$(dirname "$(head -1 "$ultimo" | cut -f1)")"
    mv "$ultimo" "$ultimo.deshecho"
  fi
  return 0
}

# ---------------------------------------------------------------------
if [ ${#ACCIONES[@]} -eq 0 ]; then
  plan "$ESCRITORIO" "ESCRITORIO"
  plan "$DESCARGAS"  "DESCARGAS"
  cat <<FIN

=====================================================================
Esto no movió nada. Si el plan te cierra:

  bash $0 --escritorio
  bash $0 --descargas

Lo que no quieras que se mueva, sacalo del plan por nombre:

  bash $0 --escritorio --excluir AGENDAMIENTO

Y si algo sale mal:  bash $0 --deshacer
=====================================================================
FIN
  exit 0
fi

for a in "${ACCIONES[@]}"; do
  case "$a" in
    --escritorio) aplicar "$ESCRITORIO" "ESCRITORIO" ;;
    --descargas)  aplicar "$DESCARGAS"  "DESCARGAS" ;;
    --deshacer)   deshacer ;;
  esac
done
