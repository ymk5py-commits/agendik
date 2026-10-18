#!/bin/sh
# Instala el respaldo nocturno (03:45) como temporizador de usuario de systemd.
set -eu
AQUI="$(cd "$(dirname "$0")" && pwd)"
U="$HOME/.config/systemd/user"; mkdir -p "$U"
cat > "$U/agendik-respaldo.service" <<UNIT
[Unit]
Description=Respaldo de Agendik (base de datos + .env)

[Service]
Type=oneshot
# sg docker: el systemd --user arrancó antes de que novum entrara al grupo docker (mismo arreglo que Botika/Aura).
ExecStart=/usr/bin/sg docker -c "$AQUI/respaldar.sh"
TimeoutStartSec=3600
UNIT
cat > "$U/agendik-respaldo.timer" <<UNIT
[Unit]
Description=Respaldo nocturno de Agendik

[Timer]
OnCalendar=*-*-* 03:45:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now agendik-respaldo.timer
systemctl --user list-timers agendik-respaldo.timer --no-pager
