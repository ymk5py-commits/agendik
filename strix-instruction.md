# Auditoría de seguridad — Agendik (portal de agendamiento de citas)

Es una SPA React (Vite) sobre Supabase self-hosted (Postgres + GoTrue + PostgREST).
No hay backend propio: **toda la seguridad vive en la base**, en políticas RLS y en
funciones `security definer`. El cliente habla con Supabase directo desde el navegador
con la clave pública (anon). Cualquiera puede leer el bundle y llamar a la API con esa
clave, así que la garantía real tiene que estar en Postgres, no en el frontend.

## Dónde mirar con más cuidado

1. **Políticas RLS** (`supabase/migrations/0002_rls.sql`, `0004_admin.sql`,
   `0005_admin_write.sql`, `0006_staff_profile.sql`): buscá si un cliente autenticado
   puede leer o modificar datos de OTRO cliente o de OTRO tenant. Multi-tenant: el
   aislamiento entre negocios (`tenant_id`) es crítico. ¿Hay alguna tabla con RLS
   habilitado pero sin política que la cubra, o un `grant` más amplio que sus políticas?

2. **Funciones `security definer`** (`0003_functions.sql`, `0004_admin.sql`,
   `0005_admin_write.sql`, `0007_admin_client_password.sql`): corren con privilegios
   elevados. Verificá `search_path` fijo, que validen permisos ellas mismas
   (`is_staff()`, `current_tenant_id()`), y que no permitan escalar privilegios,
   tocar `auth.users` de otro, ni saltar el aislamiento de tenant. `admin_set_client_password`
   cambia contraseñas: ¿puede un empleado usarla contra el dueño u otro tenant?

3. **Acciones por token** (`get_appointment_by_token`, `act_on_appointment_by_token`):
   son accesibles por `anon`. ¿El token es adivinable/enumerable? ¿Filtra datos de la cita
   a cualquiera que tenga el link? ¿Permite actuar sobre citas ajenas?

4. **Manejo de la clave anon vs service_role**: confirmá que ninguna variable `VITE_*`
   contenga secretos (service_role, secret key). Vite publica todo `VITE_*` en el bundle.

5. **Frontend** (`src/`): XSS (render de datos del usuario), validación que solo vive en
   el cliente y no en la base, control de acceso a rutas de admin (`/agenda`, `/clientes`,
   etc.) que dependa solo de React y no de RLS.

## Qué entregar

Por cada hallazgo: severidad, archivo y línea, cómo se explota, y el fix concreto
(idealmente el SQL o el diff). Priorizá lo que rompe el aislamiento entre clientes o
entre negocios, y la escalada de privilegios cliente → staff/owner.
