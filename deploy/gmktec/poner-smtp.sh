#!/bin/sh
# Carga el SMTP de salida en el servidor, SIN pagar ningún servicio y SIN que la contraseña pase por el chat
# ni por la línea de comandos (viaja por stdin del ssh). Corrélo vos, en tu Terminal de la Mac:
#
#     ./deploy/gmktec/poner-smtp.sh
#
# Sirve para cualquier SMTP: el de tu app de reenvío / un Postfix propio, o una cuenta gratuita (p. ej. Gmail
# con «contraseña de aplicación»: smtp.gmail.com, 587, tu correo, y el remitente = ese mismo correo).
# Después reinicia GoTrue (recuperar contraseña) y, si querés, manda un correo de prueba por la cola.
set -eu
SRV="${SRV:-gmktec}"

printf 'Servidor SMTP (ej. smtp.gmail.com): ';              read -r HOST
printf 'Puerto (587 = STARTTLS, 465 = SSL, 25/1025 = sin TLS): '; read -r PORT
printf 'Usuario (vacío si el SMTP no pide): ';               read -r USUARIO
printf 'Contraseña (no se ve; vacío si no pide): ';          stty -echo; read -r CLAVE; stty echo; printf '\n'
printf 'Remitente (From) — tiene que ser una dirección que ese SMTP te deje usar: '; read -r DESDE
printf 'Nombre que ve el cliente [Agendik]: ';               read -r NOMBRE
NOMBRE="${NOMBRE:-Agendik}"

printf '%s\n%s\n%s\n%s\n%s\n%s\n' "$HOST" "$PORT" "$USUARIO" "$CLAVE" "$DESDE" "$NOMBRE" \
  | ssh "$SRV" 'cd ~/CROMAN/AGENDIK-INFRA && python3 poner-smtp-remoto.py'
unset CLAVE

echo "→ reiniciando GoTrue con el SMTP nuevo (el worker de la cola lo lee solo en cada corrida)"
ssh "$SRV" 'cd ~/CROMAN/AGENDIK-INFRA && docker compose --env-file .env up -d auth >/dev/null 2>&1 && echo "   listo"'

printf 'Mandar un correo de prueba a (vacío = no): '; read -r PRUEBA
if [ -n "$PRUEBA" ]; then
  case "$PRUEBA" in *[!A-Za-z0-9@._+-]*) echo "dirección no válida"; exit 1 ;; esac
  ssh "$SRV" "cd ~/CROMAN/AGENDIK-INFRA && ./correo/probar-envio.sh '$PRUEBA'"
fi
