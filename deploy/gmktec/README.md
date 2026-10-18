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
| Respaldo nocturno 03:45 | `agendik-respaldo.timer` → `~/backups/agendik` (14 días: dump + `.env`) |

Contenedores: `ag-db` (Postgres 17), `ag-auth` (GoTrue), `ag-rest` (PostgREST), `ag-functions` (edge-runtime, corre `notificar`),
`ag-meta` + `ag-studio`, `ag-api-gw` (Envoy), `ag-edge` (Caddy). Sin realtime ni storage: la app no los usa.

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

## Pendiente de configurar (no bloquea el uso)

1. **Correo de aviso de citas** (`notificar`): cargar `BREVO_API_KEY` y `BREVO_SENDER` en `.env` y `docker compose --env-file .env up -d functions`.
2. **Correo de Auth** (recuperar contraseña): hoy `SMTP_HOST=localhost`, sin envío. Cargar el SMTP de Brevo (`smtp-relay.brevo.com`, 587) en
   `SMTP_*` y recién ahí pasar `ENABLE_EMAIL_AUTOCONFIRM=false` si se quiere exigir confirmación.
3. **DNS:** `agendik.botika.lat` CNAME → `f34b2846-6f4a-42f5-b530-94f952a37895.cfargotunnel.com` (con proxy) en la zona `botika.lat`.

## Notas

- Las claves de la API (anon y service) vencen el 2036-10-15; el service_role vive solo en el `.env` del servidor.
- El túnel `botika-gmktec` lo comparte Botika (staging): reiniciarlo corta unos segundos a los dos.
