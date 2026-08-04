-- =====================================================================
-- Agendik · datos de ejemplo
-- Ejecutar DESPUÉS de las migraciones, para tener un negocio con catálogo
-- y agenda listos. Es idempotente: se puede correr varias veces.
--
-- La ficha de cliente NO se crea acá: se crea sola al registrarte desde
-- la app (o podés insertarla a mano con el user_id de auth.users).
-- =====================================================================

-- Negocio ------------------------------------------------------------
insert into public.tenants (slug, business_name, phone)
values ('estudio-alma', 'Estudio Alma', '+595 981 000 000')
on conflict (slug) do update
  set business_name = excluded.business_name,
      phone = excluded.phone;

-- Servicios ----------------------------------------------------------
insert into public.services (tenant_id, name, category, duration_min, price)
select t.id, v.name, v.category, v.duration_min, v.price
from public.tenants t
cross join (values
  ('Limpieza Facial Profunda', 'Faciales',    60, 180000),
  ('Peeling Ultrasónico',      'Faciales',    45, 220000),
  ('Masaje Relajante',         'Corporales',  60, 200000),
  ('Drenaje Linfático',        'Corporales',  90, 280000),
  ('Manicura Spa',             'Manos & Pies',45,  90000),
  ('Pedicura Spa',             'Manos & Pies',60, 120000),
  ('Corte & Brushing',         'Cabello',     60, 150000),
  ('Coloración Completa',      'Cabello',     90, 450000)
) as v(name, category, duration_min, price)
where t.slug = 'estudio-alma'
  and not exists (
    select 1 from public.services s
    where s.tenant_id = t.id and s.name = v.name
  );

-- Profesionales ------------------------------------------------------
insert into public.professionals (tenant_id, name, specialties, slot_interval_min)
select t.id, v.name, v.specialties, v.interval_min
from public.tenants t
cross join (values
  ('Valeria Núñez',   array['Faciales', 'Corporales'],   30),
  ('Romina Aguirre',  array['Cabello'],                  30),
  ('Cynthia Torres',  array['Manos & Pies'],             15),
  ('Lucas Benítez',   array['Corporales'],               30)
) as v(name, specialties, interval_min)
where t.slug = 'estudio-alma'
  and not exists (
    select 1 from public.professionals p
    where p.tenant_id = t.id and p.name = v.name
  );

-- Horarios: lunes a viernes, más sábado a la mañana ------------------
insert into public.working_hours (professional_id, weekday, start_time, end_time)
select p.id, d.weekday, v.start_time, v.end_time
from public.professionals p
join public.tenants t on t.id = p.tenant_id and t.slug = 'estudio-alma'
join (values
  ('Valeria Núñez',  '08:00'::time, '18:00'::time),
  ('Romina Aguirre', '09:00'::time, '19:00'::time),
  ('Cynthia Torres', '08:00'::time, '17:00'::time),
  ('Lucas Benítez',  '10:00'::time, '20:00'::time)
) as v(name, start_time, end_time) on v.name = p.name
cross join (values (1), (2), (3), (4), (5)) as d(weekday)
where not exists (
  select 1 from public.working_hours w
  where w.professional_id = p.id and w.weekday = d.weekday
);

insert into public.working_hours (professional_id, weekday, start_time, end_time)
select p.id, 6, '08:00'::time, '13:00'::time
from public.professionals p
join public.tenants t on t.id = p.tenant_id and t.slug = 'estudio-alma'
where p.name in ('Valeria Núñez', 'Romina Aguirre', 'Cynthia Torres')
  and not exists (
    select 1 from public.working_hours w
    where w.professional_id = p.id and w.weekday = 6
  );
