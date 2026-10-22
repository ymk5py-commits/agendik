-- =====================================================================
-- Catálogo público de un negocio: lo que muestra su portal (/n/<slug>)
-- antes de iniciar sesión, como la vidriera de cualquier local.
--
-- Solo datos que el negocio publica para atraer clientes:
--   · servicios activos: nombre, categoría, duración, precio y cupo;
--   · equipo activo: nombre y especialidades;
--   · franja de atención de cada día (la primera entrada y la última
--     salida del equipo; 0 = domingo).
-- Nada de clientes, citas, correos ni teléfonos del equipo.
--
-- SECURITY DEFINER porque services, professionals y working_hours solo
-- se leen con sesión. Devuelve NULL si el enlace no existe.
-- =====================================================================

create or replace function public.catalogo_publico(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with negocio as (
    select id from public.tenants where slug = p_slug
  )
  select json_build_object(
    'servicios', coalesce((
      select json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'category', s.category,
               'durationMin', s.duration_min, 'price', s.price, 'capacity', s.capacity)
             order by s.category nulls last, s.name)
      from public.services s
      where s.tenant_id = (select id from negocio) and s.active
    ), '[]'::json),
    'equipo', coalesce((
      select json_agg(json_build_object('id', p.id, 'name', p.name, 'specialties', p.specialties) order by p.name)
      from public.professionals p
      where p.tenant_id = (select id from negocio) and p.active
    ), '[]'::json),
    'horarios', coalesce((
      select json_agg(json_build_object(
               'weekday', h.weekday,
               'start', to_char(h.inicio, 'HH24:MI'),
               'end', to_char(h.fin, 'HH24:MI'))
             order by h.weekday)
      from (
        select w.weekday, min(w.start_time) as inicio, max(w.end_time) as fin
        from public.working_hours w
        join public.professionals p on p.id = w.professional_id
        where p.tenant_id = (select id from negocio) and p.active
        group by w.weekday
      ) h
    ), '[]'::json)
  )
  where exists (select 1 from negocio);
$$;

revoke all on function public.catalogo_publico(text) from public;
grant execute on function public.catalogo_publico(text) to anon, authenticated;
