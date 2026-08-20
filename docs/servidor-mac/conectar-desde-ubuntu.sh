#!/usr/bin/env bash
#
# Agendik · conectar la Ubuntu con el servidor Mac
#
# Corré esto EN TU UBUNTU (no en la Mac):
#
#   bash docs/servidor-mac/conectar-desde-ubuntu.sh
#
# Deja levantada la VPN (Tailscale), te dice servicio por servicio qué responde
# del servidor y qué no, y te ofrece configurar la llave SSH, el alias `ssh mac`
# y el cliente de escritorio remoto. Se puede correr las veces que quieras.
#
# Opciones:
#   --check   solo diagnóstico: no instala ni modifica nada
#   -y        contesta que sí a todo (para dejarlo andando sin preguntas)
#
# El servidor se puede cambiar por variables de entorno:
#   MAC_IP=100.82.224.88  MAC_USER=croman  MAC_NAME=macs-macbook-air
#
set -uo pipefail

MAC_IP="${MAC_IP:-100.82.224.88}"
MAC_USER="${MAC_USER:-croman}"
MAC_NAME="${MAC_NAME:-macs-macbook-air}"
SSH_ALIAS="${SSH_ALIAS:-mac}"
SCRIPT_MAC='/Users/croman/Desktop/SERVIDOR MAC/configurar-servidor.sh'

CHECK_ONLY=0
AUTO=0
for arg in "$@"; do
  case "$arg" in
    --check|--solo-chequeo) CHECK_ONLY=1 ;;
    -y|--yes|--si)          AUTO=1 ;;
    -h|--help)              awk 'NR>1 && /^#/ {sub(/^# ?/, ""); print; next} NR>1 {exit}' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg (probá --help)" >&2; exit 1 ;;
  esac
done

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }

ask() {  # ask "pregunta"  → 0 si el usuario dice que sí
  [ "$CHECK_ONLY" = 1 ] && return 1
  [ "$AUTO" = 1 ] && return 0
  [ -t 0 ] || return 1
  local r
  read -rp "$(printf '  \033[1m%s\033[0m [S/n] ' "$1")" r
  case "${r:-s}" in [sSyY]*) return 0 ;; *) return 1 ;; esac
}

# ¿Hay algo escuchando en ese puerto de la Mac? Sin depender de nc.
probe() { timeout 3 bash -c "exec 3<>/dev/tcp/$MAC_IP/$1" 2>/dev/null; }

# puerto|nombre|cómo se usa
SERVICIOS=(
  "22|SSH|ssh $MAC_USER@$MAC_IP"
  "5900|Compartir pantalla|Remmina → VNC → $MAC_IP"
  "5678|n8n|http://$MAC_IP:5678"
  "3000|Twenty CRM|http://$MAC_IP:3000"
  "3010|AFFiNE|http://$MAC_IP:3010"
  "54321|Supabase API|http://$MAC_IP:54321"
  "54322|Postgres|host $MAC_IP puerto 54322"
  "54323|Supabase Studio|http://$MAC_IP:54323"
  "54324|Inbucket (mails)|http://$MAC_IP:54324"
)

printf '\n\033[1m Servidor Mac · %s (%s) · usuario %s\033[0m\n' "$MAC_NAME" "$MAC_IP" "$MAC_USER"
[ "$CHECK_ONLY" = 1 ] && info "modo --check: no se instala ni se modifica nada"

# ---------------------------------------------------------------------
say "1/4 · Tailscale (la red privada que llega hasta la Mac)"
# ---------------------------------------------------------------------
if command -v tailscale >/dev/null 2>&1; then
  ok "instalado"
elif [ "$CHECK_ONLY" = 1 ]; then
  bad "no está instalado"
  info "corré este script sin --check, o: curl -fsSL https://tailscale.com/install.sh | sh"
  exit 1
elif ask "No está instalado. ¿Lo instalo? (pide sudo)"; then
  curl -fsSL https://tailscale.com/install.sh | sh || {
    bad "falló la instalación"
    info "instalalo a mano desde https://tailscale.com/download/linux"
    exit 1
  }
  ok "instalado"
else
  bad "sin Tailscale no hay forma de llegar al servidor"
  exit 1
fi

if tailscale status >/dev/null 2>&1; then
  ok "sesión iniciada"
elif [ "$CHECK_ONLY" = 1 ]; then
  bad "la VPN está apagada o sin sesión"
  info "corré: sudo tailscale up"
  exit 1
else
  bad "la VPN está apagada o sin sesión"
  info "va a imprimir un link: abrilo y logueate con LA MISMA cuenta que la Mac"
  sudo tailscale up || { bad "no se pudo levantar"; exit 1; }
  ok "sesión iniciada"
fi

if tailscale status 2>/dev/null | grep -qiE "(^|[[:space:]])($MAC_NAME|$MAC_IP)([[:space:]]|$)"; then
  ok "la Mac aparece en la red"
else
  bad "la Mac NO aparece en la lista de máquinas"
  info "puede estar apagada, sin sesión iniciada, o logueada con otra cuenta"
  info "revisá con: tailscale status"
fi

# ---------------------------------------------------------------------
say "2/4 · Qué responde del servidor"
# ---------------------------------------------------------------------
VIVOS=0
SSH_OK=0
VNC_OK=0
for fila in "${SERVICIOS[@]}"; do
  IFS='|' read -r puerto nombre uso <<<"$fila"
  if probe "$puerto"; then
    printf '  \033[32m✓\033[0m %-22s %s\n' "$nombre" "$uso"
    VIVOS=$((VIVOS + 1))
    [ "$puerto" = 22 ]   && SSH_OK=1
    [ "$puerto" = 5900 ] && VNC_OK=1
  else
    printf '  \033[31m✗\033[0m %-22s (puerto %s cerrado)\n' "$nombre" "$puerto"
  fi
done

if [ "$VIVOS" = 0 ]; then
  say "No responde ningún servicio"
  info "La Mac no está alcanzable. Las causas más probables:"
  info "  · está apagada o suspendida"
  info "  · hubo corte de luz y quedó esperando la contraseña de FileVault en la"
  info "    pantalla de arranque — hasta escribirla no arranca ningún servicio"
  info "  · Tailscale no arrancó en la Mac"
  exit 1
fi

# ---------------------------------------------------------------------
say "3/4 · SSH"
# ---------------------------------------------------------------------
if [ "$SSH_OK" = 0 ]; then
  bad "la Sesión remota está apagada en la Mac"
  info "Esto NO se puede activar desde acá. Una vez, en la Terminal de la Mac:"
  info "  sudo bash \"$SCRIPT_MAC\""
  info "o a mano: Ajustes → General → Compartir → Sesión remota"
else
  if [ ! -f "$HOME/.ssh/id_ed25519" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
    if ask "No tenés llave SSH. ¿La genero? (sin passphrase)"; then
      ssh-keygen -t ed25519 -N '' -f "$HOME/.ssh/id_ed25519" >/dev/null && ok "llave creada"
    fi
  else
    ok "ya tenés llave SSH"
  fi

  if ssh -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=accept-new \
       "$MAC_USER@$MAC_IP" true 2>/dev/null; then
    ok "entra sin contraseña"
  elif ask "Todavía pide contraseña. ¿Copio la llave a la Mac? (te la va a pedir una última vez)"; then
    ssh-copy-id -o StrictHostKeyChecking=accept-new "$MAC_USER@$MAC_IP" \
      && ok "listo, no te la pide más" \
      || bad "no se pudo copiar la llave"
  fi

  CFG="$HOME/.ssh/config"
  if grep -qiE "^[[:space:]]*Host[[:space:]]+(.*[[:space:]])?$SSH_ALIAS([[:space:]]|$)" "$CFG" 2>/dev/null; then
    ok "el alias 'ssh $SSH_ALIAS' ya está configurado"
  elif ask "¿Agrego el alias para escribir 'ssh $SSH_ALIAS' en vez de la IP?"; then
    mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
    printf '\nHost %s\n    HostName %s\n    User %s\n    ServerAliveInterval 30\n' \
      "$SSH_ALIAS" "$MAC_IP" "$MAC_USER" >>"$CFG"
    chmod 600 "$CFG"
    ok "alias agregado en ~/.ssh/config"
  fi
fi

# ---------------------------------------------------------------------
say "4/4 · Ver la pantalla de la Mac (VNC)"
# ---------------------------------------------------------------------
if [ "$VNC_OK" = 0 ]; then
  bad "Compartir pantalla está apagado en la Mac"
  if [ "$SSH_OK" = 1 ]; then
    info "Como SSH sí anda, se prende remoto sin levantarte:"
    info "  ssh -t $MAC_USER@$MAC_IP 'sudo bash \"$SCRIPT_MAC\"'"
  else
    info "Lo activa el mismo script del paso 3, en la Mac"
  fi
elif command -v remmina >/dev/null 2>&1; then
  ok "Remmina instalado · conexión VNC a $MAC_IP, usuario $MAC_USER"
elif ask "Falta un cliente VNC. ¿Instalo Remmina? (pide sudo)"; then
  sudo apt-get install -y remmina remmina-plugin-vnc \
    && ok "instalado · Remmina → VNC → $MAC_IP" \
    || bad "no se pudo instalar"
fi

# ---------------------------------------------------------------------
cat <<FIN

=====================================================================
En el navegador (lo que vas a usar el 90% del tiempo):

  n8n              http://$MAC_IP:5678
  Twenty CRM       http://$MAC_IP:3000
  AFFiNE           http://$MAC_IP:3010
  Supabase Studio  http://$MAC_IP:54323

Para apuntar Agendik a la base que ya corre en la Mac:

  ssh $MAC_USER@$MAC_IP 'cd ~/Desktop/AGENDAMIENTO && npx supabase status'
  ./scripts/connect-supabase.sh http://$MAC_IP:54321 <anon-key> estudio-alma
  npm run dev

Detalle de todo esto en docs/servidor-mac/README.md
=====================================================================
FIN
