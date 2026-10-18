#!/bin/sh
# Instala el cron del correo: cada minuto vacía la cola de correos salientes (timer de usuario de systemd).
set -eu
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
U="$HOME/.config/systemd/user"; mkdir -p "$U"
cat > "$U/agendik-correo.service" <<UNIT
[Unit]
Description=Agendik: enviar correos pendientes (cola_correos → SMTP)

[Service]
Type=oneshot
# sg docker: el systemd --user arrancó antes de que novum entrara al grupo docker (mismo arreglo que el respaldo).
ExecStart=/usr/bin/sg docker -c "cd $AQUI && docker compose --env-file .env run --rm -T correo"
TimeoutStartSec=300
UNIT
cat > "$U/agendik-correo.timer" <<UNIT
[Unit]
Description=Agendik: cron del correo (cada minuto)

[Timer]
OnBootSec=1min
OnUnitActiveSec=60s
AccuracySec=5s

[Install]
WantedBy=timers.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now agendik-correo.timer
systemctl --user list-timers agendik-correo.timer --no-pager
