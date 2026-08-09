-- =====================================================================
-- Agendik · panel de administración
--
-- Hasta acá la app era solo el portal del cliente. Esto agrega el otro
-- lado: el equipo del negocio, que ve la agenda completa de todos los
-- clientes y puede confirmar o cancelar turnos.
--
-- Igual que con los clientes, quién ve qué lo decide Postgres, no el
-- frontend: un token de cliente contra las consultas del panel devuelve
-- cero filas.
-- =====================================================================

-- Equipo del negocio ---------------------------------------------------
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null,
  -- owner puede todo; staff es personal con los mismos permisos de lectura
  -- y de cambio de estado. La distinción queda para cuando haya gestión.
  role       text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create index if not exists staff_tenant_idx on public.staff (tenant_id);

alter table public.staff enable row level security;

-- Helpers --------------------------------------------------------------

-- ¿El usuario logueado es parte del equipo?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Negocio del usuario logueado, sea cliente o parte del equipo.
--
-- Se redefine el helper que ya existía en vez de crear otro: así todas
-- las políticas del catálogo (servicios, profesionales, horarios) pasan a
-- funcionar para el equipo sin tocar una línea de lo anterior.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tenant_id from public.clients where user_id = auth.uid() limit 1),
    (select tenant_id from public.staff   where user_id = auth.uid() limit 1)
  );
$$;

-- Políticas del equipo -------------------------------------------------

-- Cada uno ve su propia ficha de equipo (la app la necesita para saber
-- si tiene que mostrar el panel).
drop policy if exists staff_select_own on public.staff;
create policy staff_select_own on public.staff
  for select to authenticated using (user_id = auth.uid());

-- Los compañeros del mismo negocio también, para poder listarlos.
drop policy if exists staff_select_team on public.staff;
create policy staff_select_team on public.staff
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

-- Lo que el equipo puede ver del negocio -------------------------------
-- Estas políticas se SUMAN a las del cliente: Postgres las combina con OR,
-- así que el cliente sigue viendo lo suyo y nada más.

drop policy if exists clients_select_staff on public.clients;
create policy clients_select_staff on public.clients
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists appointments_select_staff on public.appointments;
create policy appointments_select_staff on public.appointments
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists appointment_services_select_staff on public.appointment_services;
create policy appointment_services_select_staff on public.appointment_services
  for select to authenticated
  using (
    public.is_staff()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.tenant_id = public.current_tenant_id()
    )
  );

drop policy if exists packages_select_staff on public.packages;
create policy packages_select_staff on public.packages
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists package_items_select_staff on public.package_items;
create policy package_items_select_staff on public.package_items
  for select to authenticated
  using (
    public.is_staff()
    and exists (
      select 1 from public.packages p
      where p.id = package_items.package_id
        and p.tenant_id = public.current_tenant_id()
    )
  );

-- Lo que el equipo puede cambiar ---------------------------------------
-- Solo el estado de las citas de su negocio. No puede reescribir fecha,
-- hora ni profesional desde el panel: para eso está la reserva, que pasa
-- por la restricción anti-solapamiento.
drop policy if exists appointments_update_staff on public.appointments;
create policy appointments_update_staff on public.appointments
  for update to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (
    public.is_staff()
    and tenant_id = public.current_tenant_id()
    and status in ('reserved', 'confirmed', 'cancelled', 'completed')
  );

-- Permisos de tabla ----------------------------------------------------
grant select on public.staff to authenticated;

-- Resumen legible para el panel ---------------------------------------
-- Evita que el frontend arme un join de cinco tablas para pintar la agenda.
create or replace view public.admin_agenda as
select
  a.id,
  a.tenant_id,
  a.date,
  a.start_time,
  a.end_time,
  a.duration_min,
  a.status,
  a.notes,
  a.source,
  a.created_at,
  c.id           as client_id,
  c.name         as client_name,
  c.phone        as client_phone,
  c.email        as client_email,
  p.id           as professional_id,
  p.name         as professional_name,
  coalesce(
    (select string_agg(s.name, ' + ' order by s.name)
       from public.appointment_services aps
       join public.services s on s.id = aps.service_id
      where aps.appointment_id = a.id),
    'Sin servicio'
  ) as services_label,
  coalesce(
    (select sum(s.price)
       from public.appointment_services aps
       join public.services s on s.id = aps.service_id
      where aps.appointment_id = a.id),
    0
  ) as total_price
from public.appointments a
join public.clients c       on c.id = a.client_id
join public.professionals p on p.id = a.professional_id;

-- La vista hereda el RLS de las tablas de abajo: un cliente que la
-- consulte solo ve sus propias filas.
alter view public.admin_agenda set (security_invoker = true);

grant select on public.admin_agenda to authenticated;
