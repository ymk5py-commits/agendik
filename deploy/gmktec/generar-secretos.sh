#!/bin/sh
# Crea .env a partir de env.ejemplo con secretos nuevos. No imprime ningún secreto.
# Se corre UNA vez, en el servidor. Si .env ya existe, no lo toca.
set -eu
cd "$(dirname "$0")"

if [ -e .env ]; then
  echo "Ya existe .env: no se toca. Para empezar de cero, movelo a otro lado primero." >&2
  exit 1
fi
command -v openssl >/dev/null 2>&1 || { echo "Falta openssl." >&2; exit 1; }

umask 077
cp env.ejemplo .env

b64url() { openssl enc -base64 -A | tr '+/' '-_' | tr -d '='; }
hex() { openssl rand -hex "$1"; }

jwt_secret=$(hex 32)
header='{"alg":"HS256","typ":"JWT"}'
iat=$(date +%s)
exp=$((iat + 10 * 365 * 24 * 3600)) # 10 años

firmar() {
  payload=$1
  p64=$(printf %s "$payload" | b64url)
  h64=$(printf %s "$header" | b64url)
  firma=$(printf %s "$h64.$p64" | openssl dgst -binary -sha256 -hmac "$jwt_secret" | b64url)
  printf '%s' "$h64.$p64.$firma"
}

anon=$(firmar "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")
service=$(firmar "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$iat,\"exp\":$exp}")

poner() { # poner CLAVE VALOR — reemplaza «CLAVE=CAMBIAR» sin que el valor pase por la línea de comandos de sed
  K="$1" V="$2" python3 - <<'PY'
import os, re
k, v = os.environ["K"], os.environ["V"]
t = open(".env").read()
t, n = re.subn(rf"(?m)^{re.escape(k)}=CAMBIAR$", lambda _: f"{k}={v}", t)
assert n == 1, f"{k}: no encontré «{k}=CAMBIAR» en .env"
open(".env", "w").write(t)
PY
}

poner POSTGRES_PASSWORD "$(hex 24)"
poner JWT_SECRET "$jwt_secret"
poner ANON_KEY "$anon"
poner SERVICE_ROLE_KEY "$service"
poner PG_META_CRYPTO_KEY "$(hex 16)"
poner DASHBOARD_PASSWORD "$(hex 12)"

chmod 600 .env
mkdir -p volumes/db/data volumes/snippets site respaldo

if grep -q '=CAMBIAR$' .env; then
  echo "Quedaron valores «CAMBIAR» sin reemplazar en .env." >&2
  exit 1
fi
echo "Listo: .env creado (permisos 600) con claves nuevas. No se muestran."
echo "Las claves de la API vencen el $(date -d "@$exp" +%Y-%m-%d)."
