-- =====================================================================
-- Agendik · la ficha de cliente se crea sola al registrarse
--
-- Hasta acá la creaba el frontend, justo después del signUp. Eso funciona
-- solo si el proyecto NO exige confirmación por email: con la confirmación
-- activada el registro no devuelve sesión, el insert nunca corre, y la
-- persona confirma su mail para encontrarse con que no tiene ficha.
--
-- Moverlo a un trigger lo hace independiente de esa configuración, y de
-- paso cubre a quien se registre desde otro lado (magic link, OAuth).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  negocio uuid;
  ficha   uuid;
begin
  -- El equipo del negocio no lleva ficha de cliente.
  if exists (select 1 from public.staff where user_id = new.id) then
    return new;
  end if;

  -- El negocio viene en los metadatos del registro; si no, el único que hay.
  begin
    negocio := nullif(new.raw_user_meta_data ->> 'tenant_id', '')::uuid;
  exception when others then
    negocio := null;
  end;
  if negocio is null then
    select id into negocio from public.tenants order by created_at limit 1;
  end if;
  if negocio is null then
    return new;
  end if;

  -- Si el negocio ya lo fichó por WhatsApp o mostrador, se adopta esa ficha
  -- con todo su historial en vez de crear una nueva vacía.
  update public.clients
     set user_id = new.id
   where user_id is null
     and tenant_id = negocio
     and lower(email) = lower(new.email)
  returning id into ficha;

  if ficha is not null then
    return new;
  end if;

  insert into public.clients (user_id, tenant_id, name, email, phone, status)
  values (
    new.id,
    negocio,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'active'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
