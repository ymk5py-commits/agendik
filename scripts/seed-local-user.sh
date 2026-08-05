#!/usr/bin/env bash
#
# Agendik · usuario de prueba para el Supabase LOCAL
#
# Crea demo@agendik.app / agendik123 con su ficha de cliente y unas citas,
# para no arrancar con el dashboard vacío después de cada `db reset`.
#
# A propósito NO vive en supabase/seed.sql: ese archivo se corre también
# contra la base de producción, y un usuario con contraseña conocida no
# tiene por qué existir ahí. Este script solo apunta a 127.0.0.1.
#
set -euo pipefail
cd "$(dirname "$0")/.."

API="http://127.0.0.1:54321"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
EMAIL="demo@agendik.app"
PASS="agendik123"

command -v psql >/dev/null || { echo "Falta psql"; exit 1; }
curl -sf "$API/auth/v1/health" >/dev/null 2>&1 || {
  echo "El Supabase local no responde. Levantalo con: npm run db:start"; exit 1; }

ANON=$(npx --no-install supabase status -o json 2>/dev/null \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['ANON_KEY'])")
TID=$(psql -tA "$DB" -c "select id from tenants where slug='estudio-alma'")

if psql -tA "$DB" -c "select 1 from auth.users where email='$EMAIL'" | grep -q 1; then
  echo "Ya existe $EMAIL — nada que hacer."
  exit 0
fi

# 1 · alta por la API de auth (así la contraseña queda hasheada como corresponde)
RESP=$(curl -s -X POST "$API/auth/v1/signup" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"data\":{\"name\":\"Camila Duarte\",\"phone\":\"+595981234567\",\"tenant_id\":\"$TID\"}}")
USER_ID=$(printf '%s' "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('user',{}).get('id',''))")
[ -n "$USER_ID" ] || { echo "No se pudo crear el usuario:"; printf '%s' "$RESP" | head -c 300; exit 1; }

# 2 · ficha de cliente, paquete y citas
psql -q -v ON_ERROR_STOP=1 "$DB" <<SQL
insert into clients (user_id, tenant_id, name, email, phone, birth_date, gender, occupation, address, status)
values ('$USER_ID', '$TID', 'Camila Duarte', '$EMAIL', '+595981234567',
        '1994-03-18', 'female', 'Diseñadora', 'Av. España 1520, Asunción', 'active');

with c as (select id from clients where email = '$EMAIL'),
     p as (select id, name from professionals where tenant_id = '$TID'),
     s as (select id, name from services where tenant_id = '$TID'),
     nuevas as (
       insert into appointments (tenant_id, client_id, professional_id, date, start_time, end_time, duration_min, status, source)
       select '$TID', c.id, p.id, d.fecha, d.desde, d.hasta, d.dur, d.est, 'portal'
       from c, p, (values
           ('Valeria Núñez',  current_date + 3,  time '10:00', time '11:00', 60, 'confirmed'),
           ('Cynthia Torres', current_date + 8,  time '15:30', time '16:15', 45, 'reserved'),
           ('Valeria Núñez',  current_date - 12, time '10:00', time '11:00', 60, 'completed')
         ) as d(prof, fecha, desde, hasta, dur, est)
       where p.name = d.prof
       returning id, professional_id
     )
insert into appointment_services (appointment_id, service_id)
select n.id, s.id from nuevas n
join p on p.id = n.professional_id
join s on s.name = case p.name
    when 'Valeria Núñez'  then 'Limpieza Facial Profunda'
    when 'Cynthia Torres' then 'Manicura Spa' end;

-- un paquete con sesiones ya usadas, para ver la barra de progreso
with c as (select id from clients where email = '$EMAIL'),
     nuevo as (
       insert into packages (tenant_id, client_id, name, original_price, discount_percentage,
                             discount_amount, final_price, total_paid, remaining_balance, status)
       select '$TID', c.id, 'Pack Facial Glow', 1160000, 15, 174000, 986000, 700000, 286000, 'active' from c
       returning id
     )
insert into package_items (package_id, service_id, quantity, sessions_used)
select nuevo.id, s.id, v.cant, v.usadas
from nuevo, (values ('Limpieza Facial Profunda', 4, 1), ('Peeling Ultrasónico', 2, 0)) as v(nom, cant, usadas)
join services s on s.name = v.nom and s.tenant_id = '$TID';
SQL

echo "Listo · $EMAIL / $PASS"
psql -tA "$DB" -c "
select '  ' || to_char(a.date,'DD/MM') || ' ' || to_char(a.start_time,'HH24:MI') || ' · ' || s.name || ' · ' || a.status
from appointments a
join clients c on c.id = a.client_id and c.email = '$EMAIL'
left join appointment_services aps on aps.appointment_id = a.id
left join services s on s.id = aps.service_id
order by a.date;"
