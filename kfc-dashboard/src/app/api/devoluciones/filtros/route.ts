import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Zonas, ciudades, tiendas, repartidores y el rango de fechas de la data de operaciones. */
export async function GET() {
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("dev-filtros", null, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_dev_filtros_ops"));
      if (error) throw new Error(error.message);
      return data;
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/devoluciones/filtros:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
