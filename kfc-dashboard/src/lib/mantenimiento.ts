// Estado del modo mantenimiento. Solo usa fetch, para funcionar también en el
// middleware (edge). Se guarda en memoria unos segundos para no consultar la
// base en cada petición.

export interface EstadoMantenimiento {
  activo: boolean;
  mensaje: string;
}

const VIGENCIA_MS = 10_000;
let memo: { en: number; valor: EstadoMantenimiento } | null = null;

export const MENSAJE_POR_DEFECTO = "El panel está en mantenimiento. Vuelve a intentar en unos minutos.";

/** Olvida lo guardado (se llama justo después de cambiar el estado). */
export function olvidarMantenimiento() {
  memo = null;
}

export async function estadoMantenimiento(): Promise<EstadoMantenimiento> {
  if (memo && Date.now() - memo.en < VIGENCIA_MS) return memo.valor;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let valor: EstadoMantenimiento = { activo: false, mensaje: "" };
  if (url && llave) {
    try {
      const r = await fetch(`${url}/rest/v1/app_config?clave=eq.mantenimiento&select=valor`, {
        headers: { apikey: llave, Authorization: `Bearer ${llave}` },
        cache: "no-store",
      });
      if (r.ok) {
        const filas = (await r.json()) as { valor?: { activo?: boolean; mensaje?: string } }[];
        const v = filas?.[0]?.valor;
        if (v?.activo === true) valor = { activo: true, mensaje: String(v.mensaje ?? "").trim() || MENSAJE_POR_DEFECTO };
      }
    } catch {
      // Si no se puede consultar, el panel sigue disponible.
    }
  }
  memo = { en: Date.now(), valor };
  return valor;
}
