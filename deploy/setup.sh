#!/usr/bin/env bash
#
# Agendik · instalación del backend en el VPS
#
# Genera secretos NUEVOS (nunca los de demo, que son públicos), levanta el
# stack, aplica migraciones y seed, y te imprime las dos variables que hay que
# cargar en Vercel.
#
# Uso, ya dentro del VPS y parado en esta carpeta:
#   ./setup.sh srv1834489.hstgr.cloud https://agendik.vercel.app
#
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-}"
SITE_URL="${2:-https://agendik.vercel.app}"
[ -n "$DOMAIN" ] || { echo "Uso: ./setup.sh <dominio> [url-de-la-app]"; exit 1; }

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "Falta Docker."
docker compose version >/dev/null 2>&1 || die "Falta el plugin docker compose."

# ---------------------------------------------------------------------
say "1/5 · Generando secretos"
# ---------------------------------------------------------------------
if [ -f .env ]; then
  echo "  .env ya existe, lo reuso (borralo si querés secretos nuevos)"
else
  JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=+/' | cut -c1-40)
  POSTGRES_PASSWORD=$(head -c 24 /dev/urandom | base64 | tr -d '=+/' | cut -c1-28)

  # Las claves anon y service_role son JWT firmados con el secreto de arriba.
  read -r ANON_KEY SERVICE_KEY <<EOF
$(python3 - "$JWT_SECRET" <<'PY'
import base64, hashlib, hmac, json, sys, time

secret = sys.argv[1].encode()
def b64(raw): return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()

def jwt(role):
    now = int(time.time())
    head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':')).encode())
    body = b64(json.dumps({
        "role": role, "iss": "supabase", "iat": now,
        "exp": now + 60 * 60 * 24 * 365 * 10,   # 10 años
    }, separators=(',', ':')).encode())
    msg = f"{head}.{body}".encode()
    sig = b64(hmac.new(secret, msg, hashlib.sha256).digest())
    return f"{head}.{body}.{sig}"

print(jwt("anon"), jwt("service_role"))
PY
)
EOF

  cat > .env <<EOF
DOMAIN=$DOMAIN
SITE_URL=$SITE_URL
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_KEY
EOF
  chmod 600 .env
  echo "  secretos nuevos escritos en .env (chmod 600)"
fi

set -a; . ./.env; set +a

# ---------------------------------------------------------------------
say "2/5 · Levantando el stack"
# ---------------------------------------------------------------------
docker compose --env-file .env up -d
echo "  esperando a Postgres..."
for i in $(seq 1 60); do
  docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && { echo "  listo"; break; }
  sleep 2
  [ "$i" = 60 ] && die "Postgres no arrancó."
done

# ---------------------------------------------------------------------
say "3/5 · Roles que espera el esquema"
# ---------------------------------------------------------------------
docker compose exec -T db psql -U postgres -q <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL
echo "  anon · authenticated · service_role"

# ---------------------------------------------------------------------
say "4/5 · Migraciones y seed"
# ---------------------------------------------------------------------
for f in ../supabase/migrations/0001_schema.sql \
         ../supabase/migrations/0002_rls.sql \
         ../supabase/migrations/0003_functions.sql \
         ../supabase/seed.sql; do
  printf '  %-42s' "$(basename "$f")"
  if docker compose exec -T db psql -U postgres -q -v ON_ERROR_STOP=1 < "$f" >/tmp/agendik.log 2>&1; then
    echo "ok"
  else
    echo "ERROR"; cat /tmp/agendik.log; die "Falló $(basename "$f")"
  fi
done

# ---------------------------------------------------------------------
say "5/5 · Comprobando desde afuera"
# ---------------------------------------------------------------------
echo "  esperando el certificado de Let's Encrypt (puede tardar ~30s)..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://$DOMAIN/auth/v1/health" || true)
  [ "$code" = "200" ] && { echo "  auth  HTTP 200 · TLS ok"; break; }
  sleep 4
  [ "$i" = 30 ] && echo "  aviso: todavía no responde. Revisá que 80 y 443 estén abiertos."
done

cat <<FIN

=====================================================================
Cargá estas dos variables en Vercel (producción) y redesplegá:

  VITE_SUPABASE_URL=https://$DOMAIN
  VITE_SUPABASE_ANON_KEY=$ANON_KEY

El service_role queda solo en .env del servidor. No lo pongas nunca en
el frontend: se saltea RLS.
=====================================================================
FIN
