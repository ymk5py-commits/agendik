-- =====================================================================
-- Agendik · el panel deja de ser solo de lectura
--
-- Con esto el negocio puede dar de alta clientes, cargar citas por
-- teléfono o mostrador, y mantener su catálogo. Sigue siendo Postgres
-- quien decide quién puede qué.
-- =====================================================================

-- Clientes sin cuenta de portal ---------------------------------------
-- El negocio necesita fichar a alguien que reservó por WhatsApp y nunca
-- va a entrar a la app. Esa ficha existe sin usuario asociado; si más
-- adelante esa persona se registra con el mismo email, se vincula.
alter table public.clients alter column user_id drop not null;

-- El unique de user_id ya ignora los null, pero el email sí tiene que ser
-- único por negocio para poder vincular después sin ambigüedad.
create unique index if not exists clients_tenant_email_idx
  on public.clients (tenant_id, lower(email));

-- Alta y edición de clientes desde el panel ----------------------------
drop policy if exists clients_insert_staff on public.clients;
create policy clients_insert_staff on public.clients
  for insert to authenticated
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists clients_update_staff on public.clients;
create policy clients_update_staff on public.clients
  for update to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

-- Citas cargadas por el negocio ----------------------------------------
-- A diferencia del cliente, el equipo puede agendar para cualquiera y en
-- cualquier estado. Lo que NO puede es pisar la restricción de
-- solapamiento: esa vive en el índice y no la esquiva nadie.
drop policy if exists appointments_insert_staff on public.appointments;
create policy appointments_insert_staff on public.appointments
  for insert to authenticated
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists appointment_services_insert_staff on public.appointment_services;
create policy appointment_services_insert_staff on public.appointment_services
  for insert to authenticated
  with check (
    public.is_staff()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.tenant_id = public.current_tenant_id()
    )
  );

drop policy if exists appointment_services_delete_staff on public.appointment_services;
create policy appointment_services_delete_staff on public.appointment_services
  for delete to authenticated
  using (
    public.is_staff()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.tenant_id = public.current_tenant_id()
    )
  );

-- Catálogo del negocio -------------------------------------------------
-- Servicios, profesionales y horarios los mantiene el equipo. Los
-- clientes siguen con lectura nada más.

drop policy if exists services_write_staff on public.services;
create policy services_write_staff on public.services
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists professionals_write_staff on public.professionals;
create policy professionals_write_staff on public.professionals
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists working_hours_write_staff on public.working_hours;
create policy working_hours_write_staff on public.working_hours
  for all to authenticated
  using (
    public.is_staff()
    and exists (
      select 1 from public.professionals p
      where p.id = working_hours.professional_id
        and p.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    public.is_staff()
    and exists (
      select 1 from public.professionals p
      where p.id = working_hours.professional_id
        and p.tenant_id = public.current_tenant_id()
    )
  );

-- Paquetes asignados por el negocio ------------------------------------
drop policy if exists packages_write_staff on public.packages;
create policy packages_write_staff on public.packages
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists package_items_write_staff on public.package_items;
create policy package_items_write_staff on public.package_items
  for all to authenticated
  using (
    public.is_staff()
    and exists (
      select 1 from public.packages p
      where p.id = package_items.package_id
        and p.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    public.is_staff()
    and exists (
      select 1 from public.packages p
      where p.id = package_items.package_id
        and p.tenant_id = public.current_tenant_id()
    )
  );

-- Permisos de tabla ----------------------------------------------------
-- RLS decide qué filas; los GRANT deciden si el rol puede intentarlo.
grant insert, update, delete on public.services      to authenticated;
grant insert, update, delete on public.professionals to authenticated;
grant insert, update, delete on public.working_hours to authenticated;
grant insert, update, delete on public.packages      to authenticated;
grant insert, delete         on public.package_items to authenticated;

-- Vincular una ficha preexistente al registrarse -----------------------
-- Si el negocio ya fichó a alguien por su email y esa persona después se
-- crea la cuenta, se adopta la ficha en vez de crear una duplicada.
create or replace function public.claim_client_record()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  correo text;
  ficha  uuid;
begin
  select email into correo from auth.users where id = auth.uid();
  if correo is null then return null; end if;

  update public.clients
     set user_id = auth.uid()
   where user_id is null
     and lower(email) = lower(correo)
  returning id into ficha;

  return ficha;
end;
$$;

grant execute on function public.claim_client_record() to authenticated;
