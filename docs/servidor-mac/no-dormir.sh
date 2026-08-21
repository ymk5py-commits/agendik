#!/usr/bin/env bash
#
# Servidor Mac · que no se duerma nunca, ni con la tapa cerrada
#
# `pmset -a disablesleep 1` por sí solo no alcanza en un Apple Silicon: macOS
# tiene varios modos de suspensión distintos y ese apaga uno, además de que
# algunas actualizaciones lo resetean. Esto apaga todos, y deja un caffeinate
# como LaunchDaemon que cubre lo que pmset no y sobrevive los reinicios.
#
# Correr UNA VEZ, con sudo. En la Mac:
#
#   sudo bash no-dormir.sh
#
# O remoto desde la Ubuntu, sin levantarse:
#
#   scp docs/servidor-mac/no-dormir.sh croman@100.82.224.88:/tmp/
#   ssh -t croman@100.82.224.88 'sudo bash /tmp/no-dormir.sh'
#
# Para revertir todo: sudo bash no-dormir.sh --revertir
#
set -uo pipefail

PLIST=/Library/LaunchDaemons/com.local.caffeinate.plist
LABEL=com.local.caffeinate

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "Hay que correrlo con sudo:  sudo bash $0"; exit 1; }

# ---------------------------------------------------------------------
if [ "${1:-}" = "--revertir" ]; then
  say "Devolviendo el comportamiento normal"
  pmset -a disablesleep 0 2>/dev/null
  pmset -a sleep 1 2>/dev/null
  pmset -a disksleep 10 2>/dev/null
  launchctl bootout system "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  ok "la Mac vuelve a dormirse al cerrar la tapa"
  exit 0
fi

# ---------------------------------------------------------------------
say "1/4 · ¿Está enchufada?"
# ---------------------------------------------------------------------
# Con la tapa cerrada y a batería, macOS se duerme igual: hay modos de bajo
# consumo que ni pmset ni caffeinate pueden pisar. Para un servidor 24/7 el
# cargador no es opcional.
if pmset -g batt 2>/dev/null | grep -q "AC Power"; then
  ok "enchufada a la corriente"
else
  bad "está a BATERÍA"
  info "Enchufala antes de cerrar la tapa. A batería macOS se duerme igual,"
  info "por debajo de lo que estos ajustes pueden controlar."
fi

# ---------------------------------------------------------------------
say "2/4 · Apagando todos los modos de suspensión"
# ---------------------------------------------------------------------
# Algunas claves no existen en Apple Silicon; que falte una no es un problema.
poner() {
  if pmset -a "$1" "$2" 2>/dev/null; then
    printf '  \033[32m✓\033[0m %-16s %-4s %s\n' "$1" "$2" "$3"
  else
    printf '  \033[90m·\033[0m %-16s %-4s (no existe en este Mac)\n' "$1" "$2"
  fi
}

poner disablesleep   1 "no dormir jamás, ni con la tapa cerrada"
poner sleep          0 "sin suspensión por inactividad"
poner disksleep      0 "el disco no se duerme"
poner standby        0 "sin standby"
poner autopoweroff   0 "sin apagado automático"
poner hibernatemode  0 "sin hibernación"
poner powernap       0 "sin Power Nap"
poner womp           1 "se puede despertar por red"
poner ttyskeepawake  1 "no dormir con una sesión SSH abierta"
poner autorestart    1 "prenderse sola tras un corte de luz"
poner displaysleep   5 "la pantalla SÍ se apaga (ahorra energía)"

# ---------------------------------------------------------------------
say "3/4 · caffeinate permanente (lo que pmset no cubre)"
# ---------------------------------------------------------------------
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/caffeinate</string>
        <string>-s</string>
        <string>-i</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
PLIST_EOF
chown root:wheel "$PLIST"
chmod 644 "$PLIST"

launchctl bootout system "$PLIST" 2>/dev/null
if launchctl bootstrap system "$PLIST" 2>/dev/null; then
  ok "daemon instalado y corriendo · arranca solo en cada reinicio"
else
  bad "no se pudo cargar el daemon"
  info "probá a mano: sudo launchctl bootstrap system $PLIST"
fi

# ---------------------------------------------------------------------
say "4/4 · Verificación"
# ---------------------------------------------------------------------
printf '  %-18s ' "SleepDisabled"
if pmset -g | grep -qE 'SleepDisabled[[:space:]]+1'; then
  printf '\033[32m1 · ok\033[0m\n'
else
  printf '\033[31m0 · NO quedó aplicado\033[0m\n'
fi

printf '  %-18s ' "caffeinate"
if pgrep -x caffeinate >/dev/null 2>&1; then
  printf '\033[32mcorriendo\033[0m\n'
else
  printf '\033[31mno está corriendo\033[0m\n'
fi

printf '  %-18s ' "asserciones"
if pmset -g assertions 2>/dev/null | grep -qE 'PreventUserIdleSystemSleep.*1'; then
  printf '\033[32malgo está impidiendo el sueño · ok\033[0m\n'
else
  printf '\033[33msin assertion activa\033[0m\n'
fi

cat <<FIN

=====================================================================
Ya podés cerrar la tapa. Dejala ENCHUFADA.

Si igual se vuelve a caer, lo primero es preguntarle a macOS por qué se
durmió — el motivo está en su propio registro:

  pmset -g log | grep -iE 'Sleep.*due to|Wake.*due to' | tail -20

  · "Clamshell Sleep"  -> la tapa; algo pisó el disablesleep
  · "Idle Sleep"       -> inactividad; faltó el caffeinate
  · "Low Power Sleep"  -> se quedó sin batería: enchufala
  · "Maintenance Sleep"-> Power Nap; revisá que quedara en 0

Revertir todo: sudo bash $0 --revertir
=====================================================================
FIN
