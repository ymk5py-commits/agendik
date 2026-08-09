#!/usr/bin/env bash
#
# Agendik · usuario de administración para el Supabase LOCAL
#
# Crea admin@agendik.app / agendik123 como dueño del negocio, y un segundo
# cliente con citas para que la agenda del panel no se vea vacía.
#
# Igual que seed-local-user.sh, vive fuera de supabase/seed.sql a propósito:
# ese archivo se corre también en producción y una cuenta con contraseña
# conocida no tiene por qué existir ahí. Este script solo apunta a 127.0.0.1.
#
set -euo pipefail
cd "$(dirname "$0")/.."

API="http://127.0.0.1:54321"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
EMAIL="admin@agendik.app"
PASS="agendik123"

curl -sf "$API/auth/v1/health" >/dev/null 2>&1 || {
  echo "El Supabase local no responde. Levantalo con: npm run db:start"; exit 1; }

ANON=$(./node_modules/.bin/supabase status -o json 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['ANON_KEY'])")
TID=$(psql -tA "$DB" -c "select id from tenants where slug='estudio-alma'")

crear_usuario() { # $1=email $2=nombre  -> imprime el user_id
  local resp
  resp=$(curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\",\"data\":{\"name\":\"$2\"}}")
  printf '%s' "$resp" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user',{}).get('id',''))"
}

# --- admin -----------------------------------------------------------
if psql -tA "$DB" -c "select 1 from auth.users where email='$EMAIL'" | grep -q 1; then
  echo "Ya existe $EMAIL"
else
  UID_ADMIN=$(crear_usuario "$EMAIL" "Rocío Fernández")
  [ -n "$UID_ADMIN" ] || { echo "No se pudo crear el usuario admin"; exit 1; }
  psql -q -v ON_ERROR_STOP=1 "$DB" <<SQL
insert into public.staff (tenant_id, user_id, name, email, role)
values ('$TID', '$UID_ADMIN', 'Rocío Fernández', '$EMAIL', 'owner');
SQL
  echo "Admin creado · $EMAIL / $PASS"
fi

# --- segundo cliente, para que la agenda tenga movimiento -------------
if ! psql -tA "$DB" -c "select 1 from clients where email='sofia@ejemplo.com'" | grep -q 1; then
  UID_C2=$(crear_usuario "sofia@ejemplo.com" "Sofía Ramírez")
  psql -q -v ON_ERROR_STOP=1 "$DB" <<SQL
insert into public.clients (user_id, tenant_id, name, email, phone, status)
values ('$UID_C2', '$TID', 'Sofía Ramírez', 'sofia@ejemplo.com', '+595983777111', 'active');

with c as (select id from clients where email = 'sofia@ejemplo.com'),
     p as (select id, name from professionals where tenant_id = '$TID'),
     nuevas as (
       insert into appointments (tenant_id, client_id, professional_id, date, start_time, end_time, duration_min, status, source)
       select '$TID', c.id, p.id, d.fecha, d.desde, d.hasta, d.dur, d.est, 'portal'
       from c, p, (values
           ('Cynthia Torres', current_date,     time '09:00', time '10:30', 90, 'confirmed'),
           ('Lucas Benítez',  current_date,     time '16:00', time '17:00', 60, 'reserved'),
           ('Valeria Núñez',  current_date + 1, time '11:00', time '12:00', 60, 'reserved'),
           ('Cynthia Torres', current_date - 5, time '14:00', time '15:00', 60, 'completed'),
           ('Lucas Benítez',  current_date - 2, time '10:00', time '11:00', 60, 'cancelled')
         ) as d(prof, fecha, desde, hasta, dur, est)
       where p.name = d.prof
       returning id, professional_id
     ),
     srv as (select id, name from services where tenant_id = '$TID')
insert into appointment_services (appointment_id, service_id)
select n.id, srv.id from nuevas n
join p on p.id = n.professional_id
join srv on srv.name = case p.name
    when 'Cynthia Torres' then 'Manicura Spa'
    when 'Lucas Benítez'  then 'Corte & Brushing'
    else 'Masaje Relajante' end;
SQL
  echo "Segundo cliente creado · sofia@ejemplo.com / $PASS"
fi

echo
echo "Agenda del negocio:"
psql -tA "$DB" -c "
select '  ' || to_char(date,'DD/MM') || ' ' || to_char(start_time,'HH24:MI') || ' · ' ||
       rpad(client_name, 16) || ' · ' || rpad(professional_name, 16) || ' · ' || status
from admin_agenda order by date, start_time;"
