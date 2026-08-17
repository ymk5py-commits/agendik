-- =====================================================================
-- Agendik · dueño de la plataforma (fase 1 de multi-negocio)
--
-- Hasta acá el rol más alto era `owner`: el dueño de UN negocio. Para vender
-- Agendik a varios negocios hace falta alguien por encima, que pueda darlos
-- de alta. Ese es el dueño de la plataforma.
--
-- Es deliberadamente una tabla aparte y no una columna `role` en `staff`:
-- ser dueño de la plataforma no es un rol *dentro* de un negocio, y meterlo
-- en `staff` obligaría a que tuviera un `tenant_id`, que es justo lo que no
-- tiene sentido para él.
--
-- Esta migración solo crea la base. Quién puede crear negocios y cómo, va en
-- la fase 2 (`create_business`).
-- =====================================================================

create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Cada uno ve si él mismo es dueño de la plataforma, y nada más: la lista
-- completa de administradores no se expone. Alcanza para que el frontend
-- decida si muestra la sección "Negocios".
drop policy if exists platform_admins_select_own on public.platform_admins;
create policy platform_admins_select_own on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: dar de alta a otro dueño
-- de plataforma no se hace desde la app. Es una operación de fundación, por
-- SQL directo contra la base.
grant select on public.platform_admins to authenticated;

-- ---------------------------------------------------------------------
-- ¿El usuario logueado es dueño de la plataforma?
--
-- `security definer` para que responda igual sin depender de que la RLS de
-- la tabla deje leer, y `stable` porque no cambia dentro de la consulta.
-- Mismo patrón que `is_staff()`.
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
