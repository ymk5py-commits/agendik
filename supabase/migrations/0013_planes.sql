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
