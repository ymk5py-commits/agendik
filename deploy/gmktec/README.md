# Agendik en gmktec

Producción de Agendik en el servidor personal (mini PC GMKtec). Stack propio de Supabase, **independiente** de los demás
(Botika `bt-*`, Workspace `ws-*`, Aura, Novudent): su base, sus claves y su `auth.users`. No se comparte porque Agendik crea una
ficha de cliente con un trigger sobre `auth.users` y tiene tablas que chocarían con las de otras apps (`profiles`, `bookings`…).

**URL:** https://agendik.botika.lat → Cloudflare → túnel `botika-gmktec` → `127.0.0.1:3210` (borde Caddy).

## Qué hay

| Pieza | Dónde |
|---|---|
| Código (copia de trabajo, la sincroniza `desplegar.sh`) | `~/CROMAN/AGENDIK` |
| Stack (compose `agendik-sb`, contenedores `ag-*`), `.env`, datos | `~/CROMAN/AGENDIK-INFRA` |
| Borde Caddy: portal estático + `/auth/v1`, `/rest/v1`, `/functions/v1` | `127.0.0.1:3210` |
| Gateway Envoy → **Studio** (admin de la base) | `127.0.0.1:3211` (usuario y clave en `.env`) |
| Túnel | regla `agendik.botika.lat` en `~/.cloudflared/botika.yml` · servicio de usuario `cloudflared-botika` |
| Bandeja de correos capturados (**Mailpit**) | `127.0.0.1:3212` (túnel SSH o Tailscale) |
| Cron del correo: cada minuto vacía la cola por SMTP | `agendik-correo.timer` → `docker compose run --rm correo` |
| Respaldo nocturno 03:45 | `agendik-respaldo.timer` → `~/backups/agendik` (14 días: dump + `.env`) |

Contenedores: `ag-db` (Postgres 17), `ag-auth` (GoTrue), `ag-rest` (PostgREST), `ag-functions` (edge-runtime, corre `notificar`),
`ag-mailpit` (SMTP de captura), `ag-meta` + `ag-studio`, `ag-api-gw` (Envoy), `ag-edge` (Caddy), más el worker `correo` (no queda levantado: lo lanza el timer). Sin realtime ni storage: la app no los usa.

## Operar

```bash
./deploy/gmktec/desplegar.sh            # desde la Mac: sincroniza, levanta, migra y recompila el portal
ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && python3 probar-flujo.py'   # prueba de humo (registro, reserva, anti-sobreventa, notificar…)
ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && docker compose --env-file .env logs -f auth'
ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && ./respaldo/respaldar.sh'    # respaldo a mano
```

- **Migraciones nuevas:** agregá `supabase/migrations/00NN_*.sql` y corré `desplegar.sh`; `migrar.sh` aplica solo las que faltan
  (las anota en `agendik_ops.migraciones`). `supabase/install.sql` NO se usa acá (se regenera con `scripts/build-install-sql.sh`).
- **Studio:** `ssh -L 3211:127.0.0.1:3211 gmktec` y abrir http://127.0.0.1:3211 (o por Tailscale, `gmktec-remoto`).
- **Las variables `VITE_*` se hornean al compilar:** si cambia la URL, la clave o el negocio por defecto, volver a correr `desplegar.sh`.
- **Restaurar:** `docker exec -i ag-db pg_restore -U postgres -d postgres --clean --if-exists --no-owner < agendik-XXXX.dump`
  (el `.env` del mismo respaldo tiene las claves con las que se firmaron los tokens).

## Origen de los datos

La base original estaba en un proyecto de Supabase cloud (`wreyweyqtanmzaaeznwk`) que **ya no existe** (su dominio da NXDOMAIN al 18-oct-2026) y Vercel
no guardaba ninguna conexión a Postgres, así que no hubo nada que migrar: el stack arrancó con las migraciones + `supabase/seed.sql` (negocio demo
`estudio-alma`). Si aparece un dump viejo, restaurarlo con `pg_restore` sobre una base vacía (ver «Restaurar»).

## Primer administrador de la plataforma

La app no permite darse de alta como dueño de la plataforma (es una operación de fundación). Pasos:
1. La persona se registra en https://agendik.botika.lat con su email y su propia contraseña.
2. `ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && ./crear-admin-plataforma.sh persona@correo.com'`
3. Al volver a entrar le aparece «Negocios» y desde ahí da de alta cada negocio (`/n/<slug>` es su portal).

## Correo (sin servicios de pago)

Nada depende de Brevo ni de ningún proveedor externo.

- **Avisos de citas** (crear/confirmar/reprogramar/cancelar): `notificar` valida de quién es la cita, arma el mail y lo deja en la tabla
  `cola_correos` (migración 0017). El **timer `agendik-correo`** corre cada minuto el worker `correo/enviar.py`, que lo envía por SMTP,
  con reintentos (espera de 2, 8, 18 y 32 min; a la quinta queda `fallido`) y sin duplicados.
- **Recuperar contraseña / confirmación**: GoTrue manda directo por el mismo SMTP (variables `SMTP_*` del `.env`: un solo lugar para configurar).
- **Por defecto es modo captura**: `SMTP_HOST=mailpit`. Los mails se arman, se «envían» y se leen en Mailpit
  (`ssh -L 3212:127.0.0.1:3212 gmktec` → http://127.0.0.1:3212); **no sale nada del servidor** hasta que cargues un SMTP real.
- **Cargar un SMTP real** (desde tu Terminal de la Mac; la contraseña no pasa por el chat ni por la línea de comandos):
  `./deploy/gmktec/poner-smtp.sh` — pide servidor, puerto, usuario, contraseña y remitente, reinicia GoTrue y puede mandar un mail de prueba por la cola.
  Sirve para cualquier SMTP: el de tu app de reenvío o un Postfix propio, o una cuenta gratuita (p. ej. Gmail con «contraseña de aplicación»:
  `smtp.gmail.com`, `587`, tu correo, remitente = ese mismo correo; el límite gratuito ronda los 500 mails por día).
- **Un Postfix directo desde este servidor no es buena idea**: la IP (181.91.87.249) tiene el reverso genérico de proveedor residencial
  (`…ptr.personal.net.py`), así que Gmail/Outlook lo mandarían a spam o lo rechazarían, aunque los puertos de salida estén abiertos.
  Conviene que ese Postfix/app de reenvío **retransmita por una cuenta que sí tenga reputación** (la de Gmail, por ejemplo).
- **Probar a mano:** `ssh gmktec 'cd ~/CROMAN/AGENDIK-INFRA && ./correo/probar-envio.sh alguien@correo.com'` (mismo camino que un aviso real).
- **Ver la cola:** `select estado, count(*) from public.cola_correos group by 1;` · los `fallido` quedan con `ultimo_error`.
- **¿Preferís que lo programe Hermes?** El cron es solo el comando `docker compose --env-file .env run --rm -T correo` (carpeta `~/CROMAN/AGENDIK-INFRA`);
  se puede registrar como job `no_agent` de Hermes y desactivar el timer (`systemctl --user disable --now agendik-correo.timer`). Hoy no hace falta.

## Pendiente de configurar (no bloquea el uso)

1. **SMTP real**: hasta cargarlo, ningún mail llega a clientes (quedan en Mailpit). Ver «Correo».
2. **DNS:** `agendik.botika.lat` CNAME → `f34b2846-6f4a-42f5-b530-94f952a37895.cfargotunnel.com` (con proxy) en la zona `botika.lat`.
3. **Con SMTP real cargado:** pasar `ENABLE_EMAIL_AUTOCONFIRM=false` solo si querés exigir confirmación de email al registrarse.

## Notas

- Las claves de la API (anon y service) vencen el 2036-10-15; el service_role vive solo en el `.env` del servidor.
- El túnel `botika-gmktec` lo comparte Botika (staging): reiniciarlo corta unos segundos a los dos.
