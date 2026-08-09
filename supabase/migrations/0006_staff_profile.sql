-- =====================================================================
-- Agendik · cuenta propia del equipo
--
-- Cada persona del equipo puede editar su nombre y cambiar su contraseña.
-- Lo que NO puede es tocar su rol ni el negocio al que pertenece: eso
-- sería ascenderse solo.
-- =====================================================================

drop policy if exists staff_update_own on public.staff;
create policy staff_update_own on public.staff
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- La defensa real contra la escalada de privilegios no es la política sino
-- el GRANT por columna: aunque la fila sea suya, `role` y `tenant_id` no
-- están en la lista, así que un UPDATE sobre ellos es rechazado por
-- permisos antes de que RLS siquiera opine.
grant update (name) on public.staff to authenticated;
