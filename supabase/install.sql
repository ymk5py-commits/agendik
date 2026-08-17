-- =====================================================================
-- Agendik · instalación completa del esquema
--
-- Generado a partir de supabase/migrations/*.sql + supabase/seed.sql.
-- Sirve para un proyecto en la nube o para uno self-hosted:
-- pegalo entero en el SQL Editor del proyecto y ejecutá.
-- Es seguro correrlo más de una vez (el seed usa ON CONFLICT).
--
-- NO EDITAR A MANO: se regenera con scripts/build-install-sql.sh
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0001_schema.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0002_rls.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0003_functions.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0004_admin.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0005_admin_write.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0006_staff_profile.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/migrations/0007_admin_client_password.sql
-- ─────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────
-- supabase/seed.sql
-- ─────────────────────────────────────────────────────────────────────

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
