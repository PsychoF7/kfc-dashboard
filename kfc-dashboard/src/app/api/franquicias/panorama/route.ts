import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Franquicias (?desde=&hasta=&tienda=...). Sin fechas = toda la data de tiendas FQ. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const tiendas = sp.getAll("tienda").filter(Boolean);
  const params = {
    p_desde: sp.get("desde") || null,
    p_hasta: sp.get("hasta") || null,
    p_tiendas: tiendas.length ? tiendas : null,
  };
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("franquicias", params, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_franquicias_panorama", params));
      if (error) throw new Error(error.message);
      return data ?? {};
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/franquicias/panorama:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
