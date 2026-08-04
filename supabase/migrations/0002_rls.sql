-- =====================================================================
-- Agendik · seguridad a nivel de fila (RLS)
--
-- Regla general: un cliente autenticado solo ve y toca SUS propios datos,
-- y solo el catálogo del negocio al que pertenece. Nada de esto depende
-- del frontend: si el token es válido pero los datos son de otro cliente,
-- Postgres devuelve cero filas.
-- =====================================================================

alter table public.tenants              enable row level security;
alter table public.clients              enable row level security;
alter table public.services             enable row level security;
alter table public.professionals        enable row level security;
alter table public.working_hours        enable row level security;
alter table public.packages             enable row level security;
alter table public.package_items        enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_tokens   enable row level security;

-- Helpers ------------------------------------------------------------

-- Ficha de cliente del usuario logueado.
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.clients where user_id = auth.uid() limit 1;
$$;

-- Negocio al que pertenece ese cliente.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.clients where user_id = auth.uid() limit 1;
$$;

-- Negocios -----------------------------------------------------------
-- El slug del negocio es público (la app lo necesita antes del login).
drop policy if exists tenants_read on public.tenants;
create policy tenants_read on public.tenants
  for select using (true);

-- Clientes -----------------------------------------------------------
drop policy if exists clients_select_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated using (user_id = auth.uid());

drop policy if exists clients_insert_own on public.clients;
create policy clients_insert_own on public.clients
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists clients_update_own on public.clients;
create policy clients_update_own on public.clients
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Catálogo -----------------------------------------------------------
drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated
  using (active and tenant_id = public.current_tenant_id());

drop policy if exists professionals_select on public.professionals;
create policy professionals_select on public.professionals
  for select to authenticated
  using (active and tenant_id = public.current_tenant_id());

drop policy if exists working_hours_select on public.working_hours;
create policy working_hours_select on public.working_hours
  for select to authenticated
  using (
    exists (
      select 1 from public.professionals p
      where p.id = working_hours.professional_id
        and p.tenant_id = public.current_tenant_id()
    )
  );

-- Paquetes -----------------------------------------------------------
drop policy if exists packages_select_own on public.packages;
create policy packages_select_own on public.packages
  for select to authenticated using (client_id = public.current_client_id());

drop policy if exists package_items_select_own on public.package_items;
create policy package_items_select_own on public.package_items
  for select to authenticated
  using (
    exists (
      select 1 from public.packages pk
      where pk.id = package_items.package_id
        and pk.client_id = public.current_client_id()
    )
  );

-- Citas --------------------------------------------------------------
drop policy if exists appointments_select_own on public.appointments;
create policy appointments_select_own on public.appointments
  for select to authenticated using (client_id = public.current_client_id());

drop policy if exists appointments_insert_own on public.appointments;
create policy appointments_insert_own on public.appointments
  for insert to authenticated
  with check (
    client_id = public.current_client_id()
    and tenant_id = public.current_tenant_id()
    and status = 'reserved'
    and date >= current_date
  );

-- El cliente solo puede confirmar o cancelar; no reprograma ni completa.
drop policy if exists appointments_update_own on public.appointments;
create policy appointments_update_own on public.appointments
  for update to authenticated
  using (client_id = public.current_client_id() and status in ('reserved', 'confirmed'))
  with check (client_id = public.current_client_id() and status in ('confirmed', 'cancelled'));

drop policy if exists appointment_services_select_own on public.appointment_services;
create policy appointment_services_select_own on public.appointment_services
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.client_id = public.current_client_id()
    )
  );

drop policy if exists appointment_services_insert_own on public.appointment_services;
create policy appointment_services_insert_own on public.appointment_services
  for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.client_id = public.current_client_id()
    )
  );

drop policy if exists appointment_services_delete_own on public.appointment_services;
create policy appointment_services_delete_own on public.appointment_services
  for delete to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.client_id = public.current_client_id()
    )
  );

-- Rollback de la app si falla el enlace de servicios tras crear la cita.
drop policy if exists appointments_delete_own on public.appointments;
create policy appointments_delete_own on public.appointments
  for delete to authenticated
  using (client_id = public.current_client_id() and status = 'reserved');

-- Tokens: sin política de lectura directa. El acceso público va
-- exclusivamente por la función get_appointment_by_token (security definer),
-- que expone solo los campos necesarios y valida el vencimiento.

-- ---------------------------------------------------------------------
-- Permisos de tabla
--
-- RLS decide QUÉ FILAS ve cada quien; los GRANT deciden si el rol puede
-- tocar la tabla siquiera. Hacen falta los dos. Supabase otorga permisos
-- amplios por defecto a anon/authenticated, pero eso depende de con qué
-- rol se corran estas migraciones. Declararlos acá deja el esquema
-- correcto sin importar quién lo aplique, y sin dar de más:
-- `anon` solo llega a la tabla de negocios.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.tenants to anon, authenticated;

grant select, insert, update on public.clients              to authenticated;
grant select                  on public.services             to authenticated;
grant select                  on public.professionals        to authenticated;
grant select                  on public.working_hours        to authenticated;
grant select                  on public.packages             to authenticated;
grant select, update          on public.package_items        to authenticated;
grant select, insert, update, delete on public.appointments  to authenticated;
grant select, insert, delete  on public.appointment_services to authenticated;

-- appointment_tokens no recibe ningún grant: solo lo alcanzan las
-- funciones security definer.
