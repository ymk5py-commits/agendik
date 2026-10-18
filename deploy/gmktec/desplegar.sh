#!/bin/sh
# Desde la Mac: sincroniza el código y la infraestructura con gmktec, compila el portal y
# deja el stack al día. Se puede correr las veces que haga falta.
#   Primera vez en el servidor:  ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && ./generar-secretos.sh'
set -eu
SRV="${SRV:-gmktec}"
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"

echo "→ código"
rsync -a --delete --exclude .git --exclude node_modules --exclude dist --exclude '.env*' \
  --exclude strix_runs --exclude deploy/gmktec "$RAIZ/" "$SRV:CROMAN/AGENDIK/"

echo "→ infraestructura"
ssh "$SRV" 'mkdir -p ~/CROMAN/AGENDIK-INFRA'
rsync -a --exclude .env --exclude volumes/db/data --exclude site --exclude volumes/functions/notificar \
  "$RAIZ/deploy/gmktec/" "$SRV:CROMAN/AGENDIK-INFRA/"

echo "→ servidor"
ssh "$SRV" 'set -eu; cd ~/CROMAN/AGENDIK-INFRA
  [ -f .env ] || { echo "Falta .env: corré ./generar-secretos.sh" >&2; exit 1; }
  mkdir -p volumes/functions/notificar volumes/snippets site
  rsync -a --delete ../AGENDIK/supabase/functions/notificar/ volumes/functions/notificar/
  docker compose --env-file .env up -d
  ./migrar.sh
  ./construir-portal.sh
  docker compose --env-file .env ps'
