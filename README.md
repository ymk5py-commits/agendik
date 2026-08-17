# Agendik

Portal de agendamiento de citas para centros de estética, spas y salones.
El cliente entra con su email, reserva en cuatro pasos, sigue sus paquetes
contratados y confirma o cancela desde el link que le llega por email o WhatsApp.

**Stack:** React 18 · Vite · Tailwind CSS 3 · Supabase (Postgres + Auth) · Vercel

---

## Modo demo vs. producción

La app tiene un solo punto de acceso a datos ([`src/api/backend.js`](src/api/backend.js))
con dos implementaciones que exponen la misma interfaz:

| | Sin variables de entorno | Con `VITE_SUPABASE_*` |
|---|---|---|
| Backend | `demoBackend` — localStorage | `supabaseBackend` — Postgres |
| Datos | Semilla de ejemplo en el navegador | Base real, multi-negocio |
| Auth | Usuario de prueba | Supabase Auth (JWT) |

La implementación se resuelve por importación dinámica al primer uso, así el SDK de
Supabase (57 kB gzip) no entra en el bundle inicial. En un build de demo el
tree-shaking lo elimina por completo.

**Cuenta de la demo:** `demo@agendik.app` / `agendik123`

---

## Correrlo localmente

```bash
npm install && npm run dev
```

Arranca en `http://localhost:5180` en modo demo (datos de muestra en el navegador,
sin backend). Para trabajar contra una base de verdad, seguí la sección de abajo.

---

## Base de datos local

Supabase corre entero en tu máquina con Docker: Postgres, auth y la API REST. Es
el mismo stack que en la nube, así que la app no cambia — solo apunta a otra URL.
No hace falta cuenta ni tarjeta.

Requisitos: Docker Desktop abierto.

```bash
npm run db:start
```

La primera vez baja unos GB de imágenes. Al terminar imprime las credenciales;
poné las dos que usa la app en tu `.env`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<el ANON_KEY que imprimió>
VITE_DEFAULT_TENANT=estudio-alma
```

Las migraciones y el seed se aplican solos al levantar. Para tener un usuario con
citas y un paquete ya cargados:

```bash
npm run db:seed     # demo@agendik.app / agendik123
```

| Comando | Qué hace |
|---|---|
| `npm run db:start` | Levanta el stack |
| `npm run db:stop` | Lo apaga |
| `npm run db:reset` | Rehace la base desde las migraciones + seed + usuario demo |
| `npm run db:studio` | Abre Supabase Studio en el navegador |

Studio queda en `http://127.0.0.1:54323` para mirar y editar los datos a mano, y
los emails que manda la app se ven en Mailpit, `http://127.0.0.1:54324`.

**Dos cosas que te van a pasar y no son bugs:**

- Después de un `db:reset`, el primer login puede fallar unos segundos con
  *"No pudimos cargar tu perfil"*. La API responde `PGRST303: JWT issued at future`
  mientras los contenedores de auth terminan de reiniciar. Esperá unos segundos y
  reintentá.
- Un `db:reset` borra los usuarios, pero el navegador conserva la sesión vieja y
  su token ya no vale. Si la app queda en un estado raro, limpiá el
  `localStorage` del sitio o entrá en una ventana de incógnito.

El `config.toml` tiene apagados `analytics`, `storage` y `realtime`: la app no los
usa y `analytics` arrastraba a los demás contenedores a estado *unhealthy*.

---

## Conectar Supabase en la nube

### Vía Vercel (recomendado)

```bash
vercel integration add supabase --name agendik-db
```

El comando abre el navegador para aprobar los términos y elegir el plan — ese paso
lo tiene que hacer una persona, no se puede automatizar. Cuando termine:

```bash
./scripts/setup-supabase.sh
```

Ese script hace todo lo demás solo: trae las credenciales que generó Vercel, aplica
las tres migraciones y el seed, publica `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`,
y redespliega producción.

### A mano

Sirve igual para un proyecto en la nube o para uno self-hosted (Supabase en tu
propio servidor). Lo único que cambia es la URL.

1. Creá el proyecto, o pedí los datos de uno existente.
2. En el **SQL Editor**, pegá y ejecutá `supabase/install.sql`. Es todas las
   migraciones más el seed en un solo archivo, en orden, y se puede correr más
   de una vez sin romper nada. Ese archivo se regenera con
   `./scripts/build-install-sql.sh` cada vez que agregás una migración.
3. Conectá la app:

```bash
./scripts/connect-supabase.sh https://TU-PROYECTO.supabase.co sb_publishable_...
```

El script verifica que el servidor responda, que la key sirva y que el esquema
esté instalado — recién entonces escribe el `.env` (y guarda backup del anterior).
Si algo falla, te dice exactamente qué.

4. Para producción, cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las
   variables de entorno de Vercel y redesplegá.

**Qué key va en el `.env`:** la pública. En proyectos nuevos se llama
*publishable key* (`sb_publishable_...`), en los viejos *anon key* (`eyJhbG...`).
Es pública por diseño: viaja al navegador y está limitada por RLS.

**Qué key NO va nunca:** la *secret key* (`sb_secret_...`) o `service_role`.
Saltean todas las políticas de seguridad, y Vite mete las variables `VITE_*`
dentro del JavaScript que descarga cualquier visitante. `connect-supabase.sh`
se niega a escribirla.

Para que el alta de cuenta funcione sin confirmar email, desactivá
*Authentication → Providers → Email → Confirm email* en Supabase. Con la
confirmación activa, la ficha de cliente se crea recién en el primer login.

### El negocio le cambia la contraseña a un cliente

Sin servidor de correo no hay "olvidé mi contraseña" posible, así que el equipo
lo resuelve desde el panel: en cada cliente que ya entra al portal aparece un
botón de llave (`/clientes`). La contraseña la decide el negocio y se la pasa
a la persona: no le llega ningún mail.

Cambiar la clave de otro usuario necesita privilegios que no pueden vivir en el
navegador (la `service_role` terminaría en el bundle de Vite). Por eso va por una
función `security definer` en Postgres —`admin_set_client_password`— que primero
comprueba, ella misma, que quien llama es del equipo y que el cliente es de su
mismo negocio. Nunca deja tocar la contraseña de otro miembro del equipo, y al
cambiarla cierra las sesiones abiertas de ese cliente.

### Por qué la agenda no se puede sobrevender

`appointments` tiene una restricción de exclusión GiST: un profesional no puede
tener dos citas vivas cuyos rangos horarios se toquen. Si dos personas eligen el
mismo hueco al mismo tiempo, la segunda inserción falla en Postgres —no en el
frontend— y la app le pide elegir otro horario. La validación del cliente es
comodidad; la garantía está en la base.

Las cuatro migraciones se verificaron corriéndolas contra PostgreSQL 16 real,
comprobando que: el solapamiento del mismo profesional se rechaza, dos citas
pegadas (11:00 después de 10:00–11:00) sí entran, una cita cancelada libera su
horario, el seed es idempotente, y un cliente no alcanza los datos de otro.

### Qué protege RLS

Un cliente autenticado solo ve su propia ficha, sus paquetes y sus citas, y solo
el catálogo del negocio al que pertenece. Al crear una cita solo puede hacerlo
para sí mismo, en estado `reserved` y con fecha futura; al modificarla, solo puede
confirmarla o cancelarla. Nada de esto depende del frontend.

El link público de confirmación no lee tablas directamente: pasa por
`get_appointment_by_token` y `act_on_appointment_by_token`, funciones
`security definer` que exponen solo los campos necesarios y validan el
vencimiento del token.

---

## Deploy en Vercel

El `vercel.json` incluye el rewrite `/(.*) → /index.html`, necesario para que
recargar sobre `/mis-citas` o `/perfil` no tire 404.

```bash
vercel --prod
```

Cargá `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_DEFAULT_TENANT` en
las variables de entorno del proyecto. Sin ellas el deploy funciona igual, en
modo demo.

---

## Estructura

```
src/
├─ api/          backend.js (selector) + demoBackend + supabaseBackend
├─ components/   ui/ · layout/ · booking/ (los 4 pasos del wizard)
├─ context/      AuthContext
├─ data/         semilla demo + cálculo de slots (compartido por ambos backends)
├─ hooks/        useAsync
├─ pages/        Landing · Login · Dashboard · BookAppointment · MyAppointments
│                Profile · AppointmentAction
└─ utils/        formato de fechas/moneda · estados de cita
supabase/        migrations/ + seed.sql
```

`src/data/slots.js` calcula los horarios libres a partir de los horarios de
trabajo y las citas existentes. Lo usan los dos backends, así que la demo y la
producción entregan exactamente la misma disponibilidad.

---

## Diseño

Marca propia: verde petróleo (`primary`) con acento ámbar (`accent`) sobre
neutros cálidos (`sand`). Tipografía **Bricolage Grotesque** para títulos e
**Instrument Sans** para el cuerpo.

Decisiones que sostienen la calidad visual y de uso:

- Áreas táctiles de 44 px como mínimo en toda la navegación, el calendario y los horarios.
- Contraste AA en ambos modos; el color nunca es el único indicador de estado.
- Foco visible en todo elemento interactivo y `prefers-reduced-motion` respetado.
- Números tabulares en horarios, precios y contadores para que no bailen.
- Cada pantalla con un solo CTA primario.
