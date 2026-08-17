# Agendik multi-negocio (SaaS) — Diseño

**Fecha:** 2026-08-16
**Estado:** aprobado, pendiente de plan de implementación

## Objetivo

Convertir Agendik de una app de un solo negocio a un SaaS donde el **dueño de la
plataforma** (el usuario, `rey.asocia@gmail.com`) da de alta varios negocios. Cada
negocio tiene su propia agenda, clientes, servicios y horarios, y un portal público
propio en `agendik.vercel.app/n/<slug>`. El dueño de cada negocio entra con una
contraseña temporal que le pasa el dueño de la plataforma.

## Contexto actual

El esquema ya es multi-tenant: todas las tablas tienen `tenant_id` y las políticas RLS
filtran por negocio. Pero en runtime la app es de un solo negocio:

- `VITE_DEFAULT_TENANT=estudio-alma` está fijo; `fetchTenant()` siempre trae ese negocio.
- El portal público no sabe distinguir negocios.
- Las funciones de seguridad `current_tenant_id()`, `current_client_id()`, `is_staff()`
  resuelven **un** negocio por usuario (`limit 1` / `exists`). Este diseño **preserva**
  esa invariante: un usuario sigue perteneciendo a un solo negocio, así que esas
  funciones no cambian y el aislamiento reparado en `0008`/`0009` se mantiene.

Auditoría reciente (Strix + Gemini, migraciones `0008`/`0009`) cerró las vulnerabilidades
cross-tenant. Con multi-tenant activo de verdad, esas defensas pasan a ser críticas y se
re-auditan en la fase final.

## Alcance

**Incluye:**
- Rol nuevo: dueño de plataforma.
- Alta de negocios (con su dueño) desde una pantalla, vía un RPC.
- Resolución del negocio por path `/n/:slug` en el portal público.
- Pantalla "Negocios" para el dueño de plataforma.
- Re-auditoría del aislamiento con multi-tenant activo.

**No incluye (YAGNI, se puede sumar después):**
- Branding por negocio (logo, colores).
- Subdominios o dominios propios por negocio.
- Planes, facturación, límites de uso.
- Que un mismo usuario administre varios negocios (selector de negocio activo).

## Modelo de datos

Un solo objeto nuevo:

```sql
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- sin políticas de escritura: solo se toca por SQL directo o por funciones definer.

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
```

`rey.asocia@gmail.com` se inserta como el primer (y por ahora único) dueño de plataforma.

Ningún cambio de columnas en `tenants`, `staff`, `clients`. `tenants.slug` ya es
`not null unique` (`0001_schema.sql`), que es lo que el portal público necesita para
resolver por slug: no hace falta tocar el esquema existente.

## Alta de un negocio

RPC `security definer`, solo llamable por el dueño de plataforma:

```
create_business(p_slug text, p_business_name text, p_phone text, p_owner_email text)
  returns json  -- { tenant_id, owner_password }
```

Pasos dentro del RPC:
1. `if not is_platform_admin() then raise ...` (nadie más lo puede llamar).
2. Validar `slug` (formato `[a-z0-9-]+`, único) y que `p_owner_email` no exista ya.
3. Insertar el negocio en `tenants`.
4. Crear la cuenta del dueño en `auth.users` + `auth.identities` con una **contraseña
   temporal** generada (letras/números fáciles de dictar), `email_confirmed_at = now()`.
5. Insertar su ficha en `staff` con `role = 'owner'` y el `tenant_id` nuevo.
6. Devolver `{ tenant_id, owner_password }` para que el dueño de plataforma se la pase.

**Riesgo técnico principal:** crear un usuario de `auth` desde SQL (en vez de la Admin
API de GoTrue) exige replicar bien el esquema de `auth.users` + `auth.identities`
(campos `aud`, `role`, `raw_app_meta_data`, `provider_id`, `identity_data`). Si el login
del usuario así creado fallara, **plan B**: el RPC crea el negocio con un registro de
"invitación de dueño" (email pendiente) y el dueño se registra por `/n/:slug` con ese
email; al registrarse, un `claim` (como el `claim_client_record` existente) lo convierte
en owner. Se valida en implementación cuál de los dos funciona contra el GoTrue del
servidor antes de fijar el enfoque.

## Resolución del negocio (frontend)

Reemplazar el `DEFAULT_TENANT` fijo por resolución dinámica:

- **Portal público** (`/n/:slug/...` o `/n/:slug`): un `TenantProvider` lee el `slug` del
  path, resuelve el negocio (`select ... from tenants where slug = :slug`) y lo expone al
  árbol. Todas las consultas públicas (servicios, profesionales, disponibilidad, reserva)
  usan ese `tenant_id`. Si el slug no existe → página "negocio no encontrado".
- **Cliente/staff logueado**: el negocio sigue saliendo de su ficha (`fetchClient` /
  `fetchStaff` ya devuelven `tenant_id`). Se elimina la dependencia de `fetchTenant()` del
  `DEFAULT_TENANT`; el tenant del usuario logueado es el de su ficha.
- `estudio-alma` deja de ser especial: es un negocio más en `/n/estudio-alma`.

Rutas (React Router):
- `/n/:slug` → landing/portal público del negocio.
- `/n/:slug/ingresar`, `/n/:slug/reservar`, etc. → flujo del cliente dentro del negocio.
- `/plataforma` → pantalla del dueño de plataforma (fuera del scope de un negocio).
- Las rutas de admin del negocio (`/agenda`, `/clientes`, …) se mantienen; el owner ya
  resuelve su tenant por su ficha.

Compatibilidad de la raíz `/`: se mantiene una variable `VITE_DEFAULT_TENANT` usada
**solo** como destino de la redirección de la raíz. `/` redirige a `/n/<VITE_DEFAULT_TENANT>`
(hoy `estudio-alma`), para no romper los marcadores ni el link que ya circula. Deja de
usarse para resolver el negocio en cualquier otro lugar del código.

## Pantalla "Negocios"

Sección visible solo si `is_platform_admin()`:
- Lista de negocios (`tenants`): nombre, slug, link `/n/<slug>`, fecha de alta.
- Botón "Nuevo negocio" → modal con nombre, slug (autogenerado del nombre, editable),
  teléfono y email del dueño. Al guardar, llama `create_business` y muestra la contraseña
  temporal en pantalla para copiar (igual que el modal de contraseña de cliente).
Reutiliza los componentes `Modal`, `Field`, `Spinner` existentes.

## Seguridad

- `create_business` y toda escritura de plataforma pasan por `is_platform_admin()`.
- Se preserva un-negocio-por-usuario, así que `current_tenant_id()`/`is_staff()` no
  cambian y el aislamiento cross-tenant reparado sigue vigente.
- El portal público por slug solo expone lo que las políticas públicas ya permiten
  (tenants: select público; services/professionals/working_hours: select para
  authenticated/anon según corresponde). No se relaja ninguna política.
- Re-auditoría con Strix al final, con dos negocios reales cargados, apuntando a fugas
  entre negocios y a la creación de usuarios.

## Orden de implementación (fases verificables)

1. **Base de plataforma:** tabla `platform_admins`, `is_platform_admin()`, marcar al
   usuario como dueño de plataforma. Verificar que la función responde bien.
2. **Alta de negocios:** RPC `create_business` (resolviendo el enfoque de creación de
   usuario contra el GoTrue real) + pantalla "Negocios". Verificar creando un negocio de
   prueba y logueándose como su dueño con la contraseña temporal.
3. **Resolución por path:** `TenantProvider` + rutas `/n/:slug`, quitar `DEFAULT_TENANT`.
   Verificar que un cliente reserva en el negocio nuevo y que no ve datos del otro.
4. **Re-auditoría:** correr Strix con dos negocios cargados; cerrar lo que aparezca.

Cada fase es una migración/PR chico y verificable. Los negocios "cobran vida" recién en la
fase 3; hasta entonces se prueban por API/consola.

## Verificación

- Unit/manual por fase (arriba).
- Prueba de aislamiento explícita: crear negocio B, un cliente de B no ve ni toca datos de
  A (y viceversa), un owner de A no administra B.
- Prueba del alta: la contraseña temporal permite entrar y luego se puede cambiar.
- Limpieza: los negocios y usuarios de prueba se borran por SQL al terminar cada fase.

## Riesgos

- **Creación de usuario desde SQL** (ver plan B arriba) — el mayor. Se valida temprano en
  la fase 2.
- **Romper el acceso actual** al quitar `DEFAULT_TENANT`: `estudio-alma` y sus usuarios ya
  en producción tienen que seguir entrando. La fase 3 mantiene compatibilidad redirigiendo
  la raíz y resolviendo el tenant del usuario por su ficha.
- **Re-aparición de fugas cross-tenant** con multi-tenant activo: mitigado preservando la
  invariante un-negocio-por-usuario y re-auditando al final.
