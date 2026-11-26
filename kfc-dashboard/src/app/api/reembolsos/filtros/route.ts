import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";
import { sesionActual } from "@/lib/auth-server";
import { alcanceDe } from "@/lib/alcance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const params = {};
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("reembolsos-filtros", params, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_reembolsos_filtros", params));
      if (error) throw new Error(error.message);
      return data ?? {};
    });
    const alcance = await alcanceDe(await sesionActual());
    let salida: unknown = data;
    if (alcance && data && typeof data === "object") {
      const d = data as Record<string, unknown>;
      const ok = new Set(alcance.codigos);
      salida = { ...d, tiendas: Array.isArray(d.tiendas) ? d.tiendas.filter((t) => ok.has(String((t as { clave?: unknown }).clave))) : d.tiendas };
    }
    return NextResponse.json(salida, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/reembolsos/filtros:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
