import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zonas, ciudades, tiendas, repartidores y el rango de fechas de la data de operaciones. */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() => supabase.rpc("get_dev_filtros_ops"));
  if (error) {
    console.error("Error en /api/devoluciones/filtros:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
