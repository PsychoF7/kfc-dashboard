// Lectura (solo lectura) de un hilo de Slack a partir del link del mensaje.
// Necesita la variable SLACK_BOT_TOKEN (token "xoxb-..." de una app de Slack
// con permisos de lectura) y que la app esté dentro del canal.

export interface HiloSlack {
  respuestas: number;
  ultimaRespuesta: string | null; // ISO
  ultimoAutor: string | null;
  ultimoTexto: string | null;
  resuelto: boolean; // el mensaje tiene una reacción de "listo"
}

export interface RefSlack {
  canal: string;
  ts: string;
}

const REACCIONES_LISTO = ["white_check_mark", "heavy_check_mark", "ballot_box_with_check", "check", "done", "resuelto"];

/** Saca canal y fecha-hora del mensaje a partir del link que se copia en Slack. */
export function leerLinkSlack(url: string): RefSlack | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)slack\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/archives\/([A-Z0-9]+)\/p(\d{16,19})/i);
  if (!m) return null;
  const digitos = m[2];
  let ts = `${digitos.slice(0, digitos.length - 6)}.${digitos.slice(-6)}`;
  // Si el link apunta a una respuesta dentro del hilo, el hilo es el mensaje original
  const hilo = u.searchParams.get("thread_ts");
  if (hilo && /^\d+\.\d+$/.test(hilo)) ts = hilo;
  const canal = (u.searchParams.get("cid") || m[1]).toUpperCase();
  return { canal, ts };
}

/** Quita los códigos de Slack (<@U123>, <https://...|texto>) para mostrar texto legible. */
export function limpiarTextoSlack(t: string): string {
  return t
    .replace(/<@([A-Z0-9]+)>/g, "@alguien")
    .replace(/<!(here|channel|everyone)[^>]*>/g, "@$1")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:[^>]+)>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const ERRORES: Record<string, string> = {
  not_in_channel: "La app de Slack no está dentro de ese canal. Invítala con /invite @nombre-de-la-app.",
  channel_not_found: "No se encontró el canal (o es privado y la app no está dentro).",
  thread_not_found: "No se encontró ese mensaje. Revisa que el link sea de un mensaje de Slack.",
  missing_scope: "A la app de Slack le faltan permisos de lectura (channels:history y groups:history).",
  invalid_auth: "El token de Slack no es válido.",
  token_revoked: "El token de Slack fue revocado. Hay que generar uno nuevo.",
  account_inactive: "La app de Slack está desactivada.",
  ratelimited: "Slack pidió esperar un momento. Intenta de nuevo en un minuto.",
};

export class ErrorSlack extends Error {
  codigo: string;
  constructor(codigo: string) {
    super(ERRORES[codigo] ?? `Slack respondió con un error (${codigo}).`);
    this.codigo = codigo;
  }
}

export function slackConfigurado() {
  return Boolean(process.env.SLACK_BOT_TOKEN);
}

async function llamar(metodo: string, params: Record<string, string>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new ErrorSlack("sin_token");
  const url = `https://slack.com/api/${metodo}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 429) throw new ErrorSlack("ratelimited");
  if (!res.ok) throw new ErrorSlack(`http_${res.status}`);
  const json = (await res.json()) as { ok: boolean; error?: string } & Record<string, any>;
  if (!json.ok) throw new ErrorSlack(json.error ?? "desconocido");
  return json;
}

const nombres = new Map<string, string>();
async function nombreDe(id: string | undefined, msg: any): Promise<string | null> {
  if (!id) return msg?.username ?? msg?.bot_profile?.name ?? null;
  const perfil = msg?.user_profile;
  const directo = perfil?.display_name || perfil?.real_name;
  if (directo) return directo;
  if (nombres.has(id)) return nombres.get(id)!;
  try {
    const r = await llamar("users.info", { user: id });
    const n = r.user?.profile?.display_name || r.user?.real_name || r.user?.name || null;
    if (n) nombres.set(id, n);
    return n;
  } catch {
    return null; // sin permiso users:read: se muestra sin nombre
  }
}

/** Lee el hilo y resume: cuántas respuestas hay, la última y si lo marcaron como listo. */
export async function leerHilo(ref: RefSlack): Promise<HiloSlack> {
  const r = await llamar("conversations.replies", { channel: ref.canal, ts: ref.ts, limit: "200" });
  const mensajes = (r.messages ?? []) as any[];
  if (mensajes.length === 0) throw new ErrorSlack("thread_not_found");
  const raiz = mensajes[0];
  const respuestas = mensajes.slice(1);
  const ultima = respuestas[respuestas.length - 1];
  const resuelto = ((raiz.reactions ?? []) as { name: string }[]).some((x) =>
    REACCIONES_LISTO.includes(String(x.name).split("::")[0])
  );
  return {
    respuestas: respuestas.length,
    ultimaRespuesta: ultima ? new Date(parseFloat(ultima.ts) * 1000).toISOString() : null,
    ultimoAutor: ultima ? await nombreDe(ultima.user, ultima) : null,
    ultimoTexto: ultima ? limpiarTextoSlack(String(ultima.text ?? "")).slice(0, 300) : null,
    resuelto,
  };
}
