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

Arranca en `http://localhost:5173` en modo demo. Para apuntar a Supabase, copiá
`.env.example` a `.env` y completá las dos variables.

---

## Conectar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecutá en orden:
   - `supabase/migrations/0001_schema.sql` — tablas, índices y la restricción anti-solapamiento
   - `supabase/migrations/0002_rls.sql` — row level security
   - `supabase/migrations/0003_functions.sql` — RPC de paquetes y acciones por token
   - `supabase/seed.sql` — un negocio de ejemplo con catálogo, profesionales y horarios
3. En **Project Settings → API**, copiá `Project URL` y la clave `anon public`.
4. Poné esos valores en `.env` (local) y en las variables de entorno de Vercel.

Para que el alta de cuenta funcione sin confirmar email, desactivá
*Authentication → Providers → Email → Confirm email* en Supabase. Con la
confirmación activa, la ficha de cliente se crea recién en el primer login.

### Por qué la agenda no se puede sobrevender

`appointments` tiene una restricción de exclusión GiST: un profesional no puede
tener dos citas vivas cuyos rangos horarios se toquen. Si dos personas eligen el
mismo hueco al mismo tiempo, la segunda inserción falla en Postgres —no en el
frontend— y la app le pide elegir otro horario. La validación del cliente es
comodidad; la garantía está en la base.

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
