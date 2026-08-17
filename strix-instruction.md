# Auditoría de seguridad — Agendik, ahora multi-negocio (SaaS)

SPA React (Vite) sobre Supabase self-hosted. **No hay backend propio**: el navegador habla
directo con Postgres vía PostgREST usando la clave pública (anon), así que toda la
seguridad vive en la base — políticas RLS y funciones `security definer`. Cualquiera puede
leer el bundle y llamar la API con esa clave: ocultar cosas en el frontend no protege nada.

La app pasó de un solo negocio a **varios negocios en la misma instalación**. Ese cambio es
el foco de esta auditoría.

## Modelo de permisos (lo que hay que romper)

- **Cliente**: pertenece a UN negocio (`clients.tenant_id`). Solo debe ver lo suyo.
- **Staff / owner**: pertenece a UN negocio (`staff.tenant_id`). Administra solo ese.
- **Dueño de la plataforma** (`platform_admins`): puede crear negocios. Está por encima.
- Invariante que sostiene todo: **un usuario pertenece a un solo negocio**. Las funciones
  `current_tenant_id()`, `current_client_id()` e `is_staff()` dependen de eso.

## Dónde buscar

1. **Fuga entre negocios.** ¿Puede un cliente o un staff del negocio A ver o modificar
   datos del negocio B? Mirá `0002_rls.sql`, `0004_admin.sql`, `0005_admin_write.sql`.
   Atención a `current_tenant_id()` en `0008_security_fixes.sql`: resuelve `staff` antes
   que `clients` justamente para frenar una escalada. ¿Se puede volver a torcer?

2. **Escalada a dueño de plataforma.** `0010_platform_admins.sql` y
   `0011_create_business.sql`. ¿Puede alguien que no es dueño de plataforma llamar
   `create_business` o `list_businesses`? ¿Insertarse en `platform_admins`?

3. **`create_business` crea usuarios en `auth.users` desde SQL** (`0011`). Es la función
   más peligrosa del sistema: corre como `security definer` y toca el esquema de auth.
   ¿Se puede abusar para crear un usuario con privilegios, pisar un usuario existente,
   inyectar valores, o quedarse con la cuenta de otro? ¿Valida bien el email y el slug?

4. **Reserva de citas** (`0009_book_appointment_rpc.sql`, RPC `book_appointment`).
   Calcula la duración en el servidor a propósito. ¿Se puede reservar en un negocio ajeno,
   con servicios de otro negocio, o saltar la restricción anti-solapamiento?

5. **Cambio de contraseña de clientes** (`0008`, `admin_set_client_password`). ¿Puede un
   staff usarla contra alguien de otro negocio, contra otro staff, o contra el dueño de
   la plataforma?

6. **Portal público por slug** (`src/context/TenantContext.jsx`, rutas `/n/:slug`).
   El registro asocia al cliente con el negocio de la URL. ¿Se puede manipular para
   quedar en un negocio ajeno o para enumerar negocios/datos?

7. **Secretos en el frontend**: ninguna variable `VITE_*` debe contener la clave de
   servicio (`service_role` / `sb_secret`). Vite las publica en el bundle.

## Qué entregar

Por hallazgo: severidad, archivo y línea, cómo se explota (pasos concretos) y el fix.
Priorizá lo que rompe el aislamiento entre negocios y la escalada de privilegios
(cliente → staff → dueño de plataforma). Si algo parece vulnerable pero una política RLS
o una función ya lo frena, decilo: importa más un hallazgo real que muchos dudosos.
