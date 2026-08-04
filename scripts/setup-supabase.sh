#!/usr/bin/env bash
#
# Agendik · conectar Supabase después de aprobar la integración en el navegador
#
# Hace todo lo que sigue al paso manual:
#   1. Trae las credenciales que Vercel generó al provisionar Supabase
#   2. Aplica las migraciones y el seed sobre la base nueva
#   3. Publica VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en Vercel
#   4. Redespliega producción
#
# Uso:  ./scripts/setup-supabase.sh
#
set -euo pipefail

SCOPE="croman-mvp-s-projects"
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v vercel >/dev/null || die "Falta el CLI de Vercel: npm i -g vercel"
command -v psql   >/dev/null || die "Falta psql (viene con postgresql: brew install postgresql@16)"

# ---------------------------------------------------------------------
say "1/4 · Trayendo las credenciales desde Vercel"
# ---------------------------------------------------------------------
if ! vercel integration list --scope "$SCOPE" 2>/dev/null | grep -qi supabase; then
  die "Todavía no hay un recurso de Supabase conectado al proyecto.
Terminá la aprobación en el navegador (vercel integration add supabase) y volvé a correr esto."
fi

rm -f .env.vercel
vercel env pull .env.vercel --environment=production --scope "$SCOPE" --yes >/dev/null
[ -s .env.vercel ] || die "vercel env pull no trajo nada."

# El nombre exacto varía según cómo provisione la integración; probamos los conocidos.
get() {
  for key in "$@"; do
    local v
    v=$(grep -E "^${key}=" .env.vercel | head -1 | cut -d= -f2- | tr -d '"' || true)
    [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  done
  return 1
}

SUPA_URL=$(get SUPABASE_URL NEXT_PUBLIC_SUPABASE_URL VITE_SUPABASE_URL) \
  || die "No encontré la URL de Supabase en las variables. Revisá: cat .env.vercel"
ANON_KEY=$(get SUPABASE_ANON_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_ANON_KEY) \
  || die "No encontré la anon key en las variables. Revisá: cat .env.vercel"
PG_URL=$(get POSTGRES_URL_NON_POOLING POSTGRES_URL DATABASE_URL SUPABASE_DB_URL) \
  || die "No encontré la cadena de conexión a Postgres. Revisá: cat .env.vercel"

echo "  URL de Supabase: ${SUPA_URL}"
echo "  Base de datos:   ${PG_URL%%\?*}"

# ---------------------------------------------------------------------
say "2/4 · Aplicando el esquema"
# ---------------------------------------------------------------------
for f in supabase/migrations/0001_schema.sql \
         supabase/migrations/0002_rls.sql \
         supabase/migrations/0003_functions.sql \
         supabase/seed.sql; do
  printf '  %-40s' "$f"
  if psql -q -v ON_ERROR_STOP=1 -d "$PG_URL" -f "$f" >/tmp/agendik_sql.log 2>&1; then
    echo "ok"
  else
    echo "ERROR"; cat /tmp/agendik_sql.log; die "Falló $f"
  fi
done

# ---------------------------------------------------------------------
say "3/4 · Publicando las variables que usa la app"
# ---------------------------------------------------------------------
put() {
  vercel env rm "$1" production --yes --scope "$SCOPE" >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production --scope "$SCOPE" >/dev/null
  echo "  $1 ✓"
}
put VITE_SUPABASE_URL      "$SUPA_URL"
put VITE_SUPABASE_ANON_KEY "$ANON_KEY"
put VITE_DEFAULT_TENANT    "estudio-alma"

# ---------------------------------------------------------------------
say "4/4 · Redesplegando"
# ---------------------------------------------------------------------
vercel --prod --yes --scope "$SCOPE" 2>&1 | tail -3

rm -f .env.vercel   # trae secretos: no queda en disco

cat <<'FIN'

Listo. La app ya usa Supabase en vez del modo demo.

Falta un paso solo si querés poder registrarte sin confirmar el email:
en Supabase → Authentication → Providers → Email, desactivá "Confirm email".
Con la confirmación activa la ficha de cliente se crea en el primer login.

Creá tu primer usuario desde la propia app, en "Crear cuenta".
FIN
