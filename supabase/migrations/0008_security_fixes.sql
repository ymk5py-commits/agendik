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
