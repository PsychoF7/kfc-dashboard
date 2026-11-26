import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";
import { sesionActual } from "@/lib/auth-server";
import { alcanceDe, opcionesEnAlcance } from "@/lib/alcance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("filters", null, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_ops_filter_options"));
      if (error) throw new Error(error.message);
      return data;
    });
    const alcance = await alcanceDe(await sesionActual());
    const salida = Array.isArray(data) ? data.map((o) => opcionesEnAlcance(o as Record<string, unknown>, alcance)) : opcionesEnAlcance((data ?? {}) as Record<string, unknown>, alcance);
    return NextResponse.json(salida, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/filters:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
