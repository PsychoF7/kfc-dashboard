import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { conCache } from "@/lib/cache";
import { filtrosDe } from "@/lib/reembolsos-filtros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const params = filtrosDe(req);
  const supabase = getSupabaseAdmin();
  try {
    const data = await conCache("reembolsos-panorama", params, async () => {
      const { data, error } = await withRetryResult(() => supabase.rpc("get_reembolsos_panorama", params));
      if (error) throw new Error(error.message);
      return data ?? {};
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/reembolsos/panorama:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
