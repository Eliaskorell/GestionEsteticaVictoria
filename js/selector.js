// Selector de día y hora (lo usan la reserva, "mi turno" y el panel)
import { horasLibres } from './disponibilidad.js';
import { aISO, hoy, sumarDias, DIAS_CORTO, fechaLarga, hhmm, diaSemana } from './tiempo.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Dibuja días + horas libres dentro de `el`.
 * @param {HTMLElement} el
 * @param {object} o  { datos, pub:{config,horarios}, servicio, ignorar?:{inicio,profesional_id}, alElegir(iso), ignorarLimites?, dias? }
 */
export async function selectorHorario(el, o) {
  const { datos, pub, servicio } = o;
  const total = o.dias ?? pub.config.dias_anticipacion;
  el.innerHTML = '<p class="cargando">Buscando horarios libres…</p>';
  const desde = hoy();
  const hasta = sumarDias(desde, total + 1);
  let ocupados = await datos.ocupados(aISO(desde, 0), aISO(hasta, 0));
  if (o.ignorar) ocupados = ocupados.filter((x) => !(x.profesional_id === o.ignorar.profesional_id && new Date(x.inicio).getTime() === new Date(o.ignorar.inicio).getTime()));

  const dias = [];
  for (let i = 0; i <= total; i++) {
    const fecha = sumarDias(desde, i);
    const libres = horasLibres({ fecha, servicio, horarios: pub.horarios, ocupados, config: pub.config, ignorarLimites: o.ignorarLimites });
    dias.push({ fecha, libres });
  }
  const conLugar = dias.filter((d) => d.libres.length);
  if (!conLugar.length) {
    el.innerHTML = '<div class="aviso">No quedan horarios libres para este servicio en los próximos días.</div>';
    o.sinLugar?.();
    return;
  }
  let elegido = conLugar[0].fecha;

  const pintar = () => {
    const d = dias.find((x) => x.fecha === elegido);
    el.innerHTML = `
      <div class="dias" role="group" aria-label="Día">
        ${dias.map((x) => {
          const [, , dd] = x.fecha.split('-');
          return `<button type="button" class="dia" data-fecha="${x.fecha}" aria-pressed="${x.fecha === elegido}" ${x.libres.length ? '' : 'disabled'}>
            <small>${DIAS_CORTO[diaSemana(x.fecha)]}</small><b>${+dd}</b><small>${x.libres.length ? x.libres.length + ' lib.' : '—'}</small></button>`;
        }).join('')}
      </div>
      <p><b>${fechaLarga(elegido)}</b></p>
      <div class="horas" role="group" aria-label="Hora">
        ${d.libres.map((m) => `<button type="button" class="hora" data-min="${m}">${hhmm(m)}</button>`).join('')}
      </div>`;
    el.querySelector(`[data-fecha="${elegido}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  pintar();
  el.onclick = (ev) => {
    const dia = ev.target.closest('.dia');
    if (dia && !dia.disabled) { elegido = dia.dataset.fecha; pintar(); return; }
    const hora = ev.target.closest('.hora');
    if (hora) {
      el.querySelectorAll('.hora').forEach((b) => b.setAttribute('aria-pressed', b === hora));
      o.alElegir(aISO(elegido, +hora.dataset.min));
    }
  };
}
