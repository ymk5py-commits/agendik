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
