-- =====================================================================
-- Agendik · cola de correos salientes
--
-- Los avisos de citas dejaron de depender de un servicio de correo externo
-- (antes: API de Brevo, de pago). Ahora `notificar` arma el mail y lo deja acá;
-- un worker programado (cron/timer en el servidor) lo vacía por SMTP, con
-- reintentos. Así el SMTP de salida es intercambiable (el propio, el de otra
-- app de reenvío, una cuenta gratuita) sin tocar la app ni la base.
--
-- Nadie del navegador toca esto: la tabla está cerrada a anon/authenticated y
-- las funciones solo las puede ejecutar service_role (la función `notificar`,
-- que ya validó de quién es la cita, y el worker).
-- =====================================================================

create table if not exists public.cola_correos (
  id              uuid primary key default gen_random_uuid(),
  creado_en       timestamptz not null default now(),
  tenant_id       uuid references public.tenants (id) on delete set null,
  appointment_id  uuid references public.appointments (id) on delete set null,
  evento          text,
  para            text not null check (position('@' in para) > 1),
  asunto          text not null,
  html            text not null,
  texto           text,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'enviando', 'enviado', 'fallido')),
  intentos        int  not null default 0,
  proximo_intento timestamptz not null default now(),
  reclamado_en    timestamptz,
  enviado_en      timestamptz,
  ultimo_error    text
);

create index if not exists cola_correos_pendientes_idx
  on public.cola_correos (proximo_intento)
  where estado in ('pendiente', 'enviando');

-- Sin políticas a propósito: con RLS activa y sin políticas, anon y authenticated
-- no ven ni una fila. Además se les quita el permiso (Supabase los otorga por defecto).
alter table public.cola_correos enable row level security;
revoke all on public.cola_correos from anon, authenticated;

-- ---------------------------------------------------------------------
-- Encolar un correo. Devuelve el id.
-- ---------------------------------------------------------------------
create or replace function public.encolar_correo(
  p_para           text,
  p_asunto         text,
  p_html           text,
  p_texto          text default null,
  p_evento         text default null,
  p_appointment_id uuid default null,
  p_tenant_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.cola_correos (para, asunto, html, texto, evento, appointment_id, tenant_id)
  values (lower(trim(p_para)), p_asunto, p_html, p_texto, p_evento, p_appointment_id, p_tenant_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- El worker reclama un lote. `skip locked` evita que dos corridas tomen el
-- mismo correo. Un correo que quedó «enviando» más de 10 minutos (el worker
-- se cayó) se vuelve a reclamar.
-- ---------------------------------------------------------------------
create or replace function public.reclamar_correos(p_limite int default 20)
returns setof public.cola_correos
language sql
security definer
set search_path = public
as $$
  update public.cola_correos c
     set estado = 'enviando',
         intentos = c.intentos + 1,
         reclamado_en = now()
   where c.id in (
     select id
       from public.cola_correos
      where (estado = 'pendiente' and proximo_intento <= now())
         or (estado = 'enviando' and reclamado_en < now() - interval '10 minutes')
      order by creado_en
      limit greatest(1, least(p_limite, 100))
      for update skip locked
   )
  returning c.*;
$$;

-- ---------------------------------------------------------------------
-- Resultado de un envío. Si falló: reintenta con espera creciente (2, 8, 18
-- y 32 minutos) y a la quinta queda «fallido».
-- ---------------------------------------------------------------------
create or replace function public.resolver_correo(
  p_id    uuid,
  p_ok    boolean,
  p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cola_correos
     set estado = case when p_ok then 'enviado'
                       when intentos >= 5 then 'fallido'
                       else 'pendiente' end,
         enviado_en = case when p_ok then now() end,
         ultimo_error = case when p_ok then null else left(p_error, 500) end,
         proximo_intento = case when p_ok then proximo_intento
                                else now() + (intentos * intentos) * interval '2 minutes' end
   where id = p_id
     and estado = 'enviando';
$$;

-- ---------------------------------------------------------------------
-- Limpieza: los enviados y los fallidos viejos no hacen falta.
-- ---------------------------------------------------------------------
create or replace function public.limpiar_cola_correos(p_dias int default 30)
returns int
language sql
security definer
set search_path = public
as $$
  with borrados as (
    delete from public.cola_correos
     where estado in ('enviado', 'fallido')
       and creado_en < now() - make_interval(days => greatest(p_dias, 1))
    returning 1
  )
  select count(*)::int from borrados;
$$;

-- Solo service_role. Postgres da EXECUTE a PUBLIC por defecto y Supabase además a
-- anon/authenticated: se saca todo y se vuelve a dar solo a quien corresponde.
revoke all on function public.encolar_correo(text, text, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.reclamar_correos(int)                                   from public, anon, authenticated;
revoke all on function public.resolver_correo(uuid, boolean, text)                    from public, anon, authenticated;
revoke all on function public.limpiar_cola_correos(int)                               from public, anon, authenticated;

grant execute on function public.encolar_correo(text, text, text, text, text, uuid, uuid) to service_role;
grant execute on function public.reclamar_correos(int)                                   to service_role;
grant execute on function public.resolver_correo(uuid, boolean, text)                    to service_role;
grant execute on function public.limpiar_cola_correos(int)                               to service_role;
