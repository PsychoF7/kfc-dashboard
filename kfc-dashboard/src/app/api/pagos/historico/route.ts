import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista semanas ya guardadas. Si se manda week_start, filtra a esa semana.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start");
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("pagos_historico")
    .select("*")
    .order("semana_inicio", { ascending: false })
    .order("categoria", { ascending: true });

  if (weekStart) query = query.eq("semana_inicio", weekStart);

  const { data, error } = await withRetryResult(() => query);

  if (error) {
    console.error("Error en GET /api/pagos/historico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { filas: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

// Guarda (o actualiza) el desglose de una semana en el histórico.
// Recibe las filas ya calculadas (para no tener que recalcular server-side).
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json();
    const { week_start, week_end, filas } = body as {
      week_start: string;
      week_end: string;
      filas: Array<{
        categoria: string;
        monto_efectivo: number;
        n_efectivo: number;
        n_tarjeta: number;
        envios_efectivo: number;
        envios_tarjeta: number;
        total_envio: number;
        efectivo_depositar: number;
        deposito_envios_tarjeta: number;
      }>;
    };

    if (!week_start || !week_end || !filas?.length) {
      return NextResponse.json(
        { error: "Faltan week_start, week_end o las filas del desglose." },
        { status: 400 }
      );
    }

    const rows = filas.map((f) => ({
      semana_inicio: week_start,
      semana_fin: week_end,
      categoria: f.categoria,
      monto_efectivo: f.monto_efectivo,
      n_efectivo: f.n_efectivo,
      n_tarjeta: f.n_tarjeta,
      envios_efectivo: f.envios_efectivo,
      envios_tarjeta: f.envios_tarjeta,
      total_envio: f.total_envio,
      efectivo_depositar: f.efectivo_depositar,
      deposito_envios_tarjeta: f.deposito_envios_tarjeta,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await withRetryResult(() =>
      supabase.from("pagos_historico").upsert(rows, { onConflict: "semana_inicio,categoria" })
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error en POST /api/pagos/historico:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
