#!/bin/sh
# Compila el portal (Vite) en un contenedor de Node y lo publica en ./site, que sirve el borde Caddy.
# Las variables VITE_* se hornean en el build: si cambia la URL o la clave, hay que volver a correrlo.
set -eu
AQUI="$(cd "$(dirname "$0")" && pwd)"
CODIGO="$AQUI/../AGENDIK"
[ -f "$AQUI/.env" ] || { echo "Falta .env: corré ./generar-secretos.sh primero." >&2; exit 1; }
set -a; . "$AQUI/.env"; set +a

docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -e VITE_SUPABASE_URL="$SUPABASE_PUBLIC_URL" \
  -e VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
  -e VITE_DEFAULT_TENANT="$VITE_DEFAULT_TENANT" \
  -v "$CODIGO":/app -w /app node:22-alpine \
  sh -c 'npm ci --ignore-scripts --no-audit --no-fund && npm run build'

mkdir -p "$AQUI/site"
# Se actualiza el contenido in situ (no se reemplaza la carpeta): Caddy la tiene montada.
rsync -a --delete "$CODIGO/dist/" "$AQUI/site/"
echo "Portal publicado en $AQUI/site"
