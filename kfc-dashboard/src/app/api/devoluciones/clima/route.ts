import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sincronizarClima } from "@/lib/clima";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Días de mal clima por ciudad en el periodo (?desde=&hasta=). Si faltan
 * días por consultar, los pide al servicio de clima y los guarda. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan las fechas desde y hasta." }, { status: 400 });
  }
  const clima = await sincronizarClima(getSupabaseAdmin(), desde, hasta);
  return NextResponse.json({ clima }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Guarda una nota o marca "no afectó" en un día de clima de una ciudad. */
export async function POST(req: Request) {
  try {
    const { ciudad, fecha, nota, descartado } = await req.json();
    if (!ciudad || !fecha) {
      return NextResponse.json({ error: "Faltan la ciudad o la fecha." }, { status: 400 });
    }
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof nota === "string") cambios.nota = nota.trim() || null;
    if (typeof descartado === "boolean") cambios.descartado = descartado;

    const supabase = getSupabaseAdmin();
    const { error } = await withRetryResult(() =>
      supabase.from("dev_clima").update(cambios).eq("ciudad", ciudad).eq("fecha", fecha)
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en POST /api/devoluciones/clima:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
