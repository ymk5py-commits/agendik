#!/bin/sh
# Respaldo de la base de Agendik (incluye usuarios de auth) + el .env (sin él, un respaldo no se puede
# usar: las claves y el secreto JWT viven ahí). Guarda 14 días en ~/backups/agendik (permisos 700).
set -eu
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/backups/agendik"
mkdir -p "$DEST"; chmod 700 "$DEST"
umask 077
f="$DEST/agendik-$(date +%Y%m%d-%H%M%S)"
docker exec ag-db pg_dump -U postgres -d postgres --format=custom --no-owner --compress=6 > "$f.dump"
cp "$AQUI/.env" "$f.env"
[ -s "$f.dump" ] || { echo "El dump salió vacío" >&2; rm -f "$f.dump" "$f.env"; exit 1; }
find "$DEST" -type f -name 'agendik-*' -mtime +14 -delete
echo "Respaldo: $f.dump ($(du -h "$f.dump" | cut -f1))"
