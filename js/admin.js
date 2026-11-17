// Panel de Victoria (admin.html)
import { crearDatos, linkWA, celWA } from './datos.js';
import { selectorHorario, esc } from './selector.js';
import { aISO, aMin, hoy, sumarDias, fechaDe, fechaLarga, fechaCorta, horaDe, hhmm, minDe, diaSemana, sumarMin, DIAS } from './tiempo.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
let datos, base; // base = { config, profesionales, servicios, horarios }
const estado = { vista: 'agenda', fecha: hoy(), prof: 'todas' };

const prof = (id) => base.profesionales.find((p) => p.id === id);
const serv = (id) => base.servicios.find((s) => s.id === id);
const nombreServ = (id) => serv(id)?.nombre || 'Servicio';
const ms = (iso) => new Date(iso).getTime();

function toast(txt) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = txt; document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------------------------------------------------------------- arranque
async function iniciar() {
  try { datos = await crearDatos(); } catch (e) { app.innerHTML = `<div class="envoltura"><div class="error" style="margin-top:2rem">${esc(e.message)}</div></div>`; return; }
  if (!(await datos.sesion())) return login();
  await cargarBase();
  window.addEventListener('hashchange', () => { estado.vista = location.hash.slice(2) || 'agenda'; pintar(); });
  estado.vista = location.hash.slice(2) || 'agenda';
  pintar();
}
async function cargarBase() { base = await datos.todo(); }

function login() {
  app.innerHTML = `
    <div class="envoltura login">
      <img src="img/monograma.svg" alt="" width="64" height="64" style="margin:0 auto 1rem">
      <h1 style="text-align:center;font-size:2rem">Agenda</h1>
      <p class="suave" style="text-align:center">VC Estética Integral</p>
      <form id="form">
        <div class="campo"><label for="email">Mail</label><input id="email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="clave">Contraseña</label><input id="clave" type="password" autocomplete="current-password" required></div>
        <div id="err"></div>
        <button class="boton ancho">Entrar</button>
      </form>
    </div>`;
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    try { await datos.ingresar($('#email').value.trim(), $('#clave').value); iniciar(); }
    catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
  };
}

// ---------------------------------------------------------------- estructura
const ICONOS = {
  agenda: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  nuevo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  espera: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  novedades: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  recordar: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.4A8.5 8.5 0 1 1 21 11.5Z"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
};
const TITULOS = { agenda: 'Agenda', novedades: 'Novedades', nuevo: 'Nuevo turno', espera: 'Lista de espera', recordar: 'Recordatorios', ajustes: 'Ajustes' };
const ETIQUETAS = { agenda: 'Agenda', novedades: 'Avisos', nuevo: 'Nuevo', espera: 'Espera', recordar: 'Recordar', ajustes: 'Ajustes' };

async function pintar() {
  const v = TITULOS[estado.vista] ? estado.vista : 'agenda';
  const [pendientes, sinVer] = await Promise.all([
    datos.espera().then((l) => l.filter((e) => !e.atendida).length).catch(() => 0),
    datos.novedadesSinVer().catch(() => 0),
  ]);
  app.innerHTML = `
    <header class="barra-sup"><div class="envoltura"><h1>${TITULOS[v]}</h1>
      ${v === 'agenda' ? '<button class="boton claro chico" id="ir-hoy">Hoy</button>' : ''}</div></header>
    <main class="contenido"><div class="envoltura" id="vista"><p class="cargando">Cargando…</p></div></main>
    <nav class="tabs">${Object.keys(TITULOS).map((k) => `
      <a href="#/${k}" ${k === v ? 'aria-current="page"' : ''}>${ICONOS[k]}${ETIQUETAS[k]}
      ${k === 'espera' && pendientes ? `<span class="globo">${pendientes}</span>` : ''}${k === 'novedades' && sinVer ? `<span class="globo">${sinVer}</span>` : ''}</a>`).join('')}</nav>`;
  $('#ir-hoy')?.addEventListener('click', () => { estado.fecha = hoy(); estado.mes = null; vistaAgenda(); });
  const el = $('#vista');
  try {
    await { agenda: vistaAgenda, novedades: vistaNovedades, nuevo: () => vistaNuevo(), espera: vistaEspera, recordar: vistaRecordar, ajustes: vistaAjustes }[v](el);
  } catch (e) { el.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}

// ---------------------------------------------------------------- hoja
function abrirHoja(titulo, html) {
  $('#hoja').innerHTML = `
    <div class="hoja-fondo" id="hoja-fondo"><div class="hoja" role="dialog" aria-modal="true">
      <div class="hoja-cabeza"><h2>${esc(titulo)}</h2><button class="cerrar" id="cerrar" aria-label="Cerrar">×</button></div>
      <div id="hoja-cuerpo">${html}</div></div></div>`;
  document.body.style.overflow = 'hidden';
  $('#cerrar').onclick = cerrarHoja;
  $('#hoja-fondo').onclick = (e) => { if (e.target.id === 'hoja-fondo') cerrarHoja(); };
  return $('#hoja-cuerpo');
}
function cerrarHoja() { $('#hoja').innerHTML = ''; document.body.style.overflow = ''; }

// ---------------------------------------------------------------- agenda
async function vistaAgenda(el = $('#vista')) {
  const f = estado.fecha;
  const activos = base.profesionales.filter((p) => p.activo);
  const mostrar = estado.prof === 'todas' ? activos : activos.filter((p) => p.id === +estado.prof);
  const idsMostrar = new Set(mostrar.map((p) => p.id));

  // Mes que se ve en el calendario (por defecto, el del día elegido)
  const mes = estado.mes || f.slice(0, 7);
  const primero = mes + '-01';
  const ultimo = sumarDias(sumarDias(primero, 32).slice(0, 7) + '-01', -1);
  const [turnosMes, bloqueosMes] = await Promise.all([
    datos.turnos(aISO(primero, 0), aISO(sumarDias(ultimo, 1), 0)),
    datos.bloqueos(aISO(primero, 0), aISO(sumarDias(ultimo, 1), 0)),
  ]);
  const enMes = f.slice(0, 7) === mes;
  const [turnosDia, bloqueosDia] = enMes
    ? [turnosMes.filter((t) => fechaDe(t.inicio) === f), bloqueosMes.filter((b) => fechaDe(b.inicio) <= f && fechaDe(b.fin) >= f)]
    : await Promise.all([datos.turnos(aISO(f, 0), aISO(sumarDias(f, 1), 0)), datos.bloqueos(aISO(f, 0), aISO(sumarDias(f, 1), 0))]);
  const turnos = turnosDia, bloqueos = bloqueosDia;
  const confirmados = turnos.filter((t) => t.estado === 'confirmado' && idsMostrar.has(t.profesional_id)).length;

  // Celdas del calendario: lunes a domingo
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const offset = (diaSemana(primero) + 6) % 7;
  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push('<span class="cal-vacio"></span>');
  for (let d = primero; d <= ultimo; d = sumarDias(d, 1)) {
    const n = turnosMes.filter((t) => t.estado === 'confirmado' && fechaDe(t.inicio) === d && idsMostrar.has(t.profesional_id)).length;
    const atiende = base.horarios.some((h) => h.dia === diaSemana(d) && idsMostrar.has(h.profesional_id));
    const bloqueado = bloqueosMes.some((b) => fechaDe(b.inicio) <= d && fechaDe(b.fin) >= d);
    const clases = ['cal-dia', d === f ? 'elegido' : '', d === hoy() ? 'hoy' : '', d < hoy() ? 'pasado' : '', atiende ? '' : 'cerrado'].join(' ');
    celdas.push(`<button class="${clases}" data-dia="${d}" aria-label="${fechaLarga(d)}: ${n} turno${n === 1 ? '' : 's'}" aria-pressed="${d === f}">
      <b>${+d.slice(8)}</b><small>${n ? n + (n === 1 ? ' turno' : ' turnos') : bloqueado ? 'bloq.' : ''}</small>${n ? `<i style="--n:${Math.min(n, 8)}"></i>` : ''}</button>`);
  }

  el.innerHTML = `
    <div class="calendario">
      <div class="cal-cabeza">
        <button class="flecha" id="mes-ant" aria-label="Mes anterior">‹</button>
        <b>${MESES[+mes.slice(5) - 1]} ${mes.slice(0, 4)}</b>
        <button class="flecha" id="mes-sig" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cal-grilla">${['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map((x) => `<span class="cal-sem">${x}</span>`).join('')}${celdas.join('')}</div>
    </div>
    <div class="nav-fecha" id="cabeza-dia">
      <button class="flecha" id="ant" aria-label="Día anterior">‹</button>
      <div class="titulo"><b>${f === hoy() ? 'Hoy · ' : ''}${fechaLarga(f)}</b><span class="suave chico">${confirmados} turno${confirmados === 1 ? '' : 's'}</span></div>
      <button class="flecha" id="sig" aria-label="Día siguiente">›</button>
    </div>
    <div class="filtros">
      <button class="chip" data-prof="todas" aria-pressed="${estado.prof === 'todas'}">Todas</button>
      ${activos.map((p) => `<button class="chip" data-prof="${p.id}" aria-pressed="${String(estado.prof) === String(p.id)}">${esc(p.nombre.split(' ')[0])}</button>`).join('')}
    </div>
    <div class="barra-acciones">
      <a class="boton chico" href="#/nuevo" id="btn-nuevo">+ Turno</a>
      <button class="boton claro chico" id="btn-bloquear">Bloquear horario</button>
    </div>
    <div id="dia"></div>`;

  const irA = (d, bajar = false) => {
    estado.fecha = d; estado.mes = d.slice(0, 7);
    vistaAgenda().then(() => { if (bajar) $('#cabeza-dia')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  };
  $('#ant').onclick = () => irA(sumarDias(f, -1));
  $('#sig').onclick = () => irA(sumarDias(f, 1));
  const cambiarMes = (delta) => { const d = new Date(primero + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + delta); estado.mes = d.toISOString().slice(0, 7); vistaAgenda(); };
  $('#mes-ant').onclick = () => cambiarMes(-1);
  $('#mes-sig').onclick = () => cambiarMes(1);
  el.querySelector('.cal-grilla').onclick = (e) => { const b = e.target.closest('.cal-dia'); if (b) irA(b.dataset.dia, true); };
  el.querySelector('.filtros').onclick = (e) => { const b = e.target.closest('.chip'); if (b) { estado.prof = b.dataset.prof; vistaAgenda(); } };
  $('#btn-nuevo').onclick = (e) => { e.preventDefault(); estado.nuevo = { fecha: f }; location.hash = '#/nuevo'; };
  $('#btn-bloquear').onclick = () => hojaBloqueo(f);

  const dia = diaSemana(f);
  $('#dia').innerHTML = mostrar.map((p) => {
    const franjas = base.horarios.filter((h) => h.profesional_id === p.id && h.dia === dia).map((h) => [aMin(h.desde), aMin(h.hasta)]).sort((a, b) => a[0] - b[0]);
    const sus = turnos.filter((t) => t.profesional_id === p.id);
    const blq = bloqueos.filter((b) => b.profesional_id == null || b.profesional_id === p.id);
    const items = [
      ...sus.map((t) => ({ tipo: 'turno', ini: minDe(t.inicio), t })),
      ...blq.map((b) => ({ tipo: 'bloqueo', ini: fechaDe(b.inicio) < f ? 0 : minDe(b.inicio), b })),
    ];
    // Huecos libres dentro del horario
    const ocupado = [...sus.filter((t) => t.estado === 'confirmado').map((t) => [minDe(t.inicio), minDe(t.fin)]),
      ...blq.map((b) => [fechaDe(b.inicio) < f ? 0 : minDe(b.inicio), fechaDe(b.fin) > f ? 1440 : minDe(b.fin)])].sort((a, b) => a[0] - b[0]);
    for (const [a, b] of franjas) {
      let cur = a;
      for (const [oa, ob] of ocupado) {
        if (ob <= cur || oa >= b) continue;
        if (oa > cur && oa - cur >= 30) items.push({ tipo: 'libre', ini: cur, fin: oa, prof: p.id });
        cur = Math.max(cur, ob);
      }
      if (b - cur >= 30) items.push({ tipo: 'libre', ini: cur, fin: b, prof: p.id });
    }
    items.sort((x, y) => x.ini - y.ini || (x.tipo === 'turno' ? -1 : 1));
    const cuerpo = items.length ? items.map((it) => {
      if (it.tipo === 'turno') {
        const t = it.t;
        const et = t.estado !== 'confirmado' ? `<span class="etiqueta ${t.estado === 'completado' ? 'ok' : 'mal'}">${{ cancelado: 'Cancelado', completado: 'Hecho', ausente: 'Ausente' }[t.estado]}</span>`
          : t.sobreturno ? '<span class="etiqueta sobre">Sobreturno</span>' : t.origen === 'web' ? '<span class="etiqueta">Web</span>' : '';
        return `<button class="item ${t.estado === 'cancelado' ? 'cancelado' : ''}" style="--c:${esc(p.color)}" data-turno="${t.id}">
          <span class="hora-col">${horaDe(t.inicio)}<small>${horaDe(t.fin)}</small></span>
          <span class="quien"><b>${esc(t.cliente_nombre)}</b><span>${esc(nombreServ(t.servicio_id))}</span></span>${et}</button>`;
      }
      if (it.tipo === 'bloqueo') {
        const b = it.b;
        return `<button class="item bloqueo" data-bloqueo="${b.id}"><span class="hora-col">${fechaDe(b.inicio) < f ? '—' : horaDe(b.inicio)}<small>${fechaDe(b.fin) > f ? '—' : horaDe(b.fin)}</small></span>
          <span class="quien"><b>Bloqueado</b><span>${esc(b.motivo || (b.profesional_id ? '' : 'Todo el centro'))}</span></span><span class="etiqueta">Quitar</span></button>`;
      }
      return `<button class="item libre" data-libre="${it.prof}" data-ini="${it.ini}"><span class="hora-col">${hhmm(it.ini)}<small>${hhmm(it.fin)}</small></span>
        <span class="quien"><b>Libre</b><span>${it.fin - it.ini} min · tocar para cargar</span></span><span></span></button>`;
    }).join('') : '<p class="vacio">No atiende este día.</p>';
    return `<div class="prof-titulo"><i style="background:${esc(p.color)}"></i>${esc(p.nombre)} <small>${franjas.map(([a, b]) => hhmm(a) + '–' + hhmm(b)).join(' · ') || 'sin horario'}</small></div>
      <div class="linea-tiempo">${cuerpo}</div>`;
  }).join('');

  $('#dia').onclick = (e) => {
    const it = e.target.closest('.item');
    if (!it) return;
    if (it.dataset.turno) hojaTurno(turnos.find((t) => t.id === +it.dataset.turno));
    else if (it.dataset.bloqueo) quitarBloqueo(bloqueos.find((b) => b.id === +it.dataset.bloqueo));
    else if (it.dataset.libre) { estado.nuevo = { fecha: f, prof: +it.dataset.libre, min: +it.dataset.ini }; location.hash = '#/nuevo'; }
  };
}

function hojaTurno(t) {
  const p = prof(t.profesional_id), s = serv(t.servicio_id);
  const cuerpo = abrirHoja(t.cliente_nombre, '');
  const waCliente = (txt) => linkWA(celWA(t.cliente_celular), txt);
  const linkTurno = `${location.origin}${location.pathname.replace(/admin\.html$/, '')}#/turno/${t.codigo}`;

  const principal = (msj = '') => {
    cuerpo.innerHTML = msj + `
      <div class="resumen datos-clienta">
        <b>${esc(nombreServ(t.servicio_id))}</b> · ${esc(p?.nombre)}<br>
        ${fechaLarga(fechaDe(t.inicio))}, ${horaDe(t.inicio)} a ${horaDe(t.fin)} hs<br>
        <span class="suave">Cel: <a href="tel:+${celWA(t.cliente_celular)}">${esc(t.cliente_celular)}</a> · ${t.origen === 'web' ? 'Reservó por la web' : 'Cargado en el panel'}${t.sobreturno ? ' · Sobreturno' : ''}</span>
        ${t.nota ? `<br><span class="suave">Nota: ${esc(t.nota)}</span>` : ''}
      </div>
      <div class="acciones-col">
        <a class="boton wa" target="_blank" rel="noopener" href="${waCliente(`¡Hola ${t.cliente_nombre.split(' ')[0]}! Te escribo de VC Estética Integral por tu turno de ${nombreServ(t.servicio_id)} del ${fechaLarga(fechaDe(t.inicio))} a las ${horaDe(t.inicio)} hs.`)}">WhatsApp a ${esc(t.cliente_nombre.split(' ')[0])}</a>
        ${t.estado === 'confirmado' ? `
          <button class="boton claro" id="mover">Mover a otro día u horario</button>
          <button class="boton claro" id="intercambiar">Intercambiar con otro turno</button>
          <div class="fila"><button class="boton claro chico" id="hecho">Marcar hecho</button><button class="boton claro chico" id="ausente">No vino</button></div>
          <button class="boton peligro" id="cancelar">Cancelar turno</button>`
        : `<div class="aviso">Este turno está ${esc({ cancelado: 'cancelado', completado: 'marcado como hecho', ausente: 'marcado como ausente' }[t.estado])}.</div>
           <button class="boton claro" id="reactivar">Volver a confirmarlo</button>`}
      </div>`;
    const on = (id, fn) => $('#' + id)?.addEventListener('click', fn);
    on('mover', mover); on('intercambiar', intercambiar); on('cancelar', cancelar);
    on('hecho', () => cambiarEstado('completado')); on('ausente', () => cambiarEstado('ausente'));
    on('reactivar', () => cambiarEstado('confirmado'));
  };

  const cambiarEstado = async (nuevo) => {
    try { Object.assign(t, await datos.actualizarTurno(t.id, { estado: nuevo })); toast('Listo'); vistaAgenda(); principal(); }
    catch (e) { principal(`<div class="error">${esc(e.message)}</div>`); }
  };

  const mover = () => {
    cuerpo.innerHTML = `<button class="link volver" id="volver">‹ Volver</button>
      <p>Elegí el nuevo horario para <b>${esc(t.cliente_nombre)}</b>. Se muestran solo los libres de ${esc(p?.nombre.split(' ')[0])}.</p>
      <div id="err"></div><div id="sel"></div>
      <details style="margin-top:1rem"><summary class="suave">Poner un horario a mano (aunque esté ocupado)</summary>
        <div class="fila" style="margin-top:.75rem"><input type="date" id="m-fecha" value="${fechaDe(t.inicio)}"><input type="time" id="m-hora" step="300" value="${horaDe(t.inicio)}"></div>
        <label class="check"><input type="checkbox" id="m-sobre"> Dejarlo como sobreturno si se pisa</label>
        <button class="boton ancho" id="m-ok">Mover acá</button></details>`;
    $('#volver').onclick = () => principal();
    const guardar = async (iso, sobreturno = t.sobreturno) => {
      try {
        Object.assign(t, await datos.actualizarTurno(t.id, { inicio: iso, fin: sumarMin(iso, (ms(t.fin) - ms(t.inicio)) / 60e3), sobreturno, recordado: false }));
        estado.fecha = fechaDe(t.inicio); estado.mes = null; vistaAgenda();
        principal(`<div class="ok">Movido al ${fechaLarga(fechaDe(t.inicio))} a las ${horaDe(t.inicio)}. Avisale a la clienta 👇</div>`);
        cuerpo.querySelector('.boton.wa').href = waCliente(`¡Hola ${t.cliente_nombre.split(' ')[0]}! Te cambiamos el turno de ${nombreServ(t.servicio_id)} para el ${fechaLarga(fechaDe(t.inicio))} a las ${horaDe(t.inicio)} hs. Si no te queda bien avisame. Tu turno: ${linkTurno}`);
      } catch (e) { $('#err').innerHTML = `<div class="error">${esc(e.message)}</div>`; $('#err').scrollIntoView({ block: 'nearest' }); }
    };
    selectorHorario($('#sel'), {
      datos, pub: base, servicio: { duracion_min: (ms(t.fin) - ms(t.inicio)) / 60e3, profesional_id: t.profesional_id },
      ignorar: { inicio: t.inicio, profesional_id: t.profesional_id }, ignorarLimites: true, dias: 60,
      alElegir: (iso) => guardar(iso),
    });
    $('#m-ok').onclick = () => { const fe = $('#m-fecha').value, h = $('#m-hora').value; if (fe && h) guardar(aISO(fe, aMin(h)), $('#m-sobre').checked); };
  };

  const intercambiar = async () => {
    cuerpo.innerHTML = '<p class="cargando">Buscando turnos…</p>';
    const desde = aISO(sumarDias(hoy(), -1), 0), hasta = aISO(sumarDias(hoy(), 45), 0);
    const otros = (await datos.turnos(desde, hasta)).filter((o) => o.id !== t.id && o.estado === 'confirmado' && o.profesional_id === t.profesional_id);
    cuerpo.innerHTML = `<button class="link volver" id="volver">‹ Volver</button>
      <p><b>${esc(t.cliente_nombre)}</b> (${fechaCorta(fechaDe(t.inicio))} ${horaDe(t.inicio)}) pasa al horario del turno que elijas, y esa clienta pasa al de ella.</p>
      <div id="err"></div>
      ${otros.length ? otros.map((o) => `<button class="item" style="--c:${esc(p?.color)}" data-id="${o.id}">
        <span class="hora-col">${horaDe(o.inicio)}<small>${fechaCorta(fechaDe(o.inicio))}</small></span>
        <span class="quien"><b>${esc(o.cliente_nombre)}</b><span>${esc(nombreServ(o.servicio_id))}</span></span><span></span></button>`).join('<div style="height:.45rem"></div>')
      : '<p class="vacio">No hay otros turnos de esta profesional para intercambiar.</p>'}`;
    $('#volver').onclick = () => principal();
    const elegir = async (e) => {
      const b = e.target.closest('.item[data-id]');
      if (!b) return;
      cuerpo.onclick = null;
      const o = otros.find((x) => x.id === +b.dataset.id);
      try {
        await datos.intercambiar(t.id, o.id);
        const nuevoT = o.inicio, nuevoO = t.inicio;
        vistaAgenda();
        cuerpo.innerHTML = `<div class="ok">¡Intercambiados! Avisales a las dos:</div>
          <div class="acciones-col">
            <a class="boton wa" target="_blank" rel="noopener" href="${waCliente(`¡Hola ${t.cliente_nombre.split(' ')[0]}! Te pasamos el turno de ${nombreServ(t.servicio_id)} al ${fechaLarga(fechaDe(nuevoT))} a las ${horaDe(nuevoT)} hs. ¿Te queda bien?`)}">Avisar a ${esc(t.cliente_nombre)}</a>
            <a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(o.cliente_celular), `¡Hola ${o.cliente_nombre.split(' ')[0]}! Te pasamos el turno de ${nombreServ(o.servicio_id)} al ${fechaLarga(fechaDe(nuevoO))} a las ${horaDe(nuevoO)} hs. ¿Te queda bien?`)}">Avisar a ${esc(o.cliente_nombre)}</a>
            <button class="boton claro" id="cerrar2">Listo</button></div>`;
        $('#cerrar2').onclick = cerrarHoja;
      } catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; cuerpo.onclick = elegir; }
    };
    cuerpo.onclick = elegir;
  };

  const cancelar = () => {
    cuerpo.innerHTML = `<p>¿Cancelar el turno de <b>${esc(t.cliente_nombre)}</b>? El horario queda libre.</p><div id="err"></div>
      <div class="acciones-col"><button class="boton peligro" id="si">Sí, cancelar</button><button class="boton claro" id="no">No</button></div>`;
    $('#no').onclick = () => principal();
    $('#si').onclick = async () => {
      try {
        await datos.actualizarTurno(t.id, { estado: 'cancelado' });
        t.estado = 'cancelado';
        vistaAgenda();
        const enEspera = (await datos.espera()).filter((e) => !e.atendida && serv(e.servicio_id)?.profesional_id === t.profesional_id);
        const hueco = `${fechaLarga(fechaDe(t.inicio))} a las ${horaDe(t.inicio)} hs`;
        cuerpo.innerHTML = `<div class="ok">Turno cancelado. Se liberó el ${hueco}.</div>
          <a class="boton wa ancho" target="_blank" rel="noopener" href="${waCliente(`¡Hola ${t.cliente_nombre.split(' ')[0]}! Te confirmo que cancelamos tu turno del ${hueco}. Cuando quieras reservás de nuevo.`)}">Avisarle a ${esc(t.cliente_nombre.split(' ')[0])}</a>
          ${enEspera.length ? `<h3 style="margin-top:1.25rem">Hay ${enEspera.length} en lista de espera</h3><p class="suave chico">Ofreceles el hueco:</p>
            ${enEspera.map((e) => `<div class="tarjeta-lista"><div class="fila-flex"><div><b>${esc(e.cliente_nombre)}</b><br><span class="suave chico">${esc(nombreServ(e.servicio_id))}${e.preferencia ? ' · ' + esc(e.preferencia) : ''}</span></div>
              <a class="boton wa chico" target="_blank" rel="noopener" href="${linkWA(celWA(e.cliente_celular), `¡Hola ${e.cliente_nombre.split(' ')[0]}! Se liberó un turno el ${hueco} en VC Estética Integral. ¿Te sirve?`)}">Ofrecer</a></div></div>`).join('')}` : ''}`;
      } catch (e) { $('#err').innerHTML = `<div class="error">${esc(e.message)}</div>`; }
    };
  };
  principal();
}

function hojaBloqueo(fecha) {
  const cuerpo = abrirHoja('Bloquear horario', `
    <p class="suave">Para trámites, vacaciones o para alivianarte el día. Nadie va a poder reservar en esa franja.</p>
    <form id="form">
      <div class="campo"><label for="b-prof">¿De quién?</label><select id="b-prof"><option value="">Todo el centro</option>
        ${base.profesionales.filter((p) => p.activo).map((p) => `<option value="${p.id}" ${String(estado.prof) === String(p.id) ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>
      <div class="fila"><div class="campo"><label for="b-desde-f">Desde</label><input type="date" id="b-desde-f" value="${fecha}"></div><div class="campo"><label for="b-desde-h">Hora</label><input type="time" id="b-desde-h" value="08:00" step="300"></div></div>
      <div class="fila"><div class="campo"><label for="b-hasta-f">Hasta</label><input type="date" id="b-hasta-f" value="${fecha}"></div><div class="campo"><label for="b-hasta-h">Hora</label><input type="time" id="b-hasta-h" value="20:00" step="300"></div></div>
      <div class="campo"><label for="b-motivo">Motivo <span class="suave">(solo lo ves vos)</span></label><input id="b-motivo" placeholder="Ej: trámite, vacaciones"></div>
      <div id="err"></div>
      <button class="boton ancho">Bloquear</button>
    </form>`);
  $('#form', cuerpo).onsubmit = async (e) => {
    e.preventDefault();
    const inicio = aISO($('#b-desde-f').value, aMin($('#b-desde-h').value)), fin = aISO($('#b-hasta-f').value, aMin($('#b-hasta-h').value));
    if (ms(fin) <= ms(inicio)) { $('#err').innerHTML = '<div class="error">El "hasta" tiene que ser después del "desde".</div>'; return; }
    try {
      await datos.crearBloqueo({ profesional_id: $('#b-prof').value ? +$('#b-prof').value : null, inicio, fin, motivo: $('#b-motivo').value.trim() || null });
      cerrarHoja(); toast('Horario bloqueado'); vistaAgenda();
    } catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
  };
}

function quitarBloqueo(b) {
  const cuerpo = abrirHoja('Bloqueo', `
    <div class="resumen">${esc(b.profesional_id ? prof(b.profesional_id)?.nombre : 'Todo el centro')}<br>
      ${fechaCorta(fechaDe(b.inicio))} ${horaDe(b.inicio)} → ${fechaCorta(fechaDe(b.fin))} ${horaDe(b.fin)}${b.motivo ? '<br><span class="suave">' + esc(b.motivo) + '</span>' : ''}</div>
    <button class="boton peligro ancho" id="quitar">Quitar bloqueo</button>`);
  $('#quitar', cuerpo).onclick = async () => { await datos.borrarBloqueo(b.id); cerrarHoja(); toast('Bloqueo quitado'); vistaAgenda(); };
}

// ---------------------------------------------------------------- nuevo turno
function vistaNuevo(el = $('#vista')) {
  const pre = estado.nuevo || {}; estado.nuevo = null;
  const activos = base.servicios.filter((s) => s.activo);
  const preServ = pre.prof ? activos.find((s) => s.profesional_id === pre.prof) : null;
  el.innerHTML = `
    <p class="suave">Para los turnos que te piden por WhatsApp, en persona o por teléfono.</p>
    <form id="form" novalidate>
      <div class="campo"><label for="n-serv">Servicio</label><select id="n-serv">
        ${[...new Set(activos.map((s) => s.categoria))].map((c) => `<optgroup label="${esc(c)}">${activos.filter((s) => s.categoria === c).map((s) => `<option value="${s.id}" ${preServ?.id === s.id ? 'selected' : ''}>${esc(s.nombre)} · ${s.duracion_min} min · ${esc(prof(s.profesional_id)?.nombre.split(' ')[0])}</option>`).join('')}</optgroup>`).join('')}
      </select></div>
      <div class="fila">
        <div class="campo"><label for="n-nombre">Nombre</label><input id="n-nombre" autocomplete="off"></div>
        <div class="campo"><label for="n-apellido">Apellido</label><input id="n-apellido" autocomplete="off"></div>
        <div class="campo"><label for="n-cel">Celular</label><input id="n-cel" type="tel" inputmode="tel" autocomplete="off"></div>
      </div>
      <div class="campo"><label for="n-nota">Nota <span class="suave">(opcional)</span></label><input id="n-nota"></div>
      <label class="check"><input type="checkbox" id="n-manual" ${pre.min != null ? 'checked' : ''}> Elegir el horario a mano (sobreturno o fuera de agenda)</label>
      <div id="n-auto"><label>Horarios libres</label><div id="n-sel"></div></div>
      <div id="n-man" class="oculto">
        <div class="fila"><div class="campo"><label for="n-fecha">Día</label><input type="date" id="n-fecha" value="${pre.fecha || hoy()}"></div>
        <div class="campo"><label for="n-hora">Hora</label><input type="time" id="n-hora" step="300" value="${pre.min != null ? hhmm(pre.min) : ''}"></div></div>
        <label class="check"><input type="checkbox" id="n-sobre"> Es sobreturno (puede pisarse con otro)</label>
      </div>
      <div class="resumen oculto" id="n-elegido"></div>
      <div id="err"></div>
      <button class="boton ancho" id="n-ok">Guardar turno</button>
    </form>`;
  let elegido = null;
  const servicio = () => serv(+$('#n-serv').value);
  const cargarSel = () => {
    elegido = null; $('#n-elegido').classList.add('oculto');
    selectorHorario($('#n-sel'), {
      datos, pub: base, servicio: servicio(), ignorarLimites: true, dias: 60,
      alElegir: (iso) => { elegido = iso; $('#n-elegido').classList.remove('oculto'); $('#n-elegido').innerHTML = `<b>${fechaLarga(fechaDe(iso))}, ${horaDe(iso)} hs</b>`; },
    });
  };
  const modo = () => {
    const manual = $('#n-manual').checked;
    $('#n-auto').classList.toggle('oculto', manual); $('#n-man').classList.toggle('oculto', !manual);
    if (!manual && !$('#n-sel').innerHTML) cargarSel();
  };
  $('#n-serv').onchange = () => { $('#n-sel').innerHTML = ''; if (!$('#n-manual').checked) cargarSel(); };
  $('#n-manual').onchange = modo;
  modo();

  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const err = (m) => { $('#err').innerHTML = `<div class="error">${esc(m)}</div>`; };
    const s = servicio(), cel = $('#n-cel').value.trim();
    const nom = $('#n-nombre').value.trim(), ape = $('#n-apellido').value.trim();
    if (nom.length < 2) return err('Poné el nombre de la clienta.');
    if (ape.length < 2) return err('Poné el apellido de la clienta.');
    const nombre = `${nom} ${ape}`;
    if (cel.replace(/\D/g, '').length < 8) return err('Revisá el celular.');
    let inicio = elegido, sobreturno = false;
    if ($('#n-manual').checked) {
      if (!$('#n-fecha').value || !$('#n-hora').value) return err('Elegí día y hora.');
      inicio = aISO($('#n-fecha').value, aMin($('#n-hora').value)); sobreturno = $('#n-sobre').checked;
    }
    if (!inicio) return err('Elegí un horario.');
    $('#n-ok').disabled = true;
    try {
      const t = await datos.crearTurno({ servicio_id: s.id, profesional_id: s.profesional_id, inicio, fin: sumarMin(inicio, s.duracion_min), cliente_nombre: nombre, cliente_celular: cel.replace(/\D/g, ''), nota: $('#n-nota').value.trim() || null, sobreturno });
      const link = `${location.origin}${location.pathname.replace(/admin\.html$/, '')}#/turno/${t.codigo}`;
      el.innerHTML = `<div class="ok"><b>Turno guardado.</b></div>
        <div class="resumen"><b>${esc(nombre)}</b> · ${esc(s.nombre)}<br>${fechaLarga(fechaDe(inicio))}, ${horaDe(inicio)} hs</div>
        <div class="acciones-col">
          <a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(cel), `¡Hola ${nombre.split(' ')[0]}! Te confirmo tu turno de ${s.nombre} el ${fechaLarga(fechaDe(inicio))} a las ${horaDe(inicio)} hs en VC Estética Integral. Si necesitás cambiarlo o cancelarlo: ${link}`)}">Mandarle la confirmación</a>
          <button class="boton claro" id="otro">Cargar otro</button>
          <button class="boton claro" id="ver">Ver en la agenda</button></div>`;
      $('#otro').onclick = () => vistaNuevo();
      $('#ver').onclick = () => { estado.fecha = fechaDe(inicio); estado.mes = null; location.hash = '#/agenda'; };
    } catch (er) { err(er.message); $('#n-ok').disabled = false; }
  };
}

// ---------------------------------------------------------------- espera
async function vistaEspera(el = $('#vista')) {
  const lista = (await datos.espera()).sort((a, b) => a.atendida - b.atendida || ms(a.creado) - ms(b.creado));
  el.innerHTML = `<p class="suave">Clientas que quieren un turno si se libera un hueco. Cuando alguien cancela, te las muestro para ofrecerles el lugar.</p>` +
    (lista.length ? lista.map((e) => `
      <div class="tarjeta-lista" style="${e.atendida ? 'opacity:.55' : ''}">
        <div class="fila-flex"><div><b>${esc(e.cliente_nombre)}</b><br><span class="suave chico">${esc(nombreServ(e.servicio_id))}${e.preferencia ? ' · ' + esc(e.preferencia) : ''} · desde ${fechaCorta(fechaDe(e.creado))}</span></div></div>
        <div class="acciones">
          <a class="boton wa chico" target="_blank" rel="noopener" href="${linkWA(celWA(e.cliente_celular), `¡Hola ${e.cliente_nombre.split(' ')[0]}! Te escribo de VC Estética Integral: se liberó un turno para ${nombreServ(e.servicio_id)}.`)}">WhatsApp</a>
          <button class="boton claro chico" data-id="${e.id}" data-at="${e.atendida ? 0 : 1}">${e.atendida ? 'Volver a la lista' : 'Ya la atendí'}</button>
        </div>
      </div>`).join('') : '<p class="vacio">Nadie en lista de espera.</p>');
  el.onclick = async (ev) => { const b = ev.target.closest('button[data-id]'); if (!b) return; await datos.marcarEspera(+b.dataset.id, b.dataset.at === '1'); pintar(); };
}

// ---------------------------------------------------------------- novedades
const ICONO_NOV = { reserva: '📅', cambio: '🔁', cancelacion: '✖️', espera: '⏳', pedido: '🙋' };
function hace(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `${fechaCorta(fechaDe(iso))} ${horaDe(iso)}`;
}
async function vistaNovedades(el = $('#vista')) {
  const lista = await datos.novedades();
  el.innerHTML = `<p class="suave">Lo que hicieron las clientas desde la página: reservas, cambios, cancelaciones y anotadas en espera.</p>` +
    (lista.length ? lista.map((n) => `
      <button class="novedad t-${esc(n.tipo)} ${n.vista ? '' : 'nueva'}" ${n.tipo === 'pedido' ? `data-pedido="${n.id}"` : n.fecha_turno ? `data-fecha="${fechaDe(n.fecha_turno)}"` : `data-espera="1"`}>
        <span class="ico" aria-hidden="true">${ICONO_NOV[n.tipo] || '•'}</span>
        <span><b>${esc(n.titulo)}</b>${esc(n.detalle || '')}<small>${hace(n.creado)}</small></span>
      </button>`).join('') : '<p class="vacio">Todavía no hay novedades.</p>');
  el.onclick = (e) => {
    const b = e.target.closest('.novedad');
    if (!b) return;
    if (b.dataset.pedido) { hojaPedido(lista.find((n) => n.id === +b.dataset.pedido)); return; }
    if (b.dataset.fecha) { estado.fecha = b.dataset.fecha; estado.mes = null; location.hash = '#/agenda'; }
    else location.hash = '#/espera';
  };
  if (lista.some((n) => !n.vista)) {
    await datos.marcarNovedadesVistas();
    $('.tabs a[href="#/novedades"] .globo')?.remove();
  }
}

function hojaPedido(n) {
  const x = n.datos || {};
  const pri = (nombre) => String(nombre || '').split(' ')[0];
  const cuando = (iso) => iso ? `${fechaLarga(fechaDe(iso))} a las ${horaDe(iso)}` : '';
  const cuerpo = abrirHoja('Pedido de cambio', `
    <div class="resumen"><b>${esc(x.solicitante || '')}</b> · ${esc(x.solicitante_cel || '')}<br>
      Quiere pasar <b>${esc(x.servicio || '')}</b><br>del ${cuando(x.desde)}<br>al <b>${cuando(x.hacia)}</b></div>
    ${x.ocupante ? `<div class="resumen">Ese horario lo tiene <b>${esc(x.ocupante)}</b> · ${esc(x.ocupante_cel || '')}<br><span class="suave">${cuando(x.ocupante_inicio)}</span></div>` : '<div class="aviso">Ese horario ya se liberó: podés moverla desde la agenda.</div>'}
    <div id="err"></div>
    <div class="acciones-col">
      <a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(x.solicitante_cel), `¡Hola ${pri(x.solicitante)}! Recibí tu pedido para pasar tu turno de ${x.servicio} al ${cuando(x.hacia)} hs. Me fijo si se puede y te aviso.`)}">WhatsApp a ${esc(pri(x.solicitante))} (pide el cambio)</a>
      ${x.ocupante ? `<a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(x.ocupante_cel), `¡Hola ${pri(x.ocupante)}! ¿Te quedaría bien pasar tu turno del ${cuando(x.ocupante_inicio)} hs al ${cuando(x.desde)} hs? Así le hago lugar a otra clienta. ¡Gracias!`)}">WhatsApp a ${esc(pri(x.ocupante))} (tiene ese horario)</a>
      <button class="boton claro" id="intercambiar-pedido">Intercambiar los dos turnos</button>` : ''}
    </div>`);
  $('#intercambiar-pedido', cuerpo)?.addEventListener('click', async () => {
    try {
      await datos.intercambiar(x.turno_id, x.ocupante_id);
      cuerpo.innerHTML = `<div class="ok">¡Intercambiados! ${esc(pri(x.solicitante))} pasó al ${cuando(x.ocupante_inicio)} y ${esc(pri(x.ocupante))} al ${cuando(x.desde)}.</div>
        <div class="acciones-col">
          <a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(x.solicitante_cel), `¡Hola ${pri(x.solicitante)}! Listo, te pasé el turno al ${cuando(x.ocupante_inicio)} hs. ¡Te espero!`)}">Avisar a ${esc(pri(x.solicitante))}</a>
          <a class="boton wa" target="_blank" rel="noopener" href="${linkWA(celWA(x.ocupante_cel), `¡Hola ${pri(x.ocupante)}! Gracias por cambiar: tu turno quedó el ${cuando(x.desde)} hs. ¡Te espero!`)}">Avisar a ${esc(pri(x.ocupante))}</a>
        </div>`;
    } catch (er) { $('#err', cuerpo).innerHTML = `<div class="error">${esc(er.message)}</div>`; }
  });
}

// ---------------------------------------------------------------- recordatorios
async function vistaRecordar(el = $('#vista')) {
  const manana = sumarDias(hoy(), 1);
  const lista = (await datos.turnos(aISO(hoy(), 0), aISO(sumarDias(manana, 1), 0))).filter((t) => t.estado === 'confirmado' && ms(t.inicio) > Date.now());
  const grupo = (f, titulo) => {
    const ts = lista.filter((t) => fechaDe(t.inicio) === f);
    return `<h3 style="margin-top:1rem">${titulo}</h3>` + (ts.length ? ts.map((t) => {
      const link = `${location.origin}${location.pathname.replace(/admin\.html$/, '')}#/turno/${t.codigo}`;
      const txt = `¡Hola ${t.cliente_nombre.split(' ')[0]}! Te recuerdo tu turno de ${nombreServ(t.servicio_id)} ${f === hoy() ? 'hoy' : 'mañana'} a las ${horaDe(t.inicio)} hs en VC Estética Integral (${base.config.direccion}). Si no podés venir, avisame así le doy el lugar a otra persona 🙏 ${link}`;
      return `<div class="tarjeta-lista"><div class="fila-flex"><div><b>${horaDe(t.inicio)} · ${esc(t.cliente_nombre)}</b><br><span class="suave chico">${esc(nombreServ(t.servicio_id))} · ${esc(prof(t.profesional_id)?.nombre.split(' ')[0])}</span></div>
        ${t.recordado ? '<span class="etiqueta ok">Enviado</span>' : ''}</div>
        <div class="acciones"><a class="boton wa chico" target="_blank" rel="noopener" data-id="${t.id}" href="${linkWA(celWA(t.cliente_celular), txt)}">${t.recordado ? 'Reenviar' : 'Enviar recordatorio'}</a></div></div>`;
    }).join('') : '<p class="vacio">No hay turnos.</p>');
  };
  el.innerHTML = `<p class="suave">Un toque por clienta y se abre WhatsApp con el mensaje listo. Así se olvidan menos y avisan si no pueden venir.</p>` + grupo(manana, 'Mañana · ' + fechaLarga(manana)) + grupo(hoy(), 'Hoy');
  el.onclick = async (ev) => {
    const a = ev.target.closest('a[data-id]');
    if (a) { await datos.actualizarTurno(+a.dataset.id, { recordado: true }); setTimeout(() => vistaRecordar(), 400); }
  };
}

// ---------------------------------------------------------------- ajustes
async function vistaAjustes(el = $('#vista')) {
  await cargarBase();
  const c = base.config;
  const opcionesProf = (sel) => base.profesionales.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('');
  el.innerHTML = `
    <section class="seccion-ajustes">
      <h2>Reglas de la agenda</h2>
      <form id="f-config">
        <div class="fila">
          <div class="campo"><label for="c-dias">Se puede reservar hasta (días adelante)</label><input id="c-dias" type="number" min="1" max="365" value="${c.dias_anticipacion}"></div>
          <div class="campo"><label for="c-cambio">Cambiar/cancelar por la web hasta (horas antes)</label><input id="c-cambio" type="number" min="0" max="168" value="${c.horas_min_cambio}"></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="c-res">No reservar con menos de (horas)</label><input id="c-res" type="number" min="0" max="72" value="${c.horas_min_reserva}"></div>
          <div class="campo"><label for="c-int">Mostrar horarios cada (minutos)</label><select id="c-int">${[10, 15, 20, 30, 60].map((n) => `<option ${n === c.intervalo_min ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="c-wa">WhatsApp del centro</label><input id="c-wa" inputmode="tel" value="${esc(c.whatsapp || '')}" placeholder="5493493…"></div>
          <div class="campo"><label for="c-dir">Dirección</label><input id="c-dir" value="${esc(c.direccion || '')}"></div>
        </div>
        <button class="boton">Guardar reglas</button>
      </form>
    </section>

    <section class="seccion-ajustes">
      <h2>Servicios</h2>
      <div id="lista-serv">${base.servicios.map((s) => `
        <div class="tarjeta-lista" style="${s.activo ? '' : 'opacity:.55'}"><div class="fila-flex"><div><b>${esc(s.nombre)}</b><br>
          <span class="suave chico">${esc(s.categoria)} · ${s.duracion_min} min · ${s.precio != null ? '$' + Number(s.precio).toLocaleString('es-AR') : 'precio a consultar'} · ${esc(prof(s.profesional_id)?.nombre.split(' ')[0])}${s.activo ? '' : ' · oculto'}</span></div>
          <button class="boton claro chico" data-serv="${s.id}">Editar</button></div></div>`).join('')}</div>
      <button class="boton claro" data-serv="nuevo">+ Agregar servicio</button>
    </section>

    <section class="seccion-ajustes">
      <h2>Equipo y horarios</h2>
      ${base.profesionales.map((p) => `
        <div class="tarjeta-lista" style="${p.activo ? '' : 'opacity:.55'}"><div class="fila-flex"><div><b><span style="color:${esc(p.color)}">●</span> ${esc(p.nombre)}</b><br><span class="suave chico">${esc(p.rol || '')}</span></div>
          <div class="acciones" style="margin:0"><button class="boton claro chico" data-prof="${p.id}">Editar</button><button class="boton claro chico" data-horario="${p.id}">Horario</button></div></div></div>`).join('')}
      <button class="boton claro" data-prof="nuevo">+ Agregar profesional</button>
    </section>

    <section class="seccion-ajustes">
      <h2>Notificaciones</h2>
      <p class="suave">Te avisa en este celular cuando una clienta reserva, cambia o cancela un turno, o se anota en la lista de espera.</p>
      <div id="estado-push"></div>
    </section>

    <section class="seccion-ajustes">
      <button class="boton peligro" id="salir">Cerrar sesión</button>
    </section>`;

  $('#f-config').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await datos.guardar('config', { id: 1, dias_anticipacion: +$('#c-dias').value, horas_min_cambio: +$('#c-cambio').value, horas_min_reserva: +$('#c-res').value, intervalo_min: +$('#c-int').value, whatsapp: $('#c-wa').value.replace(/\D/g, '') || null, direccion: $('#c-dir').value.trim() });
      await cargarBase(); toast('Reglas guardadas');
    } catch (er) { toast(er.message); }
  };
  $('#salir').onclick = async () => { await datos.salir(); location.reload(); };
  pintarPush();
  el.onclick = (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.serv) editarServicio(b.dataset.serv === 'nuevo' ? null : serv(+b.dataset.serv), opcionesProf);
    if (b.dataset.prof) editarProfesional(b.dataset.prof === 'nuevo' ? null : prof(+b.dataset.prof));
    if (b.dataset.horario) editarHorario(prof(+b.dataset.horario));
  };
}

function editarServicio(s, opcionesProf) {
  const n = s || { nombre: '', categoria: 'Facial', descripcion: '', duracion_min: 60, precio: null, profesional_id: base.profesionales[0]?.id, activo: true, orden: base.servicios.length + 1 };
  const cats = [...new Set(base.servicios.map((x) => x.categoria))];
  const cuerpo = abrirHoja(s ? 'Editar servicio' : 'Nuevo servicio', `
    <form id="form">
      <div class="campo"><label for="s-nombre">Nombre</label><input id="s-nombre" value="${esc(n.nombre)}"></div>
      <div class="fila"><div class="campo"><label for="s-cat">Categoría</label><input id="s-cat" list="cats" value="${esc(n.categoria)}"><datalist id="cats">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="campo"><label for="s-prof">Lo hace</label><select id="s-prof">${opcionesProf(n.profesional_id)}</select></div></div>
      <div class="fila"><div class="campo"><label for="s-dur">Duración (min)</label><input id="s-dur" type="number" min="5" step="5" value="${n.duracion_min}"></div>
        <div class="campo"><label for="s-precio">Precio <span class="suave">(vacío = consultar)</span></label><input id="s-precio" type="number" min="0" value="${n.precio ?? ''}"></div></div>
      <div class="campo"><label for="s-desc">Descripción</label><textarea id="s-desc">${esc(n.descripcion || '')}</textarea></div>
      <label class="check"><input type="checkbox" id="s-activo" ${n.activo ? 'checked' : ''}> Visible en la página</label>
      <div id="err"></div>
      <button class="boton ancho">Guardar</button>
    </form>`);
  $('#form', cuerpo).onsubmit = async (e) => {
    e.preventDefault();
    const fila = { ...(s ? { id: s.id } : { orden: n.orden }), nombre: $('#s-nombre').value.trim(), categoria: $('#s-cat').value.trim() || 'Estética', profesional_id: +$('#s-prof').value, duracion_min: +$('#s-dur').value, precio: $('#s-precio').value === '' ? null : +$('#s-precio').value, descripcion: $('#s-desc').value.trim() || null, activo: $('#s-activo').checked };
    if (!fila.nombre) { $('#err').innerHTML = '<div class="error">Poné un nombre.</div>'; return; }
    try { await datos.guardar('servicios', fila); cerrarHoja(); toast('Servicio guardado'); vistaAjustes(); }
    catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
  };
}

function editarProfesional(p) {
  const n = p || { nombre: '', rol: '', color: '#8a4d5c', activo: true, orden: base.profesionales.length + 1 };
  const cuerpo = abrirHoja(p ? 'Editar profesional' : 'Nueva profesional', `
    <form id="form">
      <div class="campo"><label for="p-nombre">Nombre</label><input id="p-nombre" value="${esc(n.nombre)}"></div>
      <div class="campo"><label for="p-rol">Qué hace</label><input id="p-rol" value="${esc(n.rol || '')}" placeholder="Ej: Manos y pies"></div>
      <div class="campo"><label for="p-color">Color en la agenda</label><input id="p-color" type="color" value="${esc(n.color)}" style="padding:.3rem"></div>
      <label class="check"><input type="checkbox" id="p-activo" ${n.activo ? 'checked' : ''}> Activa (aparece en la página y la agenda)</label>
      <div id="err"></div>
      <button class="boton ancho">Guardar</button>
    </form>`);
  $('#form', cuerpo).onsubmit = async (e) => {
    e.preventDefault();
    const fila = { ...(p ? { id: p.id } : { orden: n.orden }), nombre: $('#p-nombre').value.trim(), rol: $('#p-rol').value.trim() || null, color: $('#p-color').value, activo: $('#p-activo').checked };
    if (!fila.nombre) { $('#err').innerHTML = '<div class="error">Poné un nombre.</div>'; return; }
    try { await datos.guardar('profesionales', fila); await cargarBase(); cerrarHoja(); toast('Guardado'); vistaAjustes(); }
    catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
  };
}

function editarHorario(p) {
  const cuerpo = abrirHoja(`Horario de ${p.nombre.split(' ')[0]}`, '');
  const pintarH = () => {
    const suyos = base.horarios.filter((h) => h.profesional_id === p.id);
    cuerpo.innerHTML = `<p class="suave chico">Las franjas en que se le pueden reservar turnos. Para un día puntual usá "Bloquear horario" en la agenda.</p>` +
      [1, 2, 3, 4, 5, 6, 0].map((d) => `
        <div class="dia-horario"><b>${DIAS[d]}</b>
          ${suyos.filter((h) => h.dia === d).sort((a, b) => aMin(a.desde) - aMin(b.desde)).map((h) => `
            <div class="franja"><input type="time" value="${h.desde.slice(0, 5)}" data-id="${h.id}" data-campo="desde" step="300"><input type="time" value="${h.hasta.slice(0, 5)}" data-id="${h.id}" data-campo="hasta" step="300">
            <button class="boton claro chico" data-borrar="${h.id}" aria-label="Quitar franja">×</button></div>`).join('') || '<p class="suave chico" style="margin:0 0 .4rem">No atiende</p>'}
          <button class="link chico" data-agregar="${d}">+ agregar franja</button>
        </div>`).join('');
  };
  pintarH();
  cuerpo.onclick = async (e) => {
    const b = e.target.closest('[data-borrar],[data-agregar]');
    if (!b) return;
    try {
      if (b.dataset.borrar) await datos.borrar('horarios', +b.dataset.borrar);
      else await datos.guardar('horarios', { profesional_id: p.id, dia: +b.dataset.agregar, desde: '09:00', hasta: '13:00' });
      await cargarBase(); pintarH();
    } catch (er) { toast(er.message); }
  };
  cuerpo.onchange = async (e) => {
    const i = e.target.closest('input[data-id]');
    if (!i) return;
    const h = base.horarios.find((x) => x.id === +i.dataset.id);
    const fila = { id: h.id, desde: h.desde, hasta: h.hasta, [i.dataset.campo]: i.value };
    if (aMin(fila.hasta) <= aMin(fila.desde)) { toast('El fin tiene que ser después del inicio'); pintarH(); return; }
    try { await datos.guardar('horarios', fila); await cargarBase(); toast('Horario guardado'); } catch (er) { toast(er.message); }
  };
}

iniciar();

// ---------------------------------------------------------------- notificaciones push
const b64aUint8 = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};
const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

async function pintarPush() {
  const el = $('#estado-push');
  if (!el) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    el.innerHTML = esIOS() && !instalada()
      ? '<div class="aviso">En iPhone primero instalá el panel: tocá <b>Compartir → Agregar a pantalla de inicio</b>, abrilo desde ese ícono y volvé a esta pantalla.</div>'
      : '<div class="aviso">Este navegador no permite notificaciones. Probá desde Chrome en el celular.</div>';
    return;
  }
  const reg = await navigator.serviceWorker.register('sw.js');
  const sub = await reg.pushManager.getSubscription();
  if (Notification.permission === 'denied') {
    el.innerHTML = '<div class="aviso">Las notificaciones están bloqueadas para esta página. Habilitalas desde los ajustes del navegador (candado al lado de la dirección → Notificaciones).</div>';
    return;
  }
  if (sub && Notification.permission === 'granted') {
    el.innerHTML = '<div class="ok">✅ Notificaciones activadas en este celular.</div><button class="boton claro chico" id="push-off">Desactivar en este celular</button>';
    $('#push-off').onclick = async () => { await datos.borrarSuscripcion(sub.endpoint).catch(() => {}); await sub.unsubscribe(); toast('Notificaciones desactivadas'); pintarPush(); };
    return;
  }
  el.innerHTML = '<button class="boton" id="push-on">🔔 Activar notificaciones en este celular</button>';
  $('#push-on').onclick = async () => {
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') { toast('No diste permiso para notificaciones'); return pintarPush(); }
      const publica = await datos.clavePush();
      const nueva = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aUint8(publica) });
      const j = nueva.toJSON();
      await datos.guardarSuscripcion({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
      toast('¡Listo! Te vamos a avisar acá');
      pintarPush();
    } catch (e) { toast(e.message || 'No se pudo activar'); }
  };
}

// Registrar el service worker apenas se abre el panel (para que las notificaciones abran la app)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
