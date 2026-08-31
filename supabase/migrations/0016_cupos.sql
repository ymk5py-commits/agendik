-- =====================================================================
-- Agendik · cupos por turno (clases grupales)
--
-- Hasta acá cada turno era de una sola persona: la restricción de
-- exclusión impedía cualquier solapamiento con el mismo profesional. Eso
-- está bien para una manicura y mal para una clase de pilates, donde
-- cinco personas comparten el lunes a las 13:00.
--
-- Un servicio ahora declara cuánta gente entra por turno. Con capacity 1
-- se comporta igual que antes; con más, el turno admite hasta ese número
-- y desaparece de los horarios libres cuando se llena.
-- =====================================================================

alter table public.services
  add column if not exists capacity int not null default 1
  check (capacity >= 1);

comment on column public.services.capacity is
  'Personas por turno. 1 = atención individual; más = clase grupal.';

-- Copia del cupo en la cita, para que la restricción pueda usarlo sin
-- salir a buscarlo (una constraint no puede consultar otra tabla).
alter table public.appointments
  add column if not exists slot_capacity int not null default 1;

-- La exclusión pasa a cubrir SOLO los turnos individuales. Los grupales
-- los valida el trigger de abajo, que sabe contar.
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tsrange(date + start_time, date + end_time) with &&
  )
  where (status in ('reserved', 'confirmed') and slot_capacity = 1);

-- Validación ----------------------------------------------------------
create or replace function public.validar_cupo_de_cita(cita public.appointments)
returns void
language plpgsql
as $$
declare
  ocupados int;
begin
  if cita.status not in ('reserved', 'confirmed') then
    return;
  end if;

  -- Serializa las reservas del mismo turno: sin esto, dos personas que
  -- tocan "reservar" a la vez podrían pasar ambas el conteo.
  perform pg_advisory_xact_lock(
    hashtext(cita.professional_id::text || cita.date::text || cita.start_time::text)
  );

  -- 1. Choque con una cita que NO es de este mismo turno.
  if exists (
    select 1
    from public.appointments a
    where a.professional_id = cita.professional_id
      and a.date            = cita.date
      and a.id             <> cita.id
      and a.status in ('reserved', 'confirmed')
      and a.start_time     <> cita.start_time
      and tsrange(a.date + a.start_time, a.date + a.end_time)
       && tsrange(cita.date + cita.start_time, cita.date + cita.end_time)
  ) then
    raise exception 'El profesional ya tiene otra cita que se superpone con ese horario.'
      using errcode = '23P01';
  end if;

  -- 2. Cupo del turno.
  --
  -- Solo se evalúa cuando la cita ya tiene servicios enlazados. La app
  -- inserta la cita primero y los servicios después, en dos pasos: en el
  -- primero `slot_capacity` todavía vale 1 (el default) y contar ahí
  -- rechazaría a la segunda persona de una clase de cinco. Al enlazar el
  -- servicio, el otro trigger corrige el cupo y vuelve a validar, ya con
  -- el número que sale del catálogo.
  if not exists (
    select 1 from public.appointment_services where appointment_id = cita.id
  ) then
    return;
  end if;

  select count(*) into ocupados
  from public.appointments a
  where a.professional_id = cita.professional_id
    and a.date            = cita.date
    and a.start_time      = cita.start_time
    and a.id             <> cita.id
    and a.status in ('reserved', 'confirmed');

  if ocupados >= cita.slot_capacity then
    raise exception 'Ese turno ya está completo (% de % lugares ocupados).', ocupados, cita.slot_capacity
      using errcode = '23P01';
  end if;
end;
$$;

create or replace function public.trg_validar_cita()
returns trigger
language plpgsql
as $$
begin
  perform public.validar_cupo_de_cita(new);
  return new;
end;
$$;

drop trigger if exists appointments_validar_cupo on public.appointments;
create trigger appointments_validar_cupo
  after insert or update of date, start_time, end_time, professional_id, status, slot_capacity
  on public.appointments
  for each row execute function public.trg_validar_cita();

-- El cupo sale del catálogo, no del formulario -------------------------
-- Los servicios se enlazan DESPUÉS de crear la cita, así que el cupo se
-- recalcula cuando eso pasa. Se toma el MÍNIMO: si la reserva combina una
-- clase grupal con algo individual, manda lo individual.
--
-- Que salga de acá y no de lo que manda el cliente es lo que impide que
-- alguien pida cupo 99 y sobrevenda la clase.
create or replace function public.trg_recalcular_cupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cita_id uuid := coalesce(new.appointment_id, old.appointment_id);
  cupo    int;
  fila    public.appointments;
begin
  select min(s.capacity) into cupo
  from public.appointment_services aps
  join public.services s on s.id = aps.service_id
  where aps.appointment_id = cita_id;

  update public.appointments
     set slot_capacity = coalesce(cupo, 1)
   where id = cita_id
  returning * into fila;

  if fila.id is not null then
    perform public.validar_cupo_de_cita(fila);
  end if;

  return null;
end;
$$;

drop trigger if exists appointment_services_cupo on public.appointment_services;
create trigger appointment_services_cupo
  after insert or delete on public.appointment_services
  for each row execute function public.trg_recalcular_cupo();

-- Cuántos lugares quedan, para que la app no arme el conteo a mano.
create or replace view public.slot_ocupacion as
select
  a.professional_id,
  a.date,
  a.start_time,
  a.end_time,
  max(a.slot_capacity) as capacidad,
  count(*)             as ocupados,
  max(a.slot_capacity) - count(*) as libres
from public.appointments a
where a.status in ('reserved', 'confirmed')
group by a.professional_id, a.date, a.start_time, a.end_time;

alter view public.slot_ocupacion set (security_invoker = true);
grant select on public.slot_ocupacion to authenticated;

-- La agenda del panel expone el cupo, para que al reprogramar una clase se
-- calculen los huecos con la regla grupal y no con la individual.
create or replace view public.admin_agenda as
select
  a.id, a.tenant_id, a.date, a.start_time, a.end_time, a.duration_min,
  a.status, a.notes, a.source, a.created_at,
  c.id as client_id, c.name as client_name, c.phone as client_phone, c.email as client_email,
  p.id as professional_id, p.name as professional_name,
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
  ) as total_price,
  -- Al final a propósito: CREATE OR REPLACE VIEW no admite insertar una
  -- columna en el medio de las que ya existían.
  a.slot_capacity
from public.appointments a
join public.clients c       on c.id = a.client_id
join public.professionals p on p.id = a.professional_id;

alter view public.admin_agenda set (security_invoker = true);
grant select on public.admin_agenda to authenticated;
