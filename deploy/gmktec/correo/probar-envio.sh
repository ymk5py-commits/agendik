#!/bin/sh
# Manda un correo de prueba POR LA COLA (el mismo camino que los avisos de citas) y muestra cómo quedó.
#   ./correo/probar-envio.sh destino@correo.com
set -eu
AQUI="$(cd "$(dirname "$0")/.." && pwd)"; cd "$AQUI"
PARA="${1:?Uso: ./correo/probar-envio.sh destino@correo.com}"
docker exec -i ag-db psql -U postgres -At -v ON_ERROR_STOP=1 -v para="$PARA" >/dev/null <<'SQL'
select public.encolar_correo(:'para', 'Prueba de correo de Agendik',
  '<p>Si estás leyendo esto, el correo saliente de Agendik funciona.</p>',
  'Si estás leyendo esto, el correo saliente de Agendik funciona.', 'prueba');
SQL
docker compose --env-file .env run --rm -T correo
docker exec -i ag-db psql -U postgres -At -v para="$PARA" <<'SQL'
select 'estado: ' || estado || ' · intentos=' || intentos || coalesce(' · error=' || ultimo_error, '')
  from public.cola_correos where para = lower(:'para') and evento = 'prueba' order by creado_en desc limit 1;
SQL
