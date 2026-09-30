import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Panorama general de un periodo con la data de operaciones (igual que el panel principal). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan las fechas desde y hasta." }, { status: 400 });
  }
  const lista = (k: string) => {
    const v = searchParams.getAll(k).filter(Boolean);
    return v.length ? v : null;
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() =>
    supabase.rpc("get_dev_panorama_ops", {
      p_desde: desde,
      p_hasta: hasta,
      p_zonas: lista("zona"),
      p_ciudades: lista("ciudad"),
      p_tiendas: lista("tienda"),
      p_repartidores: lista("repartidor"),
      p_incluir_returning: searchParams.get("returning") !== "0",
      p_incluir_rechazadas: searchParams.get("rechazadas") !== "0",
    })
  );
  if (error) {
    console.error("Error en /api/devoluciones/panorama:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
