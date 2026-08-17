-- =====================================================================
-- Agendik · instalación completa del esquema
-- Generado a partir de supabase/migrations/*.sql + supabase/seed.sql.
-- Se puede correr más de una vez sin romper nada.
-- NO EDITAR A MANO: se regenera con scripts/build-install-sql.sh
-- =====================================================================


-- ─────────────────────────────────────────
-- supabase/migrations/0001_schema.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · esquema base
-- Portal de agendamiento multi-negocio (multi-tenant por fila).
-- Ejecutar en el SQL Editor de Supabase (o vía `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------------
-- Negocios
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  business_name text not null,
  phone         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clientes (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null,
  phone      text,
  birth_date date,
  gender     text check (gender in ('female', 'male', 'other')),
  occupation text,
  address    text,
  status     text not null default 'active' check (status in ('active', 'pending', 'blocked')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists clients_user_id_idx on public.clients (user_id);

-- ---------------------------------------------------------------------
-- Catálogo de servicios
-- ---------------------------------------------------------------------
create table if not exists public.services (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  name         text not null,
  category     text not null,
  duration_min integer not null check (duration_min > 0),
  price        numeric(12, 2) not null default 0 check (price >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists services_tenant_idx on public.services (tenant_id) where active;

-- ---------------------------------------------------------------------
-- Profesionales y sus horarios
-- ---------------------------------------------------------------------
create table if not exists public.professionals (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants (id) on delete cascade,
  name               text not null,
  specialties        text[] not null default '{}',
  slot_interval_min  integer not null default 30 check (slot_interval_min > 0),
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create table if not exists public.working_hours (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time      time not null,
  end_time        time not null,
  check (end_time > start_time)
);

create index if not exists working_hours_pro_idx on public.working_hours (professional_id);

-- ---------------------------------------------------------------------
-- Paquetes contratados
-- ---------------------------------------------------------------------
create table if not exists public.packages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,
  name                text not null,
  original_price      numeric(12, 2) not null default 0,
  discount_percentage numeric(5, 2)  not null default 0,
  discount_amount     numeric(12, 2) not null default 0,
  final_price         numeric(12, 2) not null default 0,
  total_paid          numeric(12, 2) not null default 0,
  remaining_balance   numeric(12, 2) not null default 0,
  status              text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at          timestamptz not null default now()
);

create index if not exists packages_client_idx on public.packages (client_id);

create table if not exists public.package_items (
  id            uuid primary key default gen_random_uuid(),
  package_id    uuid not null references public.packages (id) on delete cascade,
  service_id    uuid not null references public.services (id) on delete restrict,
  quantity      integer not null check (quantity > 0),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  check (sessions_used <= quantity),
  unique (package_id, service_id)
);

-- ---------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete restrict,
  date            date not null,
  start_time      time not null,
  end_time        time not null,
  duration_min    integer not null check (duration_min > 0),
  package_id      uuid references public.packages (id) on delete set null,
  status          text not null default 'reserved'
                  check (status in ('reserved', 'confirmed', 'cancelled', 'completed')),
  notes           text default '',
  source          text not null default 'portal',
  created_at      timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists appointments_client_idx on public.appointments (client_id, date desc);
create index if not exists appointments_pro_date_idx on public.appointments (professional_id, date);

-- Un profesional no puede tener dos citas vivas superpuestas.
-- Es la última línea de defensa contra dos clientes reservando el mismo hueco
-- al mismo tiempo: la segunda inserción falla en la base, no en la app.
-- `date + time` da timestamp y es inmutable, así que sirve dentro del índice.
alter table public.appointments
  drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange(date + start_time, date + end_time) with &&
  )
  where (status in ('reserved', 'confirmed'));

create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id     uuid not null references public.services (id) on delete restrict,
  primary key (appointment_id, service_id)
);

-- ---------------------------------------------------------------------
-- Tokens de acción pública (confirmar/cancelar desde email o WhatsApp)
-- ---------------------------------------------------------------------
create table if not exists public.appointment_tokens (
  token          text primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists appointment_tokens_appt_idx on public.appointment_tokens (appointment_id);

-- ─────────────────────────────────────────
-- supabase/migrations/0002_rls.sql
-- ─────────────────────────────────────────

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

-- ─────────────────────────────────────────
-- supabase/migrations/0003_functions.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · funciones RPC
-- Lógica que no puede vivir en el cliente: consumo de sesiones de paquete
-- y acceso público por token.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Descuenta una sesión por cada servicio cubierto por el paquete.
-- Solo actúa sobre paquetes del cliente logueado.
-- ---------------------------------------------------------------------
create or replace function public.consume_package_sessions(
  p_package_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.packages
    where id = p_package_id and client_id = public.current_client_id()
  ) then
    raise exception 'Ese paquete no es tuyo.';
  end if;

  update public.package_items
     set sessions_used = sessions_used + 1
   where package_id = p_package_id
     and service_id = any (p_service_ids)
     and sessions_used < quantity;

  update public.packages
     set status = 'completed'
   where id = p_package_id
     and status = 'active'
     and not exists (
       select 1 from public.package_items
       where package_id = p_package_id and sessions_used < quantity
     );
end;
$$;

-- ---------------------------------------------------------------------
-- Devuelve las sesiones al cancelar una cita que usaba paquete.
-- ---------------------------------------------------------------------
create or replace function public.restore_package_sessions(
  p_package_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.packages
    where id = p_package_id and client_id = public.current_client_id()
  ) then
    raise exception 'Ese paquete no es tuyo.';
  end if;

  update public.package_items
     set sessions_used = sessions_used - 1
   where package_id = p_package_id
     and service_id = any (p_service_ids)
     and sessions_used > 0;

  update public.packages
     set status = 'active'
   where id = p_package_id
     and status = 'completed'
     and exists (
       select 1 from public.package_items
       where package_id = p_package_id and sessions_used < quantity
     );
end;
$$;

-- ---------------------------------------------------------------------
-- Acceso público a una cita mediante token de un solo uso (email/WhatsApp).
-- Devuelve solo lo mínimo para pintar la pantalla; nunca el resto de la ficha.
-- ---------------------------------------------------------------------
create or replace function public.get_appointment_by_token(p_token text)
returns table (
  appointment_id    uuid,
  date              date,
  start_time        time,
  end_time          time,
  status            text,
  professional_name text,
  service_names     text[],
  client_name       text,
  business_name     text,
  expired           boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.date,
    a.start_time,
    a.end_time,
    a.status,
    p.name,
    array(
      select s.name
      from public.appointment_services aps
      join public.services s on s.id = aps.service_id
      where aps.appointment_id = a.id
    ),
    c.name,
    t.business_name,
    (tok.expires_at < now())
  from public.appointment_tokens tok
  join public.appointments  a on a.id = tok.appointment_id
  join public.professionals p on p.id = a.professional_id
  join public.clients       c on c.id = a.client_id
  join public.tenants       t on t.id = a.tenant_id
  where tok.token = p_token;
$$;

-- ---------------------------------------------------------------------
-- Confirmar o cancelar desde el link del recordatorio, sin iniciar sesión.
-- El token es la credencial: si venció o ya no aplica, la operación falla.
-- ---------------------------------------------------------------------
create or replace function public.act_on_appointment_by_token(
  p_token  text,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id uuid;
  v_expires_at     timestamptz;
  v_status         text;
  v_new_status     text;
begin
  if p_action not in ('confirm', 'cancel') then
    raise exception 'Acción no soportada.';
  end if;

  select tok.appointment_id, tok.expires_at, a.status
    into v_appointment_id, v_expires_at, v_status
    from public.appointment_tokens tok
    join public.appointments a on a.id = tok.appointment_id
   where tok.token = p_token;

  if v_appointment_id is null then
    raise exception 'Link inválido.';
  end if;

  if v_expires_at < now() then
    raise exception 'Este link venció.';
  end if;

  if v_status not in ('reserved', 'confirmed') then
    raise exception 'Esta cita ya no se puede modificar.';
  end if;

  v_new_status := case when p_action = 'confirm' then 'confirmed' else 'cancelled' end;

  if v_status = v_new_status then
    return v_status;
  end if;

  update public.appointments
     set status = v_new_status
   where id = v_appointment_id;

  -- Cancelar libera las sesiones de paquete que la cita había consumido.
  if p_action = 'cancel' then
    update public.package_items pi
       set sessions_used = pi.sessions_used - 1
      from public.appointments a
     where a.id = v_appointment_id
       and pi.package_id = a.package_id
       and pi.sessions_used > 0
       and pi.service_id in (
         select service_id from public.appointment_services
         where appointment_id = v_appointment_id
       );

    update public.packages pk
       set status = 'active'
      from public.appointments a
     where a.id = v_appointment_id
       and pk.id = a.package_id
       and pk.status = 'completed';
  end if;

  update public.appointment_tokens
     set used_at = now()
   where token = p_token;

  return v_new_status;
end;
$$;

grant execute on function public.get_appointment_by_token(text) to anon, authenticated;
grant execute on function public.act_on_appointment_by_token(text, text) to anon, authenticated;
grant execute on function public.consume_package_sessions(uuid, uuid[]) to authenticated;
grant execute on function public.restore_package_sessions(uuid, uuid[]) to authenticated;

-- ─────────────────────────────────────────
-- supabase/migrations/0004_admin.sql
-- ─────────────────────────────────────────

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

-- ─────────────────────────────────────────
-- supabase/migrations/0005_admin_write.sql
-- ─────────────────────────────────────────

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

-- ─────────────────────────────────────────
-- supabase/migrations/0006_staff_profile.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · cuenta propia del equipo
--
-- Cada persona del equipo puede editar su nombre y cambiar su contraseña.
-- Lo que NO puede es tocar su rol ni el negocio al que pertenece: eso
-- sería ascenderse solo.
-- =====================================================================

drop policy if exists staff_update_own on public.staff;
create policy staff_update_own on public.staff
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- La defensa real contra la escalada de privilegios no es la política sino
-- el GRANT por columna: aunque la fila sea suya, `role` y `tenant_id` no
-- están en la lista, así que un UPDATE sobre ellos es rechazado por
-- permisos antes de que RLS siquiera opine.
grant update (name) on public.staff to authenticated;

-- ─────────────────────────────────────────
-- supabase/migrations/0007_admin_client_password.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · el negocio le cambia la contraseña a un cliente
--
-- Caso real: el cliente perdió la contraseña y no hay forma de que la
-- recupere solo (el "olvidé mi contraseña" necesita un servidor de mail,
-- que muchas instalaciones no tienen). Entonces lo resuelve el mostrador.
--
-- Por qué una función y no la API de administración de Supabase: cambiar
-- la contraseña de OTRA persona requiere la clave de servicio, y esa clave
-- no puede salir al navegador — Vite publica todo lo que empieza con VITE_
-- dentro del bundle. Acá el permiso lo decide Postgres: la función corre
-- con privilegios elevados pero solo después de comprobar, ella misma, que
-- quien llama es del equipo y que el cliente es de su mismo negocio.
--
-- Deliberadamente NO permite tocar la contraseña de otro miembro del
-- equipo: si `staff` se pudiera editar así, cualquier empleado podría
-- quedarse con la cuenta del dueño.
-- =====================================================================

create or replace function public.admin_set_client_password(
  p_client_id uuid,
  p_password  text
)
returns void
language plpgsql
security definer
-- `extensions` va en el search_path porque en las instalaciones self-hosted
-- pgcrypto (crypt / gen_salt) vive ahí y no en public.
set search_path = public, extensions, auth
as $$
declare
  v_user_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo del negocio puede cambiar contraseñas'
      using errcode = '42501';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'La contraseña necesita al menos 8 caracteres'
      using errcode = '22023';
  end if;

  -- El cliente tiene que ser del mismo negocio que quien llama. Si no lo es,
  -- esta consulta no lo encuentra y sale por el mismo camino que si no
  -- existiera: desde afuera no se distingue un caso del otro.
  select c.user_id into v_user_id
  from public.clients c
  where c.id = p_client_id
    and c.tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Ese cliente no es de tu negocio' using errcode = 'P0002';
  end if;

  if v_user_id is null then
    raise exception 'Ese cliente todavía no tiene cuenta para entrar al portal'
      using errcode = 'P0002';
  end if;

  -- Nunca sobre alguien del equipo, ni sobre uno mismo.
  if exists (select 1 from public.staff s where s.user_id = v_user_id) then
    raise exception 'No se puede cambiar la contraseña de un miembro del equipo desde acá'
      using errcode = '42501';
  end if;

  -- Mismo formato que usa el servicio de auth (bcrypt).
  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = v_user_id;

  -- Cerrar las sesiones abiertas del cliente: si la contraseña se cambió
  -- porque perdió el acceso, cualquier sesión viva es sospechosa.
  delete from auth.sessions where user_id = v_user_id;
  -- en auth.refresh_tokens el user_id es texto, no uuid
  delete from auth.refresh_tokens where user_id = v_user_id::text;
end;
$$;

revoke all on function public.admin_set_client_password(uuid, text) from public, anon;
grant execute on function public.admin_set_client_password(uuid, text) to authenticated;

-- ─────────────────────────────────────────
-- supabase/migrations/0008_security_fixes.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · correcciones de seguridad (auditoría Strix + Gemini, 16-ago-2026)
--
-- Arregla tres hallazgos verificados contra el código. El cuarto (bypass de
-- rutas de admin por React) resultó falso positivo: la vista admin_agenda ya
-- corre con security_invoker=true y las tablas tienen RLS, así que manipular
-- el frontend muestra el cascarón vacío pero no filtra datos. El quinto
-- (duración de la cita calculada en el cliente) necesita un RPC nuevo y va
-- aparte, en 0009.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- FIX 1 · Escalada de privilegios entre negocios (HIGH, CWE-863)
--
-- `current_tenant_id()` resolvía el negocio mirando primero la tabla
-- `clients` y después `staff`. Como cualquiera puede insertar su propia
-- ficha de cliente en CUALQUIER negocio (la política solo exige
-- user_id = auth.uid()), un miembro del equipo del negocio A podía
-- insertarse como cliente del negocio B y, al resolver el tenant a B
-- mientras is_staff() seguía siendo true, leer y modificar toda la agenda
-- de B.
--
-- Dos barreras, en profundidad:
--   a) el equipo primero: para el staff, el negocio lo define su fila en
--      `staff`, que no puede falsificar insertándose como cliente.
--   b) la ficha de cliente solo puede crearse en un negocio que exista, y
--      además marcamos que insertarse en otro negocio ya no da acceso de
--      staff gracias a (a).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select tenant_id from public.staff   where user_id = auth.uid() limit 1),
    (select tenant_id from public.clients where user_id = auth.uid() limit 1)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- FIX 2 · Robo de cuenta al cambiar la contraseña de un cliente (HIGH, CWE-639)
--
-- `admin_set_client_password` deja que el negocio le ponga una contraseña
-- nueva a su cliente. Pero la identidad en `auth.users` es global: si esa
-- persona también es clienta de OTRO negocio, cambiarle la contraseña le
-- da al primer negocio la llave de su cuenta entera. Bloqueamos el caso:
-- si el usuario tiene ficha en más de un negocio, no se le cambia la
-- contraseña desde el mostrador; tiene que recuperarla por email.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_client_password(
  p_client_id uuid,
  p_password  text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_user_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Solo el equipo del negocio puede cambiar contraseñas'
      using errcode = '42501';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'La contraseña necesita al menos 8 caracteres'
      using errcode = '22023';
  end if;

  select c.user_id into v_user_id
  from public.clients c
  where c.id = p_client_id
    and c.tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'Ese cliente no es de tu negocio' using errcode = 'P0002';
  end if;

  if v_user_id is null then
    raise exception 'Ese cliente todavía no tiene cuenta para entrar al portal'
      using errcode = 'P0002';
  end if;

  if exists (select 1 from public.staff s where s.user_id = v_user_id) then
    raise exception 'No se puede cambiar la contraseña de un miembro del equipo desde acá'
      using errcode = '42501';
  end if;

  -- Identidad global: si es clienta de más de un negocio, cambiarle la
  -- contraseña acá le tocaría la cuenta que usa en otros lados.
  if (select count(*) from public.clients where user_id = v_user_id) > 1 then
    raise exception 'Esta persona tiene cuenta en más de un negocio: por seguridad tiene que recuperar la contraseña por email, no se la puede cambiar desde acá'
      using errcode = '42501';
  end if;

  update auth.users
     set encrypted_password = crypt(p_password, gen_salt('bf')),
         updated_at = now()
   where id = v_user_id;

  delete from auth.sessions where user_id = v_user_id;
  delete from auth.refresh_tokens where user_id = v_user_id::text;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- FIX 3 · Reuso de un token de un solo uso (MEDIUM, CWE-863)
--
-- `act_on_appointment_by_token` marcaba `used_at` al final pero nunca lo
-- miraba al entrar. Si el negocio reabría una cita cancelada, el mismo link
-- servía otra vez hasta que venciera. Ahora el token se rechaza apenas ya
-- fue usado.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.act_on_appointment_by_token(
  p_token  text,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id uuid;
  v_expires_at     timestamptz;
  v_status         text;
  v_new_status     text;
  v_used_at        timestamptz;
begin
  if p_action not in ('confirm', 'cancel') then
    raise exception 'Acción no soportada.';
  end if;

  select tok.appointment_id, tok.expires_at, a.status, tok.used_at
    into v_appointment_id, v_expires_at, v_status, v_used_at
    from public.appointment_tokens tok
    join public.appointments a on a.id = tok.appointment_id
   where tok.token = p_token;

  if v_appointment_id is null then
    raise exception 'Link inválido.';
  end if;

  if v_used_at is not null then
    raise exception 'Este link ya fue utilizado.';
  end if;

  if v_expires_at < now() then
    raise exception 'Este link venció.';
  end if;

  if v_status not in ('reserved', 'confirmed') then
    raise exception 'Esta cita ya no se puede modificar.';
  end if;

  v_new_status := case when p_action = 'confirm' then 'confirmed' else 'cancelled' end;

  if v_status = v_new_status then
    return v_status;
  end if;

  update public.appointments
     set status = v_new_status
   where id = v_appointment_id;

  -- Cancelar libera las sesiones de paquete que la cita había consumido.
  if p_action = 'cancel' then
    update public.package_items pi
       set sessions_used = pi.sessions_used - 1
      from public.appointments a
     where a.id = v_appointment_id
       and pi.package_id = a.package_id
       and pi.sessions_used > 0
       and pi.service_id in (
         select service_id from public.appointment_services
         where appointment_id = v_appointment_id
       );

    update public.packages pk
       set status = 'active'
      from public.appointments a
     where a.id = v_appointment_id
       and pk.id = a.package_id
       and pk.status = 'completed';
  end if;

  update public.appointment_tokens
     set used_at = now()
   where token = p_token;

  return v_new_status;
end;
$$;

-- ─────────────────────────────────────────
-- supabase/migrations/0009_book_appointment_rpc.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · reserva de cita calculada en el servidor (fix vuln-0005, CWE-602)
--
-- Antes, el portal del cliente calculaba la duración de la cita en el
-- navegador y el backend le creía: `createAppointment` recibía `durationMin`
-- y `end_time` ya armados y los insertaba tal cual. Un cliente podía pedir
-- servicios de 2 horas declarando 1 minuto, ocupar un minuto de la agenda y
-- sobrevender al profesional, salteando la restricción anti-solapamiento
-- (que solo mira el rango [start, end]).
--
-- Este RPC hace la reserva del lado del servidor: toma los servicios, lee su
-- duración REAL de la tabla `services` (validando que sean del negocio del
-- cliente), calcula la duración y la hora de fin, e inserta la cita y sus
-- servicios en una sola operación. La duración deja de ser un dato que el
-- cliente pueda elegir.
-- =====================================================================

create or replace function public.book_appointment(
  p_professional_id uuid,
  p_date            date,
  p_start_time      time,
  p_service_ids     uuid[],
  p_package_id      uuid default null,
  p_notes           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_tenant_id uuid;
  v_duration  int;
  v_count     int;
  v_appt_id   uuid;
begin
  v_client_id := public.current_client_id();
  if v_client_id is null then
    raise exception 'Necesitás una cuenta de cliente para reservar.'
      using errcode = '42501';
  end if;
  v_tenant_id := public.current_tenant_id();

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Elegí al menos un servicio.' using errcode = '22023';
  end if;

  -- La duración sale de la base, no del cliente. Y todos los servicios tienen
  -- que existir y ser de este negocio: si falta alguno, no reservamos.
  select coalesce(sum(duration_min), 0), count(*)
    into v_duration, v_count
    from public.services
   where id = any (p_service_ids)
     and tenant_id = v_tenant_id;

  if v_count <> array_length(p_service_ids, 1) then
    raise exception 'Alguno de los servicios elegidos no es válido.'
      using errcode = '22023';
  end if;
  if v_duration <= 0 then
    raise exception 'La duración de los servicios no es válida.'
      using errcode = '22023';
  end if;

  -- El profesional tiene que ser de este negocio.
  if not exists (
    select 1 from public.professionals
    where id = p_professional_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Ese profesional no es de este negocio.'
      using errcode = '22023';
  end if;

  -- La restricción de exclusión GiST sobre appointments rechaza el
  -- solapamiento acá adentro; el error 23P01 sube al frontend.
  insert into public.appointments (
    tenant_id, client_id, professional_id, date, start_time, end_time,
    duration_min, package_id, status, notes, source
  )
  values (
    v_tenant_id, v_client_id, p_professional_id, p_date, p_start_time,
    p_start_time + make_interval(mins => v_duration), v_duration,
    p_package_id, 'reserved', coalesce(p_notes, ''), 'portal'
  )
  returning id into v_appt_id;

  insert into public.appointment_services (appointment_id, service_id)
  select v_appt_id, unnest(p_service_ids);

  if p_package_id is not null then
    perform public.consume_package_sessions(p_package_id, p_service_ids);
  end if;

  return v_appt_id;
end;
$$;

grant execute on function public.book_appointment(uuid, date, time, uuid[], uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Cerrar el vector por API directa
--
-- No alcanza con que el frontend use el RPC: mientras el cliente conserve el
-- permiso de INSERT directo sobre `appointments`, un atacante puede saltear el
-- navegador y crear la cita a mano con una duración falsa. Quitamos ese permiso
-- para el CLIENTE: su única forma de reservar pasa a ser `book_appointment`
-- (que corre como definer y calcula la duración). El equipo del negocio no se
-- toca: sigue insertando por las políticas `_staff`.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists appointments_insert_own on public.appointments;
drop policy if exists appointment_services_insert_own on public.appointment_services;


-- ─────────────────────────────────────────
-- supabase/migrations/0010_platform_admins.sql
-- ─────────────────────────────────────────

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

-- ─────────────────────────────────────────
-- supabase/migrations/0011_create_business.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · alta de un negocio con su dueño (fase 2 de multi-negocio)
--
-- Crea el negocio y, en la misma operación, la cuenta de quien lo va a
-- administrar, con una contraseña temporal que se devuelve para pasársela.
-- Solo lo puede llamar el dueño de la plataforma.
--
-- Por qué se crea el usuario con SQL y no con la API de administración de
-- GoTrue: esa API pide la clave de servicio, que no puede salir al navegador.
-- Se probó contra el GoTrue real (v2.189) que un usuario creado así puede
-- iniciar sesión — con una salvedad que costó encontrar y que está resuelta
-- abajo: GoTrue lee varias columnas de token como texto, no como texto
-- nullable. Si quedan en NULL, cualquier login contra ese usuario falla con
-- "Database error querying schema" (HTTP 500). Por eso se insertan en
-- cadena vacía, no se dejan en NULL.
-- =====================================================================

create or replace function public.create_business(
  p_slug          text,
  p_business_name text,
  p_phone         text,
  p_owner_email   text,
  p_owner_name    text default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_tenant_id uuid;
  v_user_id   uuid := gen_random_uuid();
  v_password  text;
  v_email     text := lower(trim(p_owner_email));
  v_slug      text := lower(trim(p_slug));
  v_name      text := coalesce(nullif(trim(p_owner_name), ''), 'Dueño del negocio');
begin
  if not public.is_platform_admin() then
    raise exception 'Solo el dueño de la plataforma puede crear negocios'
      using errcode = '42501';
  end if;

  -- El slug es la dirección pública del negocio (/n/<slug>): sin espacios ni
  -- acentos, para que el link sea sano.
  if v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'La dirección del negocio solo admite minúsculas, números y guiones'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.tenants where slug = v_slug) then
    raise exception 'Ya existe un negocio con esa dirección' using errcode = '23505';
  end if;
  if coalesce(trim(p_business_name), '') = '' then
    raise exception 'Poné el nombre del negocio' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email del dueño no parece válido' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ya existe una cuenta con ese email' using errcode = '23505';
  end if;

  insert into public.tenants (slug, business_name, phone)
  values (v_slug, trim(p_business_name), nullif(trim(coalesce(p_phone, '')), ''))
  returning id into v_tenant_id;

  -- Contraseña temporal legible por teléfono: sin caracteres que se confundan
  -- al dictarla (0/O, 1/l). El dueño la cambia desde "Mi cuenta".
  v_password := (
    select string_agg(substr('abcdefghjkmnpqrstuvwxyz', (random() * 22)::int + 1, 1), '')
    from generate_series(1, 4)
  ) || '-' || (
    select string_agg(substr('23456789', (random() * 7)::int + 1, 1), '')
    from generate_series(1, 4)
  );

  -- Las columnas de token van en cadena vacía a propósito (ver cabecera).
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', v_name, 'email', v_email, 'email_verified', true),
    now(), now(), false, false,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );

  insert into public.staff (tenant_id, user_id, name, email, role)
  values (v_tenant_id, v_user_id, v_name, v_email, 'owner');

  return json_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'owner_email', v_email,
    'owner_password', v_password
  );
end;
$$;

revoke all on function public.create_business(text, text, text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Lista de negocios para el dueño de la plataforma.
--
-- `tenants` ya tiene lectura pública (el portal necesita resolver el negocio
-- por su slug), así que esto no expone nada nuevo: solo evita que el frontend
-- tenga que adivinar qué mostrar y agrega el dato de cuántos negocios hay.
-- ---------------------------------------------------------------------
create or replace function public.list_businesses()
returns table (
  id            uuid,
  slug          text,
  business_name text,
  phone         text,
  created_at    timestamptz,
  owner_email   text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.business_name, t.phone, t.created_at,
         (select s.email from public.staff s
           where s.tenant_id = t.id and s.role = 'owner'
           order by s.created_at limit 1)
  from public.tenants t
  where public.is_platform_admin()
  order by t.created_at desc;
$$;

revoke all on function public.list_businesses() from public, anon;
grant execute on function public.list_businesses() to authenticated;

-- ─────────────────────────────────────────
-- supabase/migrations/0012_un_negocio_por_usuario.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · un usuario pertenece a un solo negocio (auditoría fase 4)
--
-- Hallazgo: cualquier usuario registrado podía insertarse como cliente en
-- CUALQUIER negocio de la plataforma. La política `clients_insert_own` solo
-- exigía `user_id = auth.uid()` y nunca miró el `tenant_id`.
--
-- Con un solo negocio era inocuo. Con varios rompe la invariante sobre la que
-- se apoya toda la seguridad: `current_tenant_id()` y `current_client_id()`
-- resuelven con `limit 1`, así que un usuario con ficha en dos negocios deja
-- al sistema eligiendo cuál sin criterio.
--
-- Verificado antes del fix, contra la base real: un cliente del negocio A se
-- insertó en el negocio B y desde ahí **pudo reservar una cita**, ocupando un
-- turno real de una agenda ajena. También veía el catálogo del otro negocio.
-- No llegaba a ver clientes ni la agenda del panel: eso ya lo frenaba la RLS.
--
-- El arreglo va en la base y no en la política, porque la garantía tiene que
-- valer para cualquier camino (app, API directa, o un bug futuro en el
-- frontend): un `unique` sobre `user_id` hace imposible la segunda ficha.
--
-- Nota de producto: una persona que quiera ser clienta de dos negocios de la
-- plataforma necesita una cuenta por negocio. Es la contracara de esta
-- garantía, y es coherente con el resto del diseño (el mismo motivo por el que
-- `admin_set_client_password` ya se negaba a tocar cuentas de varios negocios).
-- =====================================================================

-- Las fichas sin cuenta (`user_id` nulo) son las que carga el negocio por
-- mostrador o WhatsApp: pueden ser muchas, y en Postgres varios NULL no chocan
-- entre sí en un índice único.
create unique index if not exists clients_user_id_unico
  on public.clients (user_id)
  where user_id is not null;

-- A propósito NO se toca la política `clients_insert_own`: una política que
-- consulte `clients` dentro de su propia regla dispara la RLS de la misma
-- tabla y puede terminar en recursión, rompiendo el alta de cuentas. El índice
-- ya da la garantía dura, y la app traduce el error a algo legible.

-- ─────────────────────────────────────────
-- supabase/migrations/0013_planes.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · planes con cuota mensual (suscripciones)
--
-- Distinto de `packages`, que es un combo que se compra una vez y se agota
-- ("4 limpiezas faciales"). Un plan es una cuota que se renueva sola:
-- "Pilates 2 veces por semana" = 8 usos al mes, y el mes que viene otra vez 8.
--
-- Decisiones tomadas con el negocio:
--   · el ciclo arranca el día que la persona se suscribió, no el 1 del mes
--     (quien se suscribe un 28 no pierde su primer mes),
--   · los usos que no gastó NO se acumulan: cada período arranca completo,
--   · el plan cubre solo los servicios que se le indiquen.
--
-- Cómo se cuentan los usos: **no hay un contador que sume y reste**. Se cuentan
-- las citas del período. Un contador mutable se desincroniza apenas una
-- operación falla a mitad de camino, y no hay forma de saber cuál es el número
-- correcto. Contando las citas, el número siempre se puede recalcular desde los
-- hechos.
--
-- La regla de negocio que pidió el equipo:
--   · cita reservada  → ocupa un uso, pero si se cancela el uso vuelve,
--   · cita confirmada → el uso queda tomado aunque después se cancele.
-- Eso se resuelve con la marca `subscription_locked`, que un disparador pone
-- al confirmar y ya no se saca.
-- =====================================================================

-- Planes del negocio (las plantillas) ---------------------------------
create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  name             text not null,
  uses_per_period  integer not null check (uses_per_period > 0),
  price            numeric(12, 2) not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists plans_tenant_idx on public.plans (tenant_id);

-- Qué servicios cubre cada plan ---------------------------------------
create table if not exists public.plan_services (
  plan_id    uuid not null references public.plans (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (plan_id, service_id)
);

-- La suscripción de un cliente a un plan ------------------------------
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  plan_id    uuid not null references public.plans (id) on delete restrict,
  started_on date not null default current_date,
  status     text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_client_idx on public.subscriptions (client_id);
create index if not exists subscriptions_tenant_idx on public.subscriptions (tenant_id);

-- Una cita puede descontar de una suscripción -------------------------
alter table public.appointments
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;
alter table public.appointments
  add column if not exists subscription_locked boolean not null default false;
create index if not exists appointments_subscription_idx
  on public.appointments (subscription_id) where subscription_id is not null;

-- ---------------------------------------------------------------------
-- El uso queda tomado al confirmar
--
-- Va como disparador y no en el código de cada pantalla porque una cita se
-- confirma por varios caminos (el panel, el link del recordatorio) y todos
-- tienen que dejar la misma marca.
-- ---------------------------------------------------------------------
create or replace function public.marcar_uso_de_plan()
returns trigger
language plpgsql
as $$
begin
  if new.subscription_id is not null
     and new.status = 'confirmed'
     and not new.subscription_locked then
    new.subscription_locked := true;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_lock_plan_use on public.appointments;
create trigger appointments_lock_plan_use
  before insert or update of status on public.appointments
  for each row execute function public.marcar_uso_de_plan();

-- ---------------------------------------------------------------------
-- El período vigente de una suscripción
--
-- El ciclo corre desde el día de alta: si arrancó un 12, va del 12 al 11.
-- Postgres ya ajusta los meses cortos al sumar intervalos (31 de enero + 1 mes
-- = 28 de febrero), así que no hace falta tratar ese caso aparte.
-- ---------------------------------------------------------------------
create or replace function public.periodo_de_suscripcion(
  p_started_on date,
  p_al         date default current_date
)
returns table (period_start date, period_end date)
language sql
immutable
as $$
  with meses as (
    select (
      (extract(year from p_al) - extract(year from p_started_on)) * 12
      + (extract(month from p_al) - extract(month from p_started_on))
      - case when extract(day from p_al) < extract(day from p_started_on) then 1 else 0 end
    )::int as n
  )
  select
    (p_started_on + (greatest(n, 0) || ' months')::interval)::date,
    (p_started_on + ((greatest(n, 0) + 1) || ' months')::interval)::date - 1
  from meses;
$$;

-- ---------------------------------------------------------------------
-- Cuántos usos le quedan a una suscripción en su período actual
-- ---------------------------------------------------------------------
create or replace function public.usos_de_suscripcion(p_subscription_id uuid)
returns table (
  period_start date,
  period_end   date,
  total        integer,
  usados       integer,
  restantes    integer
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select sub.id, sub.started_on, p.uses_per_period
    from public.subscriptions sub
    join public.plans p on p.id = sub.plan_id
    where sub.id = p_subscription_id
  ),
  per as (
    select s.id, s.uses_per_period, pe.period_start, pe.period_end
    from s, lateral public.periodo_de_suscripcion(s.started_on) pe
  ),
  gastados as (
    select per.id, count(a.id)::int as n
    from per
    left join public.appointments a
      on a.subscription_id = per.id
     and a.date between per.period_start and per.period_end
     -- Una cita cancelada solo devuelve el uso si nunca llegó a confirmarse.
     and (a.status <> 'cancelled' or a.subscription_locked)
    group by per.id
  )
  select per.period_start, per.period_end, per.uses_per_period,
         gastados.n, greatest(per.uses_per_period - gastados.n, 0)
  from per join gastados on gastados.id = per.id;
$$;

grant execute on function public.usos_de_suscripcion(uuid) to authenticated;

-- Seguridad ------------------------------------------------------------
alter table public.plans         enable row level security;
alter table public.plan_services enable row level security;
alter table public.subscriptions enable row level security;

-- Los planes se ven dentro del negocio: el cliente necesita saber qué cubre
-- el suyo, y el equipo los administra.
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists plans_write_staff on public.plans;
create policy plans_write_staff on public.plans
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

drop policy if exists plan_services_select on public.plan_services;
create policy plan_services_select on public.plan_services
  for select to authenticated using (
    exists (select 1 from public.plans p
            where p.id = plan_services.plan_id and p.tenant_id = public.current_tenant_id())
  );

drop policy if exists plan_services_write_staff on public.plan_services;
create policy plan_services_write_staff on public.plan_services
  for all to authenticated
  using (
    public.is_staff() and exists (
      select 1 from public.plans p
      where p.id = plan_services.plan_id and p.tenant_id = public.current_tenant_id())
  )
  with check (
    public.is_staff() and exists (
      select 1 from public.plans p
      where p.id = plan_services.plan_id and p.tenant_id = public.current_tenant_id())
  );

-- Cada cliente ve su suscripción; el equipo ve las de su negocio.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (client_id = public.current_client_id());

drop policy if exists subscriptions_select_staff on public.subscriptions;
create policy subscriptions_select_staff on public.subscriptions
  for select to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id());

-- Suscribir a alguien es una decisión del negocio, no del cliente.
drop policy if exists subscriptions_write_staff on public.subscriptions;
create policy subscriptions_write_staff on public.subscriptions
  for all to authenticated
  using (public.is_staff() and tenant_id = public.current_tenant_id())
  with check (public.is_staff() and tenant_id = public.current_tenant_id());

grant select on public.plans         to authenticated;
grant select on public.plan_services to authenticated;
grant select on public.subscriptions to authenticated;
grant insert, update, delete on public.plans         to authenticated;
grant insert, update, delete on public.plan_services to authenticated;
grant insert, update, delete on public.subscriptions to authenticated;

-- ─────────────────────────────────────────
-- supabase/migrations/0014_reservar_con_plan.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · reservar usando un plan
--
-- Extiende `book_appointment` para que la cita pueda descontar de una
-- suscripción. Las validaciones van acá y no en el navegador porque el cliente
-- llama la API directo: si la cuota se controlara en el frontend, alcanzaría
-- con abrir la consola para reservar de más.
--
-- Se valida, en este orden:
--   1. la suscripción es del cliente que llama y está activa,
--   2. el plan cubre TODOS los servicios que eligió,
--   3. le queda al menos un uso en el período actual.
-- =====================================================================

-- Se elimina la versión anterior a propósito: agregar un parámetro no la
-- reemplaza, crea una segunda. Con las dos vivas, una llamada con los seis
-- parámetros viejos entraría por la de antes y saltearía toda la lógica del
-- plan, sin dar ningún error.
drop function if exists public.book_appointment(uuid, date, time, uuid[], uuid, text);

create or replace function public.book_appointment(
  p_professional_id uuid,
  p_date            date,
  p_start_time      time,
  p_service_ids     uuid[],
  p_package_id      uuid default null,
  p_notes           text default null,
  p_subscription_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_tenant_id uuid;
  v_duration  int;
  v_count     int;
  v_appt_id   uuid;
  v_restantes int;
  v_sin_cubrir int;
begin
  v_client_id := public.current_client_id();
  if v_client_id is null then
    raise exception 'Necesitás una cuenta de cliente para reservar.'
      using errcode = '42501';
  end if;
  v_tenant_id := public.current_tenant_id();

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Elegí al menos un servicio.' using errcode = '22023';
  end if;

  -- La duración sale de la base, no del cliente.
  select coalesce(sum(duration_min), 0), count(*)
    into v_duration, v_count
    from public.services
   where id = any (p_service_ids)
     and tenant_id = v_tenant_id;

  if v_count <> array_length(p_service_ids, 1) then
    raise exception 'Alguno de los servicios elegidos no es válido.'
      using errcode = '22023';
  end if;
  if v_duration <= 0 then
    raise exception 'La duración de los servicios no es válida.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.professionals
    where id = p_professional_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Ese profesional no es de este negocio.'
      using errcode = '22023';
  end if;

  -- Validación del plan -----------------------------------------------
  if p_subscription_id is not null then
    if not exists (
      select 1 from public.subscriptions
      where id = p_subscription_id
        and client_id = v_client_id
        and status = 'active'
    ) then
      raise exception 'Ese plan no es tuyo o no está activo.' using errcode = '42501';
    end if;

    -- Todos los servicios tienen que estar cubiertos: si el plan es de pilates
    -- no puede pagar una limpieza facial.
    select count(*) into v_sin_cubrir
    from unnest(p_service_ids) as pedido(service_id)
    where not exists (
      select 1
      from public.subscriptions sub
      join public.plan_services ps on ps.plan_id = sub.plan_id
      where sub.id = p_subscription_id and ps.service_id = pedido.service_id
    );
    if v_sin_cubrir > 0 then
      raise exception 'Tu plan no cubre alguno de los servicios elegidos.'
        using errcode = '22023';
    end if;

    select restantes into v_restantes
    from public.usos_de_suscripcion(p_subscription_id);

    if coalesce(v_restantes, 0) <= 0 then
      raise exception 'Ya usaste todos los turnos de tu plan este mes.'
        using errcode = '22023';
    end if;
  end if;

  insert into public.appointments (
    tenant_id, client_id, professional_id, date, start_time, end_time,
    duration_min, package_id, subscription_id, status, notes, source
  )
  values (
    v_tenant_id, v_client_id, p_professional_id, p_date, p_start_time,
    p_start_time + make_interval(mins => v_duration), v_duration,
    p_package_id, p_subscription_id, 'reserved', coalesce(p_notes, ''), 'portal'
  )
  returning id into v_appt_id;

  insert into public.appointment_services (appointment_id, service_id)
  select v_appt_id, unnest(p_service_ids);

  if p_package_id is not null then
    perform public.consume_package_sessions(p_package_id, p_service_ids);
  end if;

  return v_appt_id;
end;
$$;

grant execute on function
  public.book_appointment(uuid, date, time, uuid[], uuid, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- Los planes del cliente logueado, con lo que le queda este mes.
--
-- Junta la suscripción, su plan y el cálculo del período en una sola consulta,
-- para que la pantalla de reserva no tenga que armarlo a mano.
-- ---------------------------------------------------------------------
create or replace function public.mis_planes()
returns table (
  subscription_id uuid,
  plan_id         uuid,
  plan_name       text,
  period_start    date,
  period_end      date,
  total           integer,
  usados          integer,
  restantes       integer,
  service_ids     uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    sub.id, p.id, p.name,
    u.period_start, u.period_end, u.total, u.usados, u.restantes,
    coalesce(array_agg(ps.service_id) filter (where ps.service_id is not null), '{}')
  from public.subscriptions sub
  join public.plans p on p.id = sub.plan_id
  left join public.plan_services ps on ps.plan_id = p.id
  cross join lateral public.usos_de_suscripcion(sub.id) u
  where sub.client_id = public.current_client_id()
    and sub.status = 'active'
  group by sub.id, p.id, p.name, u.period_start, u.period_end, u.total, u.usados, u.restantes;
$$;

grant execute on function public.mis_planes() to authenticated;

-- ─────────────────────────────────────────
-- supabase/seed.sql
-- ─────────────────────────────────────────

-- =====================================================================
-- Agendik · datos de ejemplo
-- Ejecutar DESPUÉS de las migraciones, para tener un negocio con catálogo
-- y agenda listos. Es idempotente: se puede correr varias veces.
--
-- La ficha de cliente NO se crea acá: se crea sola al registrarte desde
-- la app (o podés insertarla a mano con el user_id de auth.users).
-- =====================================================================

-- Negocio ------------------------------------------------------------
insert into public.tenants (slug, business_name, phone)
values ('estudio-alma', 'Estudio Alma', '+595 981 000 000')
on conflict (slug) do update
  set business_name = excluded.business_name,
      phone = excluded.phone;

-- Servicios ----------------------------------------------------------
insert into public.services (tenant_id, name, category, duration_min, price)
select t.id, v.name, v.category, v.duration_min, v.price
from public.tenants t
cross join (values
  ('Limpieza Facial Profunda', 'Faciales',    60, 180000),
  ('Peeling Ultrasónico',      'Faciales',    45, 220000),
  ('Masaje Relajante',         'Corporales',  60, 200000),
  ('Drenaje Linfático',        'Corporales',  90, 280000),
  ('Manicura Spa',             'Manos & Pies',45,  90000),
  ('Pedicura Spa',             'Manos & Pies',60, 120000),
  ('Corte & Brushing',         'Cabello',     60, 150000),
  ('Coloración Completa',      'Cabello',     90, 450000)
) as v(name, category, duration_min, price)
where t.slug = 'estudio-alma'
  and not exists (
    select 1 from public.services s
    where s.tenant_id = t.id and s.name = v.name
  );

-- Profesionales ------------------------------------------------------
insert into public.professionals (tenant_id, name, specialties, slot_interval_min)
select t.id, v.name, v.specialties, v.interval_min
from public.tenants t
cross join (values
  ('Valeria Núñez',   array['Faciales', 'Corporales'],   30),
  ('Romina Aguirre',  array['Cabello'],                  30),
  ('Cynthia Torres',  array['Manos & Pies'],             15),
  ('Lucas Benítez',   array['Corporales'],               30)
) as v(name, specialties, interval_min)
where t.slug = 'estudio-alma'
  and not exists (
    select 1 from public.professionals p
    where p.tenant_id = t.id and p.name = v.name
  );

-- Horarios: lunes a viernes, más sábado a la mañana ------------------
insert into public.working_hours (professional_id, weekday, start_time, end_time)
select p.id, d.weekday, v.start_time, v.end_time
from public.professionals p
join public.tenants t on t.id = p.tenant_id and t.slug = 'estudio-alma'
join (values
  ('Valeria Núñez',  '08:00'::time, '18:00'::time),
  ('Romina Aguirre', '09:00'::time, '19:00'::time),
  ('Cynthia Torres', '08:00'::time, '17:00'::time),
  ('Lucas Benítez',  '10:00'::time, '20:00'::time)
) as v(name, start_time, end_time) on v.name = p.name
cross join (values (1), (2), (3), (4), (5)) as d(weekday)
where not exists (
  select 1 from public.working_hours w
  where w.professional_id = p.id and w.weekday = d.weekday
);

insert into public.working_hours (professional_id, weekday, start_time, end_time)
select p.id, 6, '08:00'::time, '13:00'::time
from public.professionals p
join public.tenants t on t.id = p.tenant_id and t.slug = 'estudio-alma'
where p.name in ('Valeria Núñez', 'Romina Aguirre', 'Cynthia Torres')
  and not exists (
    select 1 from public.working_hours w
    where w.professional_id = p.id and w.weekday = 6
  );
