import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rappi KFC (?desde=&hasta=&tienda=...). Sin fechas = todo el reporte cargado. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tiendas = sp.getAll("tienda").filter(Boolean);
  const { data, error } = await withRetryResult(() =>
    getSupabaseAdmin().rpc("get_rappi_panorama", {
      p_desde: sp.get("desde") || null,
      p_hasta: sp.get("hasta") || null,
      p_tiendas: tiendas.length ? tiendas : null,
    })
  );
  if (error) {
    console.error("Error en /api/rappi/panorama:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
