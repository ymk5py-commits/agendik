# Conectarse al servidor Mac desde Ubuntu

El backend de Agendik (Supabase) corre en una MacBook Air M1 que quedó de
servidor, junto con n8n, Twenty CRM y AFFiNE. No hay puertos abiertos en el
router: **todo se alcanza por Tailscale**, la red privada. El único requisito
del lado Ubuntu es tener Tailscale instalado y logueado con la misma cuenta.

| | |
|---|---|
| IP en Tailscale | `100.82.224.88` (fija, no cambia nunca) |
| Nombre (MagicDNS) | `macs-macbook-air` |
| Usuario | `croman` |
| Proyecto Supabase | `~/Desktop/AGENDAMIENTO` en la Mac |

| Servicio | Puerto | Desde Ubuntu |
|---|---|---|
| n8n | 5678 | http://100.82.224.88:5678 |
| Twenty CRM | 3000 | http://100.82.224.88:3000 |
| AFFiNE | 3010 | http://100.82.224.88:3010 |
| Supabase API | 54321 | http://100.82.224.88:54321 |
| Postgres | 54322 | host `100.82.224.88`, base `postgres`, usuario `postgres` |
| Supabase Studio | 54323 | http://100.82.224.88:54323 |
| Inbucket (mails de prueba) | 54324 | http://100.82.224.88:54324 |
| SSH | 22 | `ssh croman@100.82.224.88` |
| Compartir pantalla (VNC) | 5900 | Remmina → `100.82.224.88` |

---

## Todo de una

```bash
bash docs/servidor-mac/conectar-desde-ubuntu.sh
```

Instala Tailscale si falta, levanta la VPN, prueba puerto por puerto qué
responde del servidor y qué no, y te ofrece dejar configurada la llave SSH, el
alias `ssh mac` y el cliente de escritorio remoto. Es idempotente: se puede
correr las veces que quieras.

Para solo mirar si el servidor está vivo, sin instalar ni tocar nada:

```bash
bash docs/servidor-mac/conectar-desde-ubuntu.sh --check
```

Lo que sigue es lo mismo, paso a paso y a mano.

---

## 1. Tailscale en la Ubuntu (una sola vez)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

`tailscale up` imprime un link: abrilo en el navegador y **logueate con la
misma cuenta** con la que está la Mac. Después:

```bash
tailscale status
```

Tiene que aparecer `macs-macbook-air` en la lista. Desde ese momento la Mac se
alcanza desde cualquier lugar del mundo, sin abrir nada en el router.

## 2. Comprobar que el servidor está vivo

Lo más rápido es el navegador: abrí http://100.82.224.88:5678. Si carga n8n,
la Mac está despierta y en la red — el resto de los servicios también van a
andar.

Desde la terminal:

```bash
tailscale ping 100.82.224.88
curl -sI http://100.82.224.88:54321/auth/v1/health | head -1
```

## 3. SSH

```bash
ssh croman@100.82.224.88
```

La contraseña es la de la Mac.

**Si responde `Connection refused`**, SSH todavía está apagado en la Mac. Eso
no se puede arreglar desde Ubuntu: hay que ir una vez hasta la Mac y correr en
su Terminal

```bash
sudo bash "/Users/croman/Desktop/SERVIDOR MAC/configurar-servidor.sh"
```

o activarlo a mano en **Ajustes → General → Compartir → Sesión remota**.

**Si SSH ya entra**, el resto de la configuración pendiente de la Mac (no
dormir con la tapa cerrada, prenderse sola tras un corte, compartir pantalla)
se corre remoto y no hace falta levantarse:

```bash
ssh -t croman@100.82.224.88 'sudo bash "/Users/croman/Desktop/SERVIDOR MAC/configurar-servidor.sh"'
```

El `-t` es necesario: sin terminal asignada, `sudo` no puede pedir la
contraseña.

## 4. No escribir más la contraseña

```bash
ssh-keygen -t ed25519            # solo si todavía no tenés llave
ssh-copy-id croman@100.82.224.88
```

Y un alias, para escribir `ssh mac` en vez de la IP — agregá esto a
`~/.ssh/config`:

```
Host mac
    HostName 100.82.224.88
    User croman
    ServerAliveInterval 30
```

## 5. Ver la pantalla de la Mac (VNC)

```bash
sudo apt install -y remmina remmina-plugin-vnc
```

Remmina → nueva conexión → protocolo **VNC** → servidor `100.82.224.88`,
usuario `croman`, contraseña la de la Mac. Guardala como favorita.

Requiere Compartir pantalla activo en la Mac (lo prende el mismo script del
paso 3).

## 6. Pasar archivos

Nautilus (app "Archivos") → *Otras ubicaciones* → escribí
`sftp://croman@100.82.224.88` y queda montado como una carpeta más. Usa el
mismo SSH, no hay nada extra que configurar.

## 7. Editar código que vive en la Mac

VS Code o Cursor con la extensión **Remote - SSH** → *Connect to Host* →
`croman@100.82.224.88`. Abrís `~/Desktop/AGENDAMIENTO` como si fuera local, con
la terminal integrada corriendo en el servidor.

---

## 8. Apuntar Agendik al Supabase de la Mac

Esto es lo que te ahorra levantar Docker en la Ubuntu: la base ya está corriendo
en la Mac, y la app solo cambia de URL.

Primero, la anon key — se la pedís al servidor por SSH:

```bash
ssh croman@100.82.224.88 'cd ~/Desktop/AGENDAMIENTO && npx supabase status'
```

Después, en el repo clonado en tu Ubuntu:

```bash
./scripts/connect-supabase.sh http://100.82.224.88:54321 <anon-key> estudio-alma
npm install && npm run dev
```

`connect-supabase.sh` verifica que el servidor responda, que la key sirva y que
el esquema esté instalado antes de escribir el `.env`. Si te dice que falta la
tabla `tenants`, abrí Supabase Studio en http://100.82.224.88:54323 y ejecutá
el contenido de `supabase/install.sql` en el SQL Editor.

**Esto sirve para desarrollo, no para producción.** `100.82.224.88` es una IP
de Tailscale: solo existe dentro de tu red privada. El deploy de Vercel no está
en la red y el navegador de un cliente tampoco, así que la app publicada nunca
puede apuntar ahí. Para producción va el Supabase de la nube o el VPS de
[`deploy/`](../../deploy/README.md).

---

## Cuando algo no anda

| Síntoma | Qué pasa | Qué hacer |
|---|---|---|
| `tailscale status` no lista `macs-macbook-air` | La Mac está apagada, sin sesión iniciada, o Tailscale no arrancó ahí | Ver punto siguiente |
| Ningún puerto responde, pero la Mac aparece en la lista | Se cortó la luz y quedó esperando la contraseña de FileVault en la pantalla de arranque | Hay que ir hasta la Mac y escribirla una vez. Hasta entonces no arranca ningún servicio |
| SSH da `Connection refused` | Sesión remota apagada | Paso 3: correr el script en la Mac una vez |
| VNC da `Connection refused` | Compartir pantalla apagado | Ídem — es el mismo script |
| n8n / CRM / Studio no cargan pero SSH sí | Se cayó algún contenedor | `ssh mac 'docker ps'` y `ssh mac 'docker restart <nombre>'` |
| Todo lento o servicios que mueren solos | 8 GB de RAM y disco al 94% | `ssh mac 'df -h /System/Volumes/Data'` y `ssh mac 'docker system df'`. Conviene mantener +20 GB libres |
| `Host key verification failed` | Se reinstaló el sistema de la Mac o cambió la llave | `ssh-keygen -R 100.82.224.88` y volver a entrar |
| El nombre `macs-macbook-air` no resuelve | MagicDNS no está tomando en Ubuntu | Usar la IP `100.82.224.88`, que nunca cambia |

Comandos de diagnóstico rápido, desde Ubuntu:

```bash
ssh mac 'docker ps --format "table {{.Names}}\t{{.Status}}"'
ssh mac 'docker logs --tail 50 n8n-n8n-1'
ssh mac 'df -h /System/Volumes/Data'
```
