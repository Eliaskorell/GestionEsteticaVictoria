-- =====================================================================
--  VC Estética Integral · Sistema de turnos
--  Pegar entero en Supabase > SQL Editor > New query > Run.
--  Es un proyecto de Supabase NUEVO (no tiene nada que ver con otros).
-- =====================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------- Tablas ----------------------------------------------------

create table if not exists config (
  id int primary key default 1 check (id = 1),
  nombre text not null default 'VC Estética Integral',
  whatsapp text,                         -- solo números, con 549. Ej: 5493493449066
  direccion text default 'Juana Azurduy 54, Sunchales',
  instagram text default 'vc.esteticaintegral',
  dias_anticipacion int not null default 30,      -- hasta cuántos días adelante se puede reservar
  horas_min_cambio int not null default 24,       -- hasta cuántas horas antes la clienta puede cambiar/cancelar
  horas_min_reserva int not null default 2,       -- no se puede reservar con menos de X horas
  intervalo_min int not null default 15           -- cada cuántos minutos se ofrecen horarios
);
insert into config (id) values (1) on conflict do nothing;

create table if not exists profesionales (
  id bigint generated always as identity primary key,
  nombre text not null,
  rol text,
  color text not null default '#8a4d5c',
  activo boolean not null default true,
  orden int not null default 0
);

create table if not exists servicios (
  id bigint generated always as identity primary key,
  nombre text not null,
  categoria text not null default 'Estética',
  descripcion text,
  duracion_min int not null check (duracion_min between 5 and 480),
  precio numeric,                        -- null = "consultar"
  profesional_id bigint not null references profesionales(id),
  activo boolean not null default true,
  orden int not null default 0
);

-- Horario semanal de cada profesional (dia: 0 = domingo ... 6 = sábado)
create table if not exists horarios (
  id bigint generated always as identity primary key,
  profesional_id bigint not null references profesionales(id) on delete cascade,
  dia int not null check (dia between 0 and 6),
  desde time not null,
  hasta time not null check (hasta > desde)
);

-- Franjas bloqueadas (vacaciones, trámite, "me alivio la tarde").
-- profesional_id null = bloquea a todo el centro.
create table if not exists bloqueos (
  id bigint generated always as identity primary key,
  profesional_id bigint references profesionales(id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz not null check (fin > inicio),
  motivo text
);

create table if not exists turnos (
  id bigint generated always as identity primary key,
  codigo text not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  servicio_id bigint not null references servicios(id),
  profesional_id bigint not null references profesionales(id),
  inicio timestamptz not null,
  fin timestamptz not null check (fin > inicio),
  cliente_nombre text not null,
  cliente_celular text not null,
  nota text,
  estado text not null default 'confirmado'
    check (estado in ('confirmado','cancelado','completado','ausente')),
  origen text not null default 'web' check (origen in ('web','panel')),
  sobreturno boolean not null default false,     -- la metió Victoria a mano encima de otro
  recordado boolean not null default false,
  creado timestamptz not null default now(),
  -- Nunca dos turnos confirmados que se pisen para la misma profesional
  -- (salvo los sobreturnos que carga Victoria a propósito).
  constraint sin_superposicion exclude using gist (
    profesional_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado = 'confirmado' and not sobreturno)
    deferrable initially immediate
);
create index if not exists turnos_inicio on turnos (inicio);

-- Lista de espera: clientas que quieren un turno antes si se libera un hueco
create table if not exists espera (
  id bigint generated always as identity primary key,
  servicio_id bigint not null references servicios(id),
  cliente_nombre text not null,
  cliente_celular text not null,
  preferencia text,                       -- "martes a la tarde", "cualquier día"
  atendida boolean not null default false,
  creado timestamptz not null default now()
);

-- ---------- Seguridad (RLS) -----------------------------------------
-- Público: solo lee config, profesionales, servicios y horarios.
-- Todo lo demás pasa por las funciones de abajo.
-- Logueada (Victoria): acceso completo.

alter table config        enable row level security;
alter table profesionales enable row level security;
alter table servicios     enable row level security;
alter table horarios      enable row level security;
alter table bloqueos      enable row level security;
alter table turnos        enable row level security;
alter table espera        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['config','profesionales','servicios','horarios','bloqueos','turnos','espera'] loop
    execute format('drop policy if exists admin_todo on %I', t);
    execute format('create policy admin_todo on %I for all to authenticated using (true) with check (true)', t);
  end loop;
  foreach t in array array['config','profesionales','servicios','horarios'] loop
    execute format('drop policy if exists publico_lee on %I', t);
    execute format('create policy publico_lee on %I for select to anon using (true)', t);
  end loop;
end $$;

-- ---------- Funciones ------------------------------------------------

-- Hora local de Argentina
create or replace function _local(t timestamptz) returns timestamp
language sql immutable as $$ select t at time zone 'America/Argentina/Buenos_Aires' $$;

-- ¿El hueco está libre y dentro del horario? Devuelve null si está OK o el motivo.
create or replace function _problema_hueco(p_prof bigint, p_inicio timestamptz, p_fin timestamptz, p_excluir bigint default null)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from horarios h
    where h.profesional_id = p_prof
      and h.dia = extract(dow from _local(p_inicio))::int
      and _local(p_inicio)::time >= h.desde
      and _local(p_fin)::time   <= h.hasta
      and _local(p_inicio)::date = _local(p_fin)::date
  ) then return 'Ese horario está fuera de la agenda.'; end if;

  if exists (
    select 1 from bloqueos b
    where (b.profesional_id is null or b.profesional_id = p_prof)
      and tstzrange(b.inicio, b.fin) && tstzrange(p_inicio, p_fin)
  ) then return 'Ese horario no está disponible.'; end if;

  if exists (
    select 1 from turnos t
    where t.profesional_id = p_prof and t.estado = 'confirmado'
      and (p_excluir is null or t.id <> p_excluir)
      and tstzrange(t.inicio, t.fin) && tstzrange(p_inicio, p_fin)
  ) then return 'Ese horario ya se ocupó. Elegí otro.'; end if;

  return null;
end $$;

-- Horarios ocupados (sin datos personales) para armar el calendario público
create or replace function ocupados(p_desde timestamptz, p_hasta timestamptz)
returns table (profesional_id bigint, inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = public as $$
  select t.profesional_id, t.inicio, t.fin from turnos t
   where t.estado = 'confirmado' and t.inicio < p_hasta and t.fin > p_desde
  union all
  select b.profesional_id, b.inicio, b.fin from bloqueos b
   where b.inicio < p_hasta and b.fin > p_desde
$$;

create or replace function _normalizar_cel(c text) returns text
language sql immutable as $$ select regexp_replace(coalesce(c,''), '\D', '', 'g') $$;

-- Reserva desde la web
create or replace function reservar(p_servicio bigint, p_inicio timestamptz, p_nombre text, p_celular text, p_nota text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare s servicios; c config; v_fin timestamptz; v_problema text; v_codigo text;
begin
  select * into c from config where id = 1;
  select * into s from servicios where id = p_servicio and activo;
  if s.id is null then raise exception 'Ese servicio no está disponible.'; end if;
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'Falta tu nombre.'; end if;
  if length(_normalizar_cel(p_celular)) < 8 then raise exception 'Revisá el número de celular.'; end if;
  if p_inicio < now() + make_interval(hours => c.horas_min_reserva) then
    raise exception 'Ese horario ya no se puede reservar por la web. Escribinos por WhatsApp.'; end if;
  if p_inicio > now() + make_interval(days => c.dias_anticipacion) then
    raise exception 'Todavía no está abierta la agenda para esa fecha.'; end if;
  -- Anti-abuso: máximo 2 turnos futuros por celular desde la web
  if (select count(*) from turnos t
       where t.estado = 'confirmado' and t.fin > now()
         and right(_normalizar_cel(t.cliente_celular), 6) = right(_normalizar_cel(p_celular), 6)) >= 2 then
    raise exception 'Ya tenés 2 turnos reservados. Para sacar otro, escribinos por WhatsApp.'; end if;

  v_fin := p_inicio + make_interval(mins => s.duracion_min);
  v_problema := _problema_hueco(s.profesional_id, p_inicio, v_fin);
  if v_problema is not null then raise exception '%', v_problema; end if;

  insert into turnos (servicio_id, profesional_id, inicio, fin, cliente_nombre, cliente_celular, nota, origen)
  values (s.id, s.profesional_id, p_inicio, v_fin, trim(p_nombre), _normalizar_cel(p_celular), nullif(trim(p_nota),''), 'web')
  returning codigo into v_codigo;
  return v_codigo;
exception when exclusion_violation then
  raise exception 'Ese horario ya se ocupó. Elegí otro.';
end $$;

-- Buscar los turnos próximos de una clienta por celular (principal) + nombre (control).
-- Compara los últimos 6 dígitos del celular (así da igual si lo escribe con 0, 15, 54 o 9)
-- y el primer nombre sin mayúsculas ni tildes.
create or replace function _primer_nombre(n text) returns text
language sql immutable as $$
  select split_part(lower(translate(trim(coalesce(n,'')), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), ' ', 1)
$$;

create or replace function turnos_por_celular(p_celular text, p_nombre text)
returns table (codigo text, servicio text, inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if length(_normalizar_cel(p_celular)) < 8 then raise exception 'Revisá el número de celular.'; end if;
  if length(_primer_nombre(p_nombre)) < 2 then raise exception 'Escribí tu nombre como lo pusiste al reservar.'; end if;
  return query
    select t.codigo, s.nombre, t.inicio, t.fin
      from turnos t join servicios s on s.id = t.servicio_id
     where t.estado = 'confirmado' and t.fin > now()
       and right(_normalizar_cel(t.cliente_celular), 6) = right(_normalizar_cel(p_celular), 6)
       and _primer_nombre(t.cliente_nombre) = _primer_nombre(p_nombre)
     order by t.inicio;
end $$;

-- La clienta consulta su turno con el código del link
create or replace function turno_por_codigo(p_codigo text)
returns table (codigo text, servicio_id bigint, servicio text, profesional text, inicio timestamptz, fin timestamptz,
               cliente_nombre text, estado text, puede_modificar boolean, horas_min_cambio int)
language sql stable security definer set search_path = public as $$
  select t.codigo, t.servicio_id, s.nombre, p.nombre, t.inicio, t.fin, t.cliente_nombre, t.estado,
         (t.estado = 'confirmado' and t.inicio > now() + make_interval(hours => c.horas_min_cambio)),
         c.horas_min_cambio
    from turnos t join servicios s on s.id = t.servicio_id
    join profesionales p on p.id = t.profesional_id
    cross join config c
   where t.codigo = lower(trim(p_codigo))
$$;

create or replace function cancelar_turno(p_codigo text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t turnos; c config;
begin
  select * into c from config where id = 1;
  select * into t from turnos where codigo = lower(trim(p_codigo));
  if t.id is null then raise exception 'No encontramos ese turno.'; end if;
  if t.estado <> 'confirmado' then raise exception 'Ese turno ya no está activo.'; end if;
  if t.inicio <= now() + make_interval(hours => c.horas_min_cambio) then
    raise exception 'Faltan menos de % horas: para cancelar escribinos por WhatsApp.', c.horas_min_cambio; end if;
  update turnos set estado = 'cancelado' where id = t.id;
end $$;

create or replace function reprogramar_turno(p_codigo text, p_inicio timestamptz)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t turnos; c config; v_fin timestamptz; v_problema text;
begin
  select * into c from config where id = 1;
  select * into t from turnos where codigo = lower(trim(p_codigo));
  if t.id is null then raise exception 'No encontramos ese turno.'; end if;
  if t.estado <> 'confirmado' then raise exception 'Ese turno ya no está activo.'; end if;
  if t.inicio <= now() + make_interval(hours => c.horas_min_cambio) then
    raise exception 'Faltan menos de % horas: para cambiarlo escribinos por WhatsApp.', c.horas_min_cambio; end if;
  if p_inicio < now() + make_interval(hours => c.horas_min_reserva)
     or p_inicio > now() + make_interval(days => c.dias_anticipacion) then
    raise exception 'Esa fecha no está disponible.'; end if;
  v_fin := p_inicio + (t.fin - t.inicio);
  v_problema := _problema_hueco(t.profesional_id, p_inicio, v_fin, t.id);
  if v_problema is not null then raise exception '%', v_problema; end if;
  update turnos set inicio = p_inicio, fin = v_fin, recordado = false where id = t.id;
exception when exclusion_violation then
  raise exception 'Ese horario ya se ocupó. Elegí otro.';
end $$;

create or replace function anotarse_espera(p_servicio bigint, p_nombre text, p_celular text, p_preferencia text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_nombre,''))) < 2 or length(_normalizar_cel(p_celular)) < 8 then
    raise exception 'Revisá tu nombre y tu celular.'; end if;
  if (select count(*) from espera e where not e.atendida
       and right(_normalizar_cel(e.cliente_celular), 6) = right(_normalizar_cel(p_celular), 6)) >= 3 then
    raise exception 'Ya estás anotada en la lista de espera. Te avisamos si se libera un lugar.'; end if;
  insert into espera (servicio_id, cliente_nombre, cliente_celular, preferencia)
  values (p_servicio, trim(p_nombre), _normalizar_cel(p_celular), nullif(trim(p_preferencia),''));
end $$;

-- Panel: intercambiar el horario de dos turnos (A pasa al lugar de B y B al de A)
create or replace function intercambiar_turnos(p_a bigint, p_b bigint)
returns void language plpgsql volatile security invoker set search_path = public as $$
declare a turnos; b turnos;
begin
  if auth.uid() is null then raise exception 'Tenés que ingresar al panel.'; end if;
  set constraints sin_superposicion deferred;
  select * into a from turnos where id = p_a;
  select * into b from turnos where id = p_b;
  if a.id is null or b.id is null then raise exception 'No se encontraron los turnos.'; end if;
  if a.profesional_id <> b.profesional_id then
    raise exception 'Solo se pueden intercambiar turnos de la misma profesional.'; end if;
  update turnos set inicio = b.inicio, fin = b.inicio + (a.fin - a.inicio), recordado = false where id = a.id;
  update turnos set inicio = a.inicio, fin = a.inicio + (b.fin - b.inicio), recordado = false where id = b.id;
exception when exclusion_violation then
  raise exception 'Al intercambiarlos se pisan con otro turno (duran distinto). Movelos de a uno.';
end $$;

grant execute on function ocupados(timestamptz, timestamptz) to anon, authenticated;
grant execute on function reservar(bigint, timestamptz, text, text, text) to anon, authenticated;
grant execute on function turno_por_codigo(text) to anon, authenticated;
grant execute on function turnos_por_celular(text, text) to anon, authenticated;
grant execute on function cancelar_turno(text) to anon, authenticated;
grant execute on function reprogramar_turno(text, timestamptz) to anon, authenticated;
grant execute on function anotarse_espera(bigint, text, text, text) to anon, authenticated;
grant execute on function intercambiar_turnos(bigint, bigint) to authenticated;
revoke execute on function _problema_hueco(bigint, timestamptz, timestamptz, bigint) from public, anon;
