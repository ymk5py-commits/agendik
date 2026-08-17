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
