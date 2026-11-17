// Función "avisos" (Supabase Edge Function).
// - GET  → devuelve la clave pública para activar notificaciones (la genera la primera vez).
// - POST → la llama la base de datos cuando una clienta reserva, cambia, cancela o se anota en espera,
//          y manda la notificación a los celulares donde Victoria la activó.
// No hay que cargarle ninguna clave a mano: las claves y el secreto viven en la tabla privada _interno.
// Al crearla: desactivar "Verify JWT" (la seguridad la da el secreto compartido con la base).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-aviso, apikey, authorization",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function leer(clave: string): Promise<string | null> {
  const { data } = await sb.from("_interno").select("valor").eq("clave", clave).maybeSingle();
  return data?.valor ?? null;
}

async function clavesVapid() {
  let publica = await leer("vapid_publica");
  let privada = await leer("vapid_privada");
  if (!publica || !privada) {
    const nuevas = webpush.generateVAPIDKeys();
    // ignoreDuplicates: si dos pedidos llegan juntos, se queda la primera y se relee
    await sb.from("_interno").upsert(
      [{ clave: "vapid_publica", valor: nuevas.publicKey }, { clave: "vapid_privada", valor: nuevas.privateKey }],
      { onConflict: "clave", ignoreDuplicates: true },
    );
    publica = await leer("vapid_publica");
    privada = await leer("vapid_privada");
  }
  return { publica: publica!, privada: privada! };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (req.method === "GET") {
      const { publica } = await clavesVapid();
      return json({ publica });
    }

    if (req.method === "POST") {
      const secreto = await leer("secreto");
      if (!secreto || req.headers.get("x-aviso") !== secreto) return json({ error: "no autorizado" }, 401);

      const { titulo, cuerpo, url } = await req.json();
      const { publica, privada } = await clavesVapid();
      webpush.setVapidDetails("mailto:avisos@turnos.app", publica, privada);

      const { data: subs } = await sb.from("push_suscripciones").select("*");
      const carga = JSON.stringify({ titulo: String(titulo ?? "Novedad"), cuerpo: String(cuerpo ?? ""), url: String(url ?? "admin.html") });
      let enviadas = 0;
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 86400 });
          enviadas++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from("push_suscripciones").delete().eq("id", s.id); // celular que ya no existe
        }
      }
      return json({ enviadas });
    }

    return json({ error: "método no permitido" }, 405);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
