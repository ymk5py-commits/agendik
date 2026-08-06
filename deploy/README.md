# Agendik · backend en tu propio servidor

Supabase self-hosted, recortado a lo que la app realmente usa: Postgres, auth
(GoTrue) y la API REST (PostgREST), con Caddy haciendo de gateway y resolviendo
el certificado. Sin Kong, analytics, storage ni realtime — en un VPS chico son
RAM gastada, y analytics ya nos tiró abajo el stack entero en local.

Sirve para no depender del marketplace ni de una cuenta en supabase.com. La app
**no cambia**: es el mismo stack, solo cambia la URL.

## Antes de empezar

- Docker con el plugin `compose`.
- Puertos **80 y 443 abiertos**. El 80 lo necesita Let's Encrypt para validar.
- Un hostname que resuelva al servidor. El que da Hostinger sirve
  (`srv1834489.hstgr.cloud`), no hace falta comprar dominio.
- Unos 2 GB de RAM libres.

## Instalar

Copiá el repo al servidor y corré:

```bash
cd agendamiento/deploy && ./setup.sh srv1834489.hstgr.cloud https://agendik.vercel.app
```

El script genera secretos **nuevos** (jamás los de demo, que son públicos y
están documentados), levanta el stack, crea los roles `anon`, `authenticated` y
`service_role`, aplica las tres migraciones y el seed, y verifica que el TLS
responda desde afuera. Al final imprime las dos variables para Vercel.

## Después

Cargá en Vercel (producción) lo que imprimió y redesplegá:

```bash
vercel env add VITE_SUPABASE_URL production && vercel env add VITE_SUPABASE_ANON_KEY production && vercel --prod
```

Creá tu usuario desde la propia app, en "Crear cuenta".

## Cuidados

- El `service_role` vive solo en el `.env` del servidor (chmod 600). Nunca va al
  frontend: se saltea RLS por completo.
- Postgres no publica el puerto 5432 — solo se lo alcanza desde la red interna
  de Docker. Para entrar a la base: `docker compose exec db psql -U postgres`.
- `GOTRUE_MAILER_AUTOCONFIRM` está en `true` porque no hay SMTP configurado. Si
  cargás un servidor de correo, pasalo a `false` para exigir confirmación.
- Respaldo: `docker compose exec -T db pg_dump -U postgres > backup.sql`.
