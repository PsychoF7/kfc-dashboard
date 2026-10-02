import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { codigoDe } from "@/lib/facturacion";
import { leerMes } from "@/lib/facturacion-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marca baja / alta sin órdenes o guarda una nota de una tienda en una factura abierta.
 * Si no queda ni acción ni nota, se borra el ajuste. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mes = leerMes(body.mes);
    const tienda = String(body.tienda ?? "").trim();
    const accion = body.accion === "baja" || body.accion === "alta" ? body.accion : null;
    const nota = typeof body.nota === "string" ? body.nota.trim() || null : null;
    if (!mes || !tienda) return NextResponse.json({ error: "Faltan el mes o la tienda." }, { status: 400 });
    const codigo = String(body.codigo ?? codigoDe(tienda));

    const supabase = getSupabaseAdmin();
    const { data: cerrada } = await supabase.from("fact_facturas").select("mes_pago").eq("mes_pago", mes).maybeSingle();
    if (cerrada) return NextResponse.json({ error: "Esta factura ya está cerrada. Reábrela para hacer cambios." }, { status: 400 });

    const { error } =
      !accion && !nota
        ? await withRetryResult(() => supabase.from("fact_ajustes").delete().eq("mes_pago", mes).eq("codigo", codigo))
        : await withRetryResult(() =>
            supabase
              .from("fact_ajustes")
              .upsert(
                { mes_pago: mes, codigo, tienda, accion, nota, updated_at: new Date().toISOString() },
                { onConflict: "mes_pago,codigo" }
              )
          );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en /api/facturacion/ajustes:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
