// Fechas en hora de Argentina (UTC-3, sin horario de verano).
const OFFSET_MS = 3 * 3600e3;
export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = (n) => String(n).padStart(2, '0');
const local = (iso) => new Date(new Date(iso).getTime() - OFFSET_MS);

/** 'YYYY-MM-DD' de un instante */
export const fechaDe = (iso) => local(iso).toISOString().slice(0, 10);
/** minutos desde la medianoche de un instante */
export const minDe = (iso) => { const d = local(iso); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
/** instante ISO a partir de fecha local + minutos */
export const aISO = (fecha, min) => `${fecha}T${pad(Math.floor(min / 60))}:${pad(min % 60)}:00-03:00`;
export const hoy = () => fechaDe(new Date().toISOString());
export const sumarDias = (fecha, n) => { const d = new Date(fecha + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const diaSemana = (fecha) => new Date(fecha + 'T12:00:00Z').getUTCDay();
export const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const aMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const horaDe = (iso) => hhmm(minDe(iso));
export const fechaLarga = (fecha) => { const d = new Date(fecha + 'T12:00:00Z'); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
export const fechaCorta = (fecha) => { const d = new Date(fecha + 'T12:00:00Z'); return `${DIAS_CORTO[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
export const sumarMin = (iso, min) => new Date(new Date(iso).getTime() + min * 60e3).toISOString();
