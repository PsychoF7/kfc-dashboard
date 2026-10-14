import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { filtrosDe, buscarDe } from "@/lib/reembolsos-filtros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Tabla de reembolsos (?pagina=0&buscar=...) con los mismos filtros del panorama. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limite = 50;
  const pagina = Math.max(0, Number(sp.get("pagina")) || 0);
  const params = { ...filtrosDe(req), p_buscar: buscarDe(req), p_limit: limite, p_offset: pagina * limite };
  try {
    const { data, error } = await withRetryResult(() => getSupabaseAdmin().rpc("get_reembolsos_detalle", params));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ...(data as object), limite }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/reembolsos/detalle:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
