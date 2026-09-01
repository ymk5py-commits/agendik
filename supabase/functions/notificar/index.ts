// Agendik · notificaciones por correo
//
// La llama el frontend después de crear, reprogramar, confirmar o cancelar
// una cita. El gateway ya validó el JWT (verify_jwt); acá se revalida que
// quien llama tenga derecho sobre ESA cita —su dueño o el equipo del
// negocio— y recién entonces se manda el mail con la API de Brevo.
//
// La clave de Brevo vive en los secretos del proyecto (BREVO_API_KEY),
// nunca en el navegador.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BREVO_KEY = Deno.env.get("BREVO_API_KEY")!;
const BREVO_SENDER = Deno.env.get("BREVO_SENDER") ?? "ymk5py@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Consulta PostgREST con la clave de servicio (solo dentro de esta función). */
async function db(path: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`db ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

/** El `sub` del JWT que ya validó el gateway. */
function userIdDe(req: Request): string | null {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLarga(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

const TEXTOS: Record<string, { asunto: (n: string) => string; titulo: string; intro: string }> = {
  creada: {
    asunto: (n) => `Tu cita en ${n} quedó agendada`,
    titulo: "Tu cita quedó agendada",
    intro: "Te esperamos. Estos son los datos de tu turno:",
  },
  confirmada: {
    asunto: (n) => `Tu cita en ${n} está confirmada`,
    titulo: "Tu cita está confirmada",
    intro: "El negocio confirmó tu turno. Estos son los datos:",
  },
  reprogramada: {
    asunto: (n) => `Cambió el horario de tu cita en ${n}`,
    titulo: "Tu cita cambió de horario",
    intro: "Tu turno se movió. Este es el nuevo horario:",
  },
  cancelada: {
    asunto: (n) => `Se canceló tu cita en ${n}`,
    titulo: "Tu cita fue cancelada",
    intro: "Este turno quedó cancelado. Si querés, reservá uno nuevo desde el portal:",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method" });

  let cuerpo: { appointment_id?: string; evento?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return json(400, { error: "body" });
  }

  const { appointment_id, evento } = cuerpo;
  if (!appointment_id || !evento || !TEXTOS[evento]) {
    return json(400, { error: "appointment_id y evento (creada|confirmada|reprogramada|cancelada)" });
  }

  const quien = userIdDe(req);
  if (!quien) return json(401, { error: "sin usuario" });

  // La cita, con todo lo que va en el mail.
  const citas = await db(
    `appointments?id=eq.${appointment_id}&select=id,tenant_id,date,start_time,end_time,status,` +
      `clients(name,email,user_id),professionals(name),` +
      `appointment_services(services(name)),tenants(business_name,slug)`,
  );
  const cita = citas[0];
  if (!cita) return json(404, { error: "cita no encontrada" });

  // Autorización real, no cosmética: el dueño de la cita o el equipo del negocio.
  const esDuenio = cita.clients?.user_id === quien;
  let esStaff = false;
  if (!esDuenio) {
    const staff = await db(`staff?user_id=eq.${quien}&tenant_id=eq.${cita.tenant_id}&select=id`);
    esStaff = staff.length > 0;
  }
  if (!esDuenio && !esStaff) return json(403, { error: "sin permiso sobre esta cita" });

  const destinatario = cita.clients?.email;
  if (!destinatario) return json(200, { ok: false, motivo: "la ficha no tiene email" });

  const negocio = cita.tenants?.business_name ?? "Agendik";
  const t = TEXTOS[evento];
  const hora = `${String(cita.start_time).slice(0, 5)} a ${String(cita.end_time).slice(0, 5)}`;
  const servicios =
    (cita.appointment_services ?? [])
      .map((s: { services?: { name?: string } }) => s.services?.name)
      .filter(Boolean)
      .join(" + ") || "Tu servicio";
  const portal = `https://agendik.vercel.app/n/${cita.tenants?.slug ?? ""}`;

  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 16px 6px 0;font-size:13px;color:#8A867A;white-space:nowrap;">${k}</td>` +
    `<td style="padding:6px 0;font-size:14px;font-weight:600;color:#26241F;">${v}</td></tr>`;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF9F5;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #E7E5DC;border-radius:16px;padding:32px;">
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#143830;">${negocio}</p>
    <p style="margin:0 0 24px;font-size:13px;color:#8A867A;">vía Agendik</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#26241F;">${t.titulo}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#57544A;">Hola ${cita.clients?.name ?? ""}. ${t.intro}</p>
    <table style="border-collapse:collapse;margin:0 0 24px;">
      ${fila("Servicio", servicios)}
      ${fila("Día", fechaLarga(cita.date))}
      ${fila("Hora", hora)}
      ${fila("Con", cita.professionals?.name ?? "-")}
    </table>
    <p style="margin:0 0 8px;">
      <a href="${portal}" style="display:inline-block;background:#1D5A4B;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:12px;">Ver mi agenda</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#B0AC9C;">Recibiste este correo porque tenés una cita en ${negocio}.</p>
  </div>
</div>`;

  const envio = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: negocio, email: BREVO_SENDER },
      to: [{ email: destinatario, name: cita.clients?.name ?? undefined }],
      subject: t.asunto(negocio),
      htmlContent: html,
    }),
  });

  if (!envio.ok) {
    return json(502, { ok: false, brevo: envio.status, detalle: (await envio.text()).slice(0, 160) });
  }
  return json(200, { ok: true });
});
