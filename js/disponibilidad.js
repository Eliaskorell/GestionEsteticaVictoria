import { aISO, aMin, diaSemana, fechaDe, minDe } from './tiempo.js';

/**
 * Horarios libres (en minutos desde medianoche) para un servicio en una fecha.
 * Misma regla que la base de datos: dentro del horario de la profesional, sin pisar turnos ni bloqueos,
 * con la anticipación mínima y máxima de la configuración.
 * @param {object} p
 * @param {string} p.fecha 'YYYY-MM-DD'
 * @param {{duracion_min:number, profesional_id:number}} p.servicio
 * @param {Array} p.horarios  filas {profesional_id, dia, desde, hasta}
 * @param {Array} p.ocupados  filas {profesional_id|null, inicio, fin}
 * @param {object} p.config   {intervalo_min, horas_min_reserva, dias_anticipacion}
 * @param {Date}  [p.ahora]
 * @param {boolean} [p.ignorarLimites] el panel puede cargar fuera de la ventana de la web
 */
export function horasLibres({ fecha, servicio, horarios, ocupados, config, ahora = new Date(), ignorarLimites = false }) {
  const dur = servicio.duracion_min;
  const paso = config.intervalo_min || 15;
  const minimo = ahora.getTime() + (ignorarLimites ? 0 : (config.horas_min_reserva || 0) * 3600e3);
  const maximo = ahora.getTime() + config.dias_anticipacion * 86400e3;
  const dia = diaSemana(fecha);

  const franjas = horarios.filter((h) => h.profesional_id === servicio.profesional_id && h.dia === dia);
  const ocup = ocupados
    .filter((o) => o.profesional_id == null || o.profesional_id === servicio.profesional_id)
    .filter((o) => fechaDe(o.inicio) <= fecha && fechaDe(o.fin) >= fecha)
    .map((o) => [fechaDe(o.inicio) < fecha ? 0 : minDe(o.inicio), fechaDe(o.fin) > fecha ? 1440 : minDe(o.fin)]);

  const libres = [];
  for (const f of franjas) {
    const desde = aMin(f.desde), hasta = aMin(f.hasta);
    for (let m = desde; m + dur <= hasta; m += paso) {
      const t = new Date(aISO(fecha, m)).getTime();
      if (t < minimo || (!ignorarLimites && t > maximo)) continue;
      if (ocup.some(([a, b]) => m < b && m + dur > a)) continue;
      libres.push(m);
    }
  }
  return [...new Set(libres)].sort((a, b) => a - b);
}
