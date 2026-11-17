-- =====================================================================
--  Novedades + notificaciones al celular de Victoria.
--  Correr DESPUÉS de esquema.sql. Se puede correr más de una vez.
--  Avisa solo lo que hacen las clientas desde la web (reservar, cambiar,
--  cancelar, anotarse en espera); lo que hace Victoria en el panel no.
-- =====================================================================

create extension if not exists pg_net;

-- Datos internos (dirección de la función, secreto, claves de notificación).
-- Sin políticas: nadie desde afuera lo puede leer ni escribir.
create table if not exists _interno (
  clave text primary key,
  valor text not null
);
alter table _interno enable row level security;
revoke all on _interno from anon, authenticated;

insert into _interno (clave, valor) values
  ('url_avisos', 'https://evosmggqxsszzwhljeij.supabase.co/functions/v1/avisos')
on conflict (clave) do update set valor = excluded.valor;
-- El secreto que comparten la base y la función: se genera solo, nadie lo escribe a mano.
insert into _interno (clave, valor) values ('secreto', encode(gen_random_bytes(24), 'hex'))
on conflict do nothing;

-- Lo que pasó y Victoria todavía no vio
create table if not exists novedades (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('reserva','cambio','cancelacion','espera')),
  titulo text not null,
  detalle text,
  turno_id bigint references turnos(id) on delete set null,
  fecha_turno timestamptz,
  vista boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists novedades_creado on novedades (creado desc);
alter table novedades enable row level security;
drop policy if exists admin_todo on novedades;
create policy admin_todo on novedades for all to authenticated using (true) with check (true);

-- Celulares donde Victoria activó las notificaciones
create table if not exists push_suscripciones (
  id bigint generated always as identity primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado timestamptz not null default now()
);
alter table push_suscripciones enable row level security;
drop policy if exists admin_todo on push_suscripciones;
create policy admin_todo on push_suscripciones for all to authenticated using (true) with check (true);

-- "jue 20/11 10:00" en hora de Argentina
create or replace function _cuando(t timestamptz) returns text
language sql immutable as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from _local(t))::int + 1]
         || ' ' || to_char(_local(t), 'DD/MM HH24:MI')
$$;

create or replace function _avisar(p_tipo text, p_titulo text, p_detalle text, p_turno bigint, p_fecha timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secreto text;
begin
  insert into novedades (tipo, titulo, detalle, turno_id, fecha_turno)
  values (p_tipo, p_titulo, p_detalle, p_turno, p_fecha);

  select valor into v_url from _interno where clave = 'url_avisos';
  select valor into v_secreto from _interno where clave = 'secreto';
  if v_url is null or v_url not like 'https://%.supabase.co/functions/v1/avisos' then return; end if;
  begin
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('titulo', p_titulo, 'cuerpo', p_detalle, 'url', 'admin.html#/novedades'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-aviso', v_secreto)
    );
  exception when others then
    null; -- si falla la notificación, la reserva igual se guarda
  end;
end $$;

create or replace function _novedad_turno() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_serv text; v_quien text;
begin
  -- Solo lo que hacen las clientas desde la página (las funciones públicas marcan app.origen = 'web').
  if coalesce(current_setting('app.origen', true), '') <> 'web' then return new; end if;
  select nombre into v_serv from servicios where id = new.servicio_id;
  v_quien := new.cliente_nombre;
  if tg_op = 'INSERT' then
    perform _avisar('reserva', 'Nueva reserva: ' || v_quien, v_serv || ' · ' || _cuando(new.inicio), new.id, new.inicio);
  elsif new.estado = 'cancelado' and old.estado <> 'cancelado' then
    perform _avisar('cancelacion', 'Canceló: ' || v_quien, v_serv || ' · ' || _cuando(old.inicio) || ' (quedó libre)', new.id, old.inicio);
  elsif new.inicio <> old.inicio then
    perform _avisar('cambio', 'Cambió su turno: ' || v_quien, v_serv || ' · de ' || _cuando(old.inicio) || ' a ' || _cuando(new.inicio), new.id, new.inicio);
  end if;
  return new;
end $$;

drop trigger if exists novedad_turno on turnos;
create trigger novedad_turno after insert or update of estado, inicio on turnos
  for each row execute function _novedad_turno();

create or replace function _novedad_espera() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_serv text;
begin
  if coalesce(current_setting('app.origen', true), '') <> 'web' then return new; end if;
  select nombre into v_serv from servicios where id = new.servicio_id;
  perform _avisar('espera', 'Lista de espera: ' || new.cliente_nombre,
                  v_serv || coalesce(' · ' || new.preferencia, ''), null, null);
  return new;
end $$;

drop trigger if exists novedad_espera on espera;
create trigger novedad_espera after insert on espera
  for each row execute function _novedad_espera();

revoke execute on function _avisar(text, text, text, bigint, timestamptz) from public, anon, authenticated;
