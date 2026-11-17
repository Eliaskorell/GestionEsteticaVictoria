-- =====================================================================
--  Pedidos de cambio a un horario ocupado.
--  Correr DESPUÉS de esquema.sql y avisos.sql. Se puede correr más de una vez.
--  La clienta pide pasar su turno a un horario que tiene otra clienta:
--  no se cambia nada, pero a Victoria le llega el pedido con los datos de las dos.
-- =====================================================================

-- "ocupados" ahora dice si es un turno o un bloqueo (para mostrar qué se puede pedir)
drop function if exists ocupados(timestamptz, timestamptz);
create function ocupados(p_desde timestamptz, p_hasta timestamptz)
returns table (profesional_id bigint, inicio timestamptz, fin timestamptz, tipo text)
language sql stable security definer set search_path = public as $$
  select t.profesional_id, t.inicio, t.fin, 'turno' from turnos t
   where t.estado = 'confirmado' and t.inicio < p_hasta and t.fin > p_desde
  union all
  select b.profesional_id, b.inicio, b.fin, 'bloqueo' from bloqueos b
   where b.inicio < p_hasta and b.fin > p_desde
$$;
grant execute on function ocupados(timestamptz, timestamptz) to anon, authenticated;

-- Novedades: nuevo tipo 'pedido' y datos extra
alter table novedades add column if not exists datos jsonb;
alter table novedades drop constraint if exists novedades_tipo_check;
alter table novedades add constraint novedades_tipo_check
  check (tipo in ('reserva','cambio','cancelacion','espera','pedido'));

-- 5493493449066 / 349315449066 / 3493449066 -> "3493 449066" o "3493 15 449066"
create or replace function _cel_lindo(c text) returns text
language sql immutable as $$
  select case
    when length(d) = 12 and substr(d, 5, 2) = '15' then substr(d, 1, 4) || ' 15 ' || substr(d, 7)
    when length(d) = 10 then substr(d, 1, 4) || ' ' || substr(d, 5)
    else d end
  from (select regexp_replace(regexp_replace(_normalizar_cel(c), '^549?', ''), '^0', '') as d) x
$$;

-- Devuelve 'libre' si en realidad el horario está libre (la página hace el cambio normal)
-- o 'pedido' si quedó registrado el pedido.
create or replace function pedir_cambio(p_codigo text, p_inicio timestamptz)
returns text language plpgsql volatile security definer set search_path = public as $$
declare t turnos; o turnos; c config; v_fin timestamptz; v_problema text; v_serv text; v_pendientes int;
begin
  perform set_config('app.origen', 'web', true);
  select * into c from config where id = 1;
  select * into t from turnos where codigo = lower(trim(p_codigo));
  if t.id is null then raise exception 'No encontramos ese turno.'; end if;
  if t.estado <> 'confirmado' then raise exception 'Ese turno ya no está activo.'; end if;
  if t.inicio <= now() + make_interval(hours => c.horas_min_cambio) then
    raise exception 'Faltan menos de % horas: escribí por WhatsApp.', c.horas_min_cambio; end if;
  if p_inicio < now() + make_interval(hours => c.horas_min_reserva)
     or p_inicio > now() + make_interval(days => c.dias_anticipacion) then
    raise exception 'Esa fecha no está disponible.'; end if;

  v_fin := p_inicio + (t.fin - t.inicio);
  v_problema := _problema_hueco(t.profesional_id, p_inicio, v_fin, t.id);
  if v_problema is null then return 'libre'; end if;
  if v_problema <> 'Ese horario ya se ocupó. Elegí otro.' then raise exception '%', v_problema; end if;

  -- Quién tiene ese horario
  select * into o from turnos x
   where x.profesional_id = t.profesional_id and x.estado = 'confirmado' and x.id <> t.id
     and tstzrange(x.inicio, x.fin) && tstzrange(p_inicio, v_fin)
   order by x.inicio limit 1;

  -- Anti-abuso: hasta 3 pedidos sin ver por turno
  select count(*) into v_pendientes from novedades
   where tipo = 'pedido' and not vista and (datos->>'turno_id')::bigint = t.id;
  if v_pendientes >= 3 then raise exception 'Ya mandaste pedidos para este turno. Esperá que te escriban.'; end if;

  select nombre into v_serv from servicios where id = t.servicio_id;
  perform _avisar(
    'pedido',
    'Pedido de cambio: ' || t.cliente_nombre || ' (' || _cel_lindo(t.cliente_celular) || ')',
    'Quiere pasar ' || v_serv || ' del ' || _cuando(t.inicio) || ' al ' || _cuando(p_inicio)
      || coalesce(' · ese horario lo tiene ' || o.cliente_nombre || ' (' || _cel_lindo(o.cliente_celular) || ')', ''),
    t.id, p_inicio);
  -- guardar los datos para los botones del panel
  update novedades set datos = jsonb_build_object(
      'turno_id', t.id, 'solicitante', t.cliente_nombre, 'solicitante_cel', t.cliente_celular,
      'desde', t.inicio, 'hacia', p_inicio, 'servicio', v_serv,
      'ocupante_id', o.id, 'ocupante', o.cliente_nombre, 'ocupante_cel', o.cliente_celular, 'ocupante_inicio', o.inicio)
   where id = (select max(id) from novedades where tipo = 'pedido' and turno_id = t.id);
  return 'pedido';
end $$;
grant execute on function pedir_cambio(text, timestamptz) to anon, authenticated;
