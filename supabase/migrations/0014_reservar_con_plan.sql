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
