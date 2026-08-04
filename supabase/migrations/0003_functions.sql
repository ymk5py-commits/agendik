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
