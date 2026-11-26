import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";
import { sesionActual } from "@/lib/auth-server";
import { acotar, alcanceDe } from "@/lib/alcance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mi Flotilla (?desde=&hasta=&tienda=...). Sin fechas = toda la data de MF. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tiendas = sp.getAll("tienda").filter(Boolean);
  const alcance = await alcanceDe(await sesionActual());
  const permitidas = acotar(tiendas.length ? tiendas : null, alcance?.nombres ?? null);
  const params = {
    p_desde: sp.get("desde") || null,
    p_hasta: sp.get("hasta") || null,
    p_tiendas: permitidas,
  };
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("flotilla", params, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_flotilla_panorama", params));
      if (error) throw new Error(error.message);
      return data ?? {};
    });
    let salida: unknown = data;
    if (alcance && data && typeof data === "object") {
      const ok = new Set(alcance.nombres);
      const d = data as Record<string, unknown>;
      salida = {
        ...d,
        tiendas_mf: Array.isArray(d.tiendas_mf) ? d.tiendas_mf.filter((t) => ok.has(String(t))) : d.tiendas_mf,
        tiendas: Array.isArray(d.tiendas) ? d.tiendas.filter((t) => ok.has(String((t as { tienda?: unknown }).tienda))) : d.tiendas,
      };
    }
    return NextResponse.json(salida, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/flotilla/panorama:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
