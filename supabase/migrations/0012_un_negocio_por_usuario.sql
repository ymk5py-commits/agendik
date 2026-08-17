-- =====================================================================
-- Agendik · un usuario pertenece a un solo negocio (auditoría fase 4)
--
-- Hallazgo: cualquier usuario registrado podía insertarse como cliente en
-- CUALQUIER negocio de la plataforma. La política `clients_insert_own` solo
-- exigía `user_id = auth.uid()` y nunca miró el `tenant_id`.
--
-- Con un solo negocio era inocuo. Con varios rompe la invariante sobre la que
-- se apoya toda la seguridad: `current_tenant_id()` y `current_client_id()`
-- resuelven con `limit 1`, así que un usuario con ficha en dos negocios deja
-- al sistema eligiendo cuál sin criterio.
--
-- Verificado antes del fix, contra la base real: un cliente del negocio A se
-- insertó en el negocio B y desde ahí **pudo reservar una cita**, ocupando un
-- turno real de una agenda ajena. También veía el catálogo del otro negocio.
-- No llegaba a ver clientes ni la agenda del panel: eso ya lo frenaba la RLS.
--
-- El arreglo va en la base y no en la política, porque la garantía tiene que
-- valer para cualquier camino (app, API directa, o un bug futuro en el
-- frontend): un `unique` sobre `user_id` hace imposible la segunda ficha.
--
-- Nota de producto: una persona que quiera ser clienta de dos negocios de la
-- plataforma necesita una cuenta por negocio. Es la contracara de esta
-- garantía, y es coherente con el resto del diseño (el mismo motivo por el que
-- `admin_set_client_password` ya se negaba a tocar cuentas de varios negocios).
-- =====================================================================

-- Las fichas sin cuenta (`user_id` nulo) son las que carga el negocio por
-- mostrador o WhatsApp: pueden ser muchas, y en Postgres varios NULL no chocan
-- entre sí en un índice único.
create unique index if not exists clients_user_id_unico
  on public.clients (user_id)
  where user_id is not null;

-- A propósito NO se toca la política `clients_insert_own`: una política que
-- consulte `clients` dentro de su propia regla dispara la RLS de la misma
-- tabla y puede terminar en recursión, rompiendo el alta de cuentas. El índice
-- ya da la garantía dura, y la app traduce el error a algo legible.
