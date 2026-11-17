// Capa de datos: todo pasa por Supabase.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const CONFIGURADO = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const SUPERPOSICION = 'Se pisa con otro turno de esa profesional. Si querés meterla igual, marcá "sobreturno".';

export async function crearDatos() {
  if (!CONFIGURADO) throw new Error('Falta conectar la base de datos: completá SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js.');
  return datosSupabase();
}

// ---------------------------------------------------------------- Supabase
async function datosSupabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.110.1');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const ok = ({ data, error }) => {
    if (error) {
      if (error.code === '23P01') throw new Error(SUPERPOSICION);
      if (error.code === '23503') throw new Error('No se puede borrar porque tiene turnos o servicios asociados. Desactivalo en vez de borrarlo.');
      throw new Error(error.message || 'Algo salió mal. Probá de nuevo.');
    }
    return data;
  };
  const rpc = async (fn, args) => ok(await sb.rpc(fn, args));

  return {
    async publico() {
      const [c, p, s, h] = await Promise.all([
        sb.from('config').select('*').eq('id', 1).single(),
        sb.from('profesionales').select('*').eq('activo', true).order('orden'),
        sb.from('servicios').select('*').eq('activo', true).order('orden'),
        sb.from('horarios').select('*'),
      ]);
      return { config: ok(c), profesionales: ok(p), servicios: ok(s), horarios: ok(h) };
    },
    ocupados: (desde, hasta) => rpc('ocupados', { p_desde: desde, p_hasta: hasta }),
    reservar: (r) => rpc('reservar', { p_servicio: r.servicio_id, p_inicio: r.inicio, p_nombre: r.nombre, p_celular: r.celular, p_nota: r.nota || null }),
    turnoPorCodigo: async (codigo) => (await rpc('turno_por_codigo', { p_codigo: codigo }))[0] || null,
    turnosPorCelular: (celular, nombre) => rpc('turnos_por_celular', { p_celular: celular, p_nombre: nombre }),
    cancelar: (codigo) => rpc('cancelar_turno', { p_codigo: codigo }),
    reprogramar: (codigo, inicio) => rpc('reprogramar_turno', { p_codigo: codigo, p_inicio: inicio }),
    pedirCambio: (codigo, inicio) => rpc('pedir_cambio', { p_codigo: codigo, p_inicio: inicio }),
    anotarseEspera: (e) => rpc('anotarse_espera', { p_servicio: e.servicio_id, p_nombre: e.nombre, p_celular: e.celular, p_preferencia: e.preferencia || null }),

    // ---- panel
    async sesion() { return !!(await sb.auth.getSession()).data.session; },
    async ingresar(email, clave) {
      const { error } = await sb.auth.signInWithPassword({ email, password: clave });
      if (error) throw new Error('Mail o contraseña incorrectos.');
    },
    async salir() { await sb.auth.signOut(); },
    async todo() {
      const [c, p, s, h] = await Promise.all([
        sb.from('config').select('*').eq('id', 1).single(),
        sb.from('profesionales').select('*').order('orden'),
        sb.from('servicios').select('*').order('orden'),
        sb.from('horarios').select('*').order('dia').order('desde'),
      ]);
      return { config: ok(c), profesionales: ok(p), servicios: ok(s), horarios: ok(h) };
    },
    turnos: async (desde, hasta) => ok(await sb.from('turnos').select('*').gte('inicio', desde).lt('inicio', hasta).order('inicio')),
    crearTurno: async (t) => ok(await sb.from('turnos').insert({ ...t, origen: 'panel' }).select().single()),
    actualizarTurno: async (id, cambios) => ok(await sb.from('turnos').update(cambios).eq('id', id).select().single()),
    intercambiar: (a, b) => rpc('intercambiar_turnos', { p_a: a, p_b: b }),
    bloqueos: async (desde, hasta) => ok(await sb.from('bloqueos').select('*').lt('inicio', hasta).gt('fin', desde).order('inicio')),
    crearBloqueo: async (b) => ok(await sb.from('bloqueos').insert(b)),
    borrarBloqueo: async (id) => ok(await sb.from('bloqueos').delete().eq('id', id)),
    espera: async () => ok(await sb.from('espera').select('*').order('creado')),
    marcarEspera: async (id, atendida) => ok(await sb.from('espera').update({ atendida }).eq('id', id)),
    async guardar(tabla, fila) {
      const { id, ...resto } = fila;
      return id
        ? ok(await sb.from(tabla).update(resto).eq('id', id).select().single())
        : ok(await sb.from(tabla).insert(resto).select().single());
    },
    borrar: async (tabla, id) => ok(await sb.from(tabla).delete().eq('id', id)),

    // ---- novedades y notificaciones
    novedades: async () => ok(await sb.from('novedades').select('*').order('creado', { ascending: false }).limit(60)),
    novedadesSinVer: async () => {
      const { count, error } = await sb.from('novedades').select('id', { count: 'exact', head: true }).eq('vista', false);
      if (error) throw new Error(error.message);
      return count || 0;
    },
    marcarNovedadesVistas: async () => ok(await sb.from('novedades').update({ vista: true }).eq('vista', false)),
    async clavePush() {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/avisos`, { headers: { apikey: SUPABASE_ANON_KEY } });
      if (!r.ok) throw new Error('El servicio de notificaciones todavía no está activo.');
      return (await r.json()).publica;
    },
    guardarSuscripcion: async (s) => ok(await sb.from('push_suscripciones').upsert(s, { onConflict: 'endpoint' })),
    borrarSuscripcion: async (endpoint) => ok(await sb.from('push_suscripciones').delete().eq('endpoint', endpoint)),
  };
}

/** Link de WhatsApp con mensaje armado */
export const linkWA = (numero, texto) => `https://wa.me/${String(numero || '').replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
/** Celular argentino a formato wa.me (agrega 549 si falta) */
export const celWA = (c) => { let n = String(c || '').replace(/\D/g, ''); if (n.startsWith('0')) n = n.slice(1); if (n.length > 10) n = n.replace(/^(\d{3,4})15/, '$1'); return n.startsWith('54') ? n : '549' + n; };
