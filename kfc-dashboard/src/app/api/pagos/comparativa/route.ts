import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start");
  const weekEnd = searchParams.get("week_end");

  if (!weekStart || !weekEnd) {
    return NextResponse.json(
      { error: "Faltan week_start y week_end." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_orders_comparison", {
    p_week_start: weekStart,
    p_week_end: weekEnd,
  });

  if (error) {
    console.error("Error en /api/pagos/comparativa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { dias: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
