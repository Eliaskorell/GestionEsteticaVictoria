import { crearDatos, linkWA } from './datos.js';
import { selectorHorario, esc } from './selector.js';
import { fechaDe, fechaLarga, horaDe, DIAS, aMin } from './tiempo.js';

const $ = (s) => document.querySelector(s);
let datos, pub;

const duracion = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `${min} min`);
const precio = (p) => (p == null ? '' : ` · $${Number(p).toLocaleString('es-AR')}`);
const servicioPorId = (id) => pub.servicios.find((s) => s.id === +id);
const profPorId = (id) => pub.profesionales.find((p) => p.id === +id);

async function iniciar() {
  try { datos = await crearDatos(); pub = await datos.publico(); } catch (e) { $('#lista-servicios').innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  pintarServicios();
  pintarEquipo();
  pintarDonde();
  window.addEventListener('hashchange', ruta);
  ruta();
}

// ---------------------------------------------------------------- página
function pintarServicios(cat = 'Todos') {
  const cats = ['Todos', ...new Set(pub.servicios.map((s) => s.categoria))];
  $('#categorias').innerHTML = cats.map((c) => `<button class="chip" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  $('#categorias').onclick = (e) => { const b = e.target.closest('.chip'); if (b) pintarServicios(b.dataset.cat); };
  const lista = pub.servicios.filter((s) => cat === 'Todos' || s.categoria === cat);
  $('#lista-servicios').innerHTML = lista.map((s) => `
    <article class="servicio">
      <span class="meta">${esc(s.categoria)} · ${duracion(s.duracion_min)}${precio(s.precio)}</span>
      <h3>${esc(s.nombre)}</h3>
      <p>${esc(s.descripcion || '')}</p>
      <span class="meta">Con ${esc(profPorId(s.profesional_id)?.nombre || '')}</span>
      <a class="boton claro chico" href="#/reservar/${s.id}">Reservar</a>
    </article>`).join('');
}

function pintarEquipo() {
  const iniciales = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('');
  $('#lista-equipo').innerHTML = pub.profesionales.map((p) => `
    <div class="persona">
      <div class="avatar" style="background:${esc(p.color)}">${esc(iniciales(p.nombre))}</div>
      <h3>${esc(p.nombre)}</h3>
      <p class="suave chico">${esc(p.rol || '')}</p>
    </div>`).join('');
}

function pintarDonde() {
  const c = pub.config;
  $('#direccion').textContent = c.direccion || '';
  $('#link-mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((c.direccion || '') + ', Santa Fe, Argentina');
  $('#link-ig').href = `https://www.instagram.com/${c.instagram}/`;
  if (c.whatsapp) {
    const wa = linkWA(c.whatsapp, '¡Hola! Te escribo desde la página de VC Estética Integral.');
    $('#link-wa').href = wa;
    $('#wa-flotante').href = wa;
    $('#wa-flotante').classList.remove('oculto');
  } else $('#link-wa').remove();

  // Horario general del centro: unión de franjas de todas, por día
  const filas = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const fr = pub.horarios.filter((h) => h.dia === d).map((h) => [aMin(h.desde), aMin(h.hasta)]).sort((a, b) => a[0] - b[0]);
    const unidas = [];
    for (const f of fr) { const u = unidas.at(-1); if (u && f[0] <= u[1]) u[1] = Math.max(u[1], f[1]); else unidas.push([...f]); }
    const txt = unidas.length ? unidas.map(([a, b]) => `${String(a / 60 | 0).padStart(2, '0')}:${String(a % 60).padStart(2, '0')} a ${String(b / 60 | 0).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`).join(' y ') : 'Cerrado';
    return `<tr><td>${DIAS[d]}</td><td>${txt}</td></tr>`;
  });
  $('#tabla-horario').innerHTML = filas.join('');
}

// ---------------------------------------------------------------- hoja
function abrirHoja(titulo, html) {
  $('#hoja').innerHTML = `
    <div class="hoja-fondo" id="hoja-fondo">
      <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">
        <div class="hoja-cabeza"><h2 id="hoja-titulo">${esc(titulo)}</h2><button class="cerrar" id="cerrar" aria-label="Cerrar">×</button></div>
        <div id="hoja-cuerpo">${html}</div>
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
  $('#cerrar').onclick = cerrarHoja;
  $('#hoja-fondo').onclick = (e) => { if (e.target.id === 'hoja-fondo') cerrarHoja(); };
  return $('#hoja-cuerpo');
}
function cerrarHoja() {
  $('#hoja').innerHTML = '';
  document.body.style.overflow = '';
  if (location.hash.startsWith('#/')) history.pushState(null, '', location.pathname + location.search);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#hoja').innerHTML) cerrarHoja(); });

function ruta() {
  const h = location.hash;
  if (h.startsWith('#/reservar')) reservar(h.split('/')[2]);
  else if (h.startsWith('#/turno')) miTurno(h.split('/')[2]);
  else if ($('#hoja').innerHTML) { $('#hoja').innerHTML = ''; document.body.style.overflow = ''; }
}

const barra = (n) => `<div class="pasos">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'hecho' : ''}"></span>`).join('')}</div>`;

// ---------------------------------------------------------------- reservar
function reservar(servicioId) {
  const r = { servicio: servicioPorId(servicioId) || null, inicio: null };
  const cuerpo = abrirHoja('Reservar turno', '');

  const paso1 = () => {
    const cats = [...new Set(pub.servicios.map((s) => s.categoria))];
    cuerpo.innerHTML = barra(1) + '<p class="suave">¿Qué te querés hacer?</p>' + cats.map((c) => `
      <p class="grupo-titulo">${esc(c)}</p>
      <div class="lista-servicios">${pub.servicios.filter((s) => s.categoria === c).map((s) => `
        <button class="opcion" data-id="${s.id}"><span>${esc(s.nombre)}</span><small>${duracion(s.duracion_min)}${precio(s.precio)}</small></button>`).join('')}
      </div>`).join('');
    cuerpo.onclick = (e) => { const b = e.target.closest('.opcion'); if (b) { r.servicio = servicioPorId(b.dataset.id); paso2(); } };
  };

  const resumen = () => `<div class="resumen"><b>${esc(r.servicio.nombre)}</b> · ${duracion(r.servicio.duracion_min)}<br><span class="suave">Con ${esc(profPorId(r.servicio.profesional_id)?.nombre)}</span>${r.inicio ? `<br>${fechaLarga(fechaDe(r.inicio))}, ${horaDe(r.inicio)} hs` : ''}</div>`;

  const paso2 = () => {
    r.inicio = null;
    cuerpo.onclick = null;
    cuerpo.innerHTML = barra(2) + `<button class="link volver" id="volver">‹ Cambiar servicio</button>` + resumen() + '<div id="selector"></div><div id="espera-zona"></div>';
    $('#volver').onclick = paso1;
    selectorHorario($('#selector'), {
      datos, pub, servicio: r.servicio,
      alElegir: (iso) => { r.inicio = iso; paso3(); },
      sinLugar: () => {},
    });
    $('#espera-zona').innerHTML = `<p class="chico suave">¿No encontrás un horario que te sirva? <button class="link" id="ir-espera">Anotate en la lista de espera</button> y te avisamos si se libera un lugar.</p>`;
    $('#ir-espera').onclick = listaEspera;
  };

  const paso3 = () => {
    cuerpo.onclick = null;
    cuerpo.innerHTML = barra(3) + `<button class="link volver" id="volver">‹ Cambiar horario</button>` + resumen() + `
      <form id="form" novalidate>
        <div class="campo"><label for="nombre">Nombre y apellido</label><input id="nombre" autocomplete="name" required></div>
        <div class="campo"><label for="cel">Celular (WhatsApp)</label><input id="cel" type="tel" inputmode="tel" autocomplete="tel" placeholder="3493 15 123456" required></div>
        <div class="campo"><label for="nota">¿Algo que debamos saber? <span class="suave">(opcional)</span></label><textarea id="nota" placeholder="Zona a tratar, alergias, si es tu primera vez…"></textarea></div>
        <div id="err"></div>
        <button class="boton ancho" id="confirmar">Confirmar turno</button>
        <p class="chico suave" style="margin-top:.8rem">Podés cambiar o cancelar tu turno desde la web hasta ${pub.config.horas_min_cambio} horas antes.</p>
      </form>`;
    $('#volver').onclick = paso2;
    $('#form').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#confirmar'); btn.disabled = true; btn.textContent = 'Reservando…'; $('#err').innerHTML = '';
      try {
        const codigo = await datos.reservar({ servicio_id: r.servicio.id, inicio: r.inicio, nombre: $('#nombre').value, celular: $('#cel').value, nota: $('#nota').value });
        listo(codigo, $('#nombre').value.trim());
      } catch (er) {
        $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`;
        btn.disabled = false; btn.textContent = 'Confirmar turno';
      }
    };
  };

  const listo = (codigo, nombre) => {
    const link = `${location.origin}${location.pathname}#/turno/${codigo}`;
    const fin = new Date(new Date(r.inicio).getTime() + r.servicio.duracion_min * 60e3);
    const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(`${r.servicio.nombre} · VC Estética Integral`) +
      '&dates=' + [new Date(r.inicio), fin].map((d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')).join('/') +
      '&location=' + encodeURIComponent(pub.config.direccion || '') + '&details=' + encodeURIComponent('Cambiar o cancelar: ' + link);
    const msj = `¡Hola! Soy ${nombre}. Reservé ${r.servicio.nombre} para el ${fechaLarga(fechaDe(r.inicio))} a las ${horaDe(r.inicio)} hs. Código: ${codigo}`;
    cuerpo.innerHTML = `
      <div class="ok"><b>¡Listo, tu turno quedó reservado!</b></div>
      ${resumen()}
      <p class="chico">Guardá este código para cambiar o cancelar tu turno:</p>
      <div class="codigo">${esc(codigo)}</div>
      <div class="acciones-col">
        <a class="boton claro" href="${gcal}" target="_blank" rel="noopener">Agregar a mi calendario</a>
        ${pub.config.whatsapp ? `<a class="boton wa" href="${linkWA(pub.config.whatsapp, msj + '\n' + link)}" target="_blank" rel="noopener">Enviar comprobante por WhatsApp</a>` : ''}
        <a class="boton claro" href="#/turno/${esc(codigo)}">Ver mi turno</a>
      </div>`;
  };

  const listaEspera = () => {
    cuerpo.onclick = null;
    cuerpo.innerHTML = `<button class="link volver" id="volver">‹ Volver a los horarios</button>` + resumen() + `
      <p>Dejanos tus datos y si se libera un lugar para <b>${esc(r.servicio.nombre)}</b> te escribimos por WhatsApp.</p>
      <form id="form" novalidate>
        <div class="campo"><label for="nombre">Nombre y apellido</label><input id="nombre" autocomplete="name"></div>
        <div class="campo"><label for="cel">Celular (WhatsApp)</label><input id="cel" type="tel" inputmode="tel" autocomplete="tel"></div>
        <div class="campo"><label for="pref">¿Qué días u horarios te quedan bien?</label><input id="pref" placeholder="Ej: martes o jueves a la tarde"></div>
        <div id="err"></div>
        <button class="boton ancho">Anotarme</button>
      </form>`;
    $('#volver').onclick = paso2;
    $('#form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await datos.anotarseEspera({ servicio_id: r.servicio.id, nombre: $('#nombre').value, celular: $('#cel').value, preferencia: $('#pref').value });
        cuerpo.innerHTML = `<div class="ok"><b>¡Te anotamos!</b> Si se libera un turno te escribimos.</div><button class="boton claro ancho" id="fin">Cerrar</button>`;
        $('#fin').onclick = cerrarHoja;
      } catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
    };
  };

  r.servicio ? paso2() : paso1();
}

// ---------------------------------------------------------------- mi turno
async function miTurno(codigo) {
  const cuerpo = abrirHoja('Mi turno', '');
  if (!codigo) {
    cuerpo.innerHTML = `
      <p>Ingresá el código que te dimos al reservar.</p>
      <form id="form"><div class="campo"><label for="cod">Código</label><input id="cod" autocapitalize="off" autocomplete="off" placeholder="Ej: 7edd1b5c"></div>
      <button class="boton ancho">Buscar</button></form>
      ${pub.config.whatsapp ? `<p class="chico suave" style="margin-top:1rem">¿No lo tenés? <a href="${linkWA(pub.config.whatsapp, '¡Hola! Necesito consultar por mi turno.')}" target="_blank" rel="noopener">Escribinos por WhatsApp</a>.</p>` : ''}`;
    $('#form').onsubmit = (e) => { e.preventDefault(); const c = $('#cod').value.trim(); if (c) location.hash = '#/turno/' + encodeURIComponent(c); };
    return;
  }
  cuerpo.innerHTML = '<p class="cargando">Buscando tu turno…</p>';
  const t = await datos.turnoPorCodigo(decodeURIComponent(codigo));
  if (!t) {
    cuerpo.innerHTML = `<div class="error">No encontramos un turno con ese código.</div><a class="boton claro ancho" href="#/turno">Probar con otro código</a>`;
    return;
  }
  const estados = { confirmado: 'Confirmado', cancelado: 'Cancelado', completado: 'Realizado', ausente: 'No asistió' };
  const wa = (txt) => (pub.config.whatsapp ? linkWA(pub.config.whatsapp, txt) : null);
  const ficha = `<div class="resumen"><b>${esc(t.servicio)}</b><br>${fechaLarga(fechaDe(t.inicio))}, ${horaDe(t.inicio)} hs<br><span class="suave">Con ${esc(t.profesional)} · ${estados[t.estado]}</span></div>`;

  const pintar = (msj = '') => {
    let acciones = '';
    if (t.estado === 'confirmado' && t.puede_modificar) {
      acciones = `<div class="acciones-col"><button class="boton" id="cambiar">Cambiar día u horario</button><button class="boton peligro" id="cancelar">Cancelar turno</button></div>`;
    } else if (t.estado === 'confirmado') {
      const w = wa(`¡Hola! Soy ${t.cliente_nombre}, tengo turno de ${t.servicio} el ${fechaLarga(fechaDe(t.inicio))} a las ${horaDe(t.inicio)} hs (código ${t.codigo}). Necesito hacer un cambio.`);
      acciones = `<div class="aviso">Faltan menos de ${t.horas_min_cambio} horas: para cambiarlo o cancelarlo escribinos.</div>${w ? `<a class="boton wa ancho" href="${w}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ''}`;
    } else {
      acciones = `<a class="boton ancho" href="#/reservar/${t.servicio_id}">Reservar otro turno</a>`;
    }
    cuerpo.innerHTML = msj + `<p>Hola, ${esc(t.cliente_nombre.split(' ')[0])}.</p>` + ficha + acciones;
    $('#cambiar')?.addEventListener('click', cambiar);
    $('#cancelar')?.addEventListener('click', confirmarCancelar);
  };

  const confirmarCancelar = () => {
    cuerpo.innerHTML = ficha + `<p><b>¿Seguro que querés cancelar?</b> El horario queda libre para otra persona.</p><div id="err"></div>
      <div class="acciones-col"><button class="boton peligro" id="si">Sí, cancelar</button><button class="boton claro" id="no">No, mantener</button></div>`;
    $('#no').onclick = () => pintar();
    $('#si').onclick = async () => {
      try { await datos.cancelar(t.codigo); t.estado = 'cancelado'; pintar('<div class="ok">Tu turno fue cancelado. ¡Gracias por avisar!</div>'); }
      catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
    };
  };

  const cambiar = () => {
    const servicio = servicioPorId(t.servicio_id) || { duracion_min: (new Date(t.fin) - new Date(t.inicio)) / 60e3, profesional_id: null };
    cuerpo.innerHTML = `<button class="link volver" id="volver">‹ Volver</button>` + ficha + '<p>Elegí el nuevo día y horario:</p><div id="err"></div><div id="selector"></div>';
    $('#volver').onclick = () => pintar();
    selectorHorario($('#selector'), {
      datos, pub, servicio, ignorar: { inicio: t.inicio, profesional_id: servicio.profesional_id },
      alElegir: async (iso) => {
        $('#err').innerHTML = '<p class="cargando">Guardando…</p>';
        try {
          await datos.reprogramar(t.codigo, iso);
          Object.assign(t, await datos.turnoPorCodigo(t.codigo));
          pintar('<div class="ok">¡Listo! Tu turno quedó cambiado.</div>');
        } catch (er) { $('#err').innerHTML = `<div class="error">${esc(er.message)}</div>`; }
      },
    });
  };
  pintar();
}

iniciar();
