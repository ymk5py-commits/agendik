#!/bin/sh
# Convierte a un usuario YA registrado en dueño de la plataforma (ve «Negocios» y puede dar de alta negocios).
# Es una operación de fundación: la app no deja hacerlo (platform_admins no tiene políticas de escritura).
# Primero la persona se registra en el portal con su propia contraseña; después se corre esto con su email.
#   ./crear-admin-plataforma.sh persona@correo.com
set -eu
EMAIL="${1:?Uso: ./crear-admin-plataforma.sh email@dominio}"
OUT=$(docker exec -i ag-db psql -U postgres -At -v ON_ERROR_STOP=1 -v email="$EMAIL" <<'SQL'
with u as (select id from auth.users where lower(email) = lower(:'email')),
     ins as (insert into public.platform_admins (user_id) select id from u on conflict do nothing returning user_id)
select (select count(*) from u) || '|' || (select count(*) from ins);
SQL
)
case "$OUT" in
  0\|*) echo "No hay ningún usuario con el email $EMAIL: que se registre primero en el portal." >&2; exit 1 ;;
  1\|1) echo "Listo: $EMAIL ahora es dueño de la plataforma (le aparece «Negocios» al volver a entrar)." ;;
  1\|0) echo "$EMAIL ya era dueño de la plataforma." ;;
  *) echo "Resultado inesperado: $OUT" >&2; exit 1 ;;
esac
