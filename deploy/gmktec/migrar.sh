#!/bin/sh
# Aplica ../AGENDIK/supabase/migrations/*.sql en orden, cada una en una transacción, y las anota en
# agendik_ops.migraciones para no repetirlas. Para en el primer error. Se corre con el stack levantado.
# (No usa supabase/install.sql: ese archivo se arma a mano y puede quedar atrás de las migraciones.)
set -eu
AQUI="$(cd "$(dirname "$0")" && pwd)"
MIG="$AQUI/../AGENDIK/supabase/migrations"
psql_db() { docker exec -i ag-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql_db -c "create schema if not exists agendik_ops;
            create table if not exists agendik_ops.migraciones (
              nombre text primary key, aplicada_en timestamptz not null default now());"

for f in "$MIG"/*.sql; do
  n=$(basename "$f")
  ya=$(psql_db -tA -c "select 1 from agendik_ops.migraciones where nombre = '$n'")
  if [ -n "$ya" ]; then echo "= $n (ya aplicada)"; continue; fi
  echo "→ $n"
  { echo "begin;"; cat "$f"; echo; echo "insert into agendik_ops.migraciones (nombre) values ('$n');"; echo "commit;"; } \
    | psql_db 2>&1 | grep -v "^NOTICE" || true
  ok=$(psql_db -tA -c "select 1 from agendik_ops.migraciones where nombre = '$n'")
  [ -n "$ok" ] || { echo "✗ FALLÓ $n: se detiene acá" >&2; exit 1; }
done
echo "Migraciones al día."
