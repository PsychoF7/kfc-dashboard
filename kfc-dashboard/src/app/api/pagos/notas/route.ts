import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start");
  if (!weekStart) {
    return NextResponse.json({ error: "Falta week_start." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() =>
    supabase
      .from("notas_tiendas_inactivas")
      .select("restaurant, nota")
      .eq("semana_inicio", weekStart)
  );

  if (error) {
    console.error("Error en GET /api/pagos/notas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { notas: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const { week_start, restaurant, nota } = await req.json();
    if (!week_start || !restaurant) {
      return NextResponse.json(
        { error: "Faltan week_start o restaurant." },
        { status: 400 }
      );
    }

    const { error } = await withRetryResult(() =>
      supabase.from("notas_tiendas_inactivas").upsert(
        {
          semana_inicio: week_start,
          restaurant,
          nota,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "semana_inicio,restaurant" }
      )
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error en POST /api/pagos/notas:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
