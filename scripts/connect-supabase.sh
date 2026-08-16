#!/usr/bin/env bash
#
# Agendik · apuntar la app a un Supabase real
#
# Sirve igual para un proyecto en la nube o para uno self-hosted.
#
# Uso:
#   ./scripts/connect-supabase.sh <URL> <KEY_PUBLICA> [tenant-slug]
#
# Ejemplos:
#   ./scripts/connect-supabase.sh https://abcd.supabase.co sb_publishable_...
#   ./scripts/connect-supabase.sh http://192.168.221.87:8000 eyJhbGciOi...
#
# Qué hace:
#   1. Verifica que el servidor responda y que la key sirva
#   2. Chequea que el esquema de Agendik ya esté instalado
#      (si no, te dice que corras supabase/install.sql)
#   3. Escribe el .env local, guardando backup del anterior
#
# La key que va acá es la PÚBLICA (publishable / anon): viaja al navegador
# en cualquier app de Supabase y está limitada por las políticas RLS.
# La secret / service_role NO va acá — saltea RLS y este script no la necesita.
#
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-}"
KEY="${2:-}"
TENANT="${3:-estudio-alma}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$URL" ] && [ -n "$KEY" ] || {
  echo "Uso: $0 <URL> <KEY_PUBLICA> [tenant-slug]"
  echo "Ej.: $0 https://abcd.supabase.co sb_publishable_..."
  exit 1
}
URL="${URL%/}"

case "$KEY" in
  sb_secret_*|*service_role*)
    die "Esa es la clave SECRETA. Saltea todas las políticas de seguridad y no puede
terminar en el navegador. Usá la publishable key (sb_publishable_...) o la anon key legacy." ;;
esac

say "1/3 · ¿Responde el servidor y sirve la key?"
HEALTH=$(curl -s -m 10 -o /dev/null -w '%{http_code}' -H "apikey: $KEY" "$URL/auth/v1/health" || true)
case "$HEALTH" in
  200) echo "  ok · $URL" ;;
  000) die "No hay respuesta de $URL
Si es un servidor de tu red, revisá que estés en la misma red (o con la VPN puesta)." ;;
  401|403) die "El servidor responde, pero rechazó la key (HTTP $HEALTH).
Revisá que sea la publishable/anon de este proyecto y que esté COMPLETA:
el dashboard la muestra cortada con '…', hay que copiarla con el botón Copy." ;;
  *) die "Respuesta inesperada del servidor (HTTP $HEALTH) en $URL/auth/v1/health" ;;
esac

say "2/3 · ¿Sirve la key y está el esquema?"
CODE=$(curl -s -m 10 -o /tmp/agendik-check.json -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/tenants?select=slug&limit=5" || true)

case "$CODE" in
  200) : ;;
  401|403) die "La key fue rechazada (HTTP $CODE). Revisá que sea la publishable/anon
del proyecto $URL y que esté completa (el dashboard la muestra cortada con '…')." ;;
  404) die "La tabla 'tenants' no existe todavía: falta crear el esquema.
Abrí el SQL Editor del proyecto y ejecutá el contenido de supabase/install.sql,
después volvé a correr esto." ;;
  *)   die "Respuesta inesperada (HTTP $CODE): $(head -c 300 /tmp/agendik-check.json)" ;;
esac

grep -q "\"$TENANT\"" /tmp/agendik-check.json \
  || die "El esquema está, pero no encuentro el negocio '$TENANT'.
Corré la parte final (el seed) de supabase/install.sql, o pasá el slug correcto
como tercer argumento."
echo "  ok · esquema instalado y negocio '$TENANT' presente"

say "3/3 · Escribiendo .env"
if [ -f .env ]; then
  BAK=".env.backup-$(date +%Y%m%d%H%M%S)"
  cp .env "$BAK"
  echo "  (guardé el .env anterior como $BAK)"
fi
cat > .env <<ENV
# Supabase · $URL
VITE_SUPABASE_URL=$URL
VITE_SUPABASE_ANON_KEY=$KEY
VITE_DEFAULT_TENANT=$TENANT
ENV
echo "  ok · .env actualizado"

say "Listo. Levantá la app con: npm run dev"
