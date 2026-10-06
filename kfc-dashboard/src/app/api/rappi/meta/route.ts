import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leerMes = (v: string | null) => (v && /^\d{4}-\d{2}/.test(v) ? `${v.slice(0, 7)}-01` : null);

/** Avance de la meta del mes (?mes=2026-10): órdenes que Rappi entregó. */
export async function GET(req: Request) {
  const hoy = new Date();
  const mes =
    leerMes(new URL(req.url).searchParams.get("mes")) ??
    `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const { data, error } = await withRetryResult(() => getSupabaseAdmin().rpc("get_rappi_meta", { p_mes: mes }));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Guarda la meta de un mes: { mes: "2026-10", meta: 10000 } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mes = leerMes(String(body.mes ?? ""));
    const meta = Math.round(Number(body.meta));
    if (!mes || !Number.isFinite(meta) || meta <= 0) {
      return NextResponse.json({ error: "Escribe un mes y una meta mayor a cero." }, { status: 400 });
    }
    const { error } = await withRetryResult(() =>
      getSupabaseAdmin()
        .from("rappi_metas")
        .upsert({ mes, meta, updated_at: new Date().toISOString() }, { onConflict: "mes" })
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
