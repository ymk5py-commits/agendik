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
