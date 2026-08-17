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

