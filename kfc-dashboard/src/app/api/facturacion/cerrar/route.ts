import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { leerMes, obtenerFactura } from "@/lib/facturacion-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cierra la factura: su lista de tiendas queda guardada como base del mes siguiente. */
export async function POST(req: Request) {
  try {
    const mes = leerMes((await req.json()).mes);
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    const { calculo } = await obtenerFactura(mes);
    const r = calculo.resumen;
    const supabase = getSupabaseAdmin();

    await withRetryResult(() => supabase.from("fact_facturas").delete().eq("mes_pago", mes));
    const cab = await withRetryResult(() =>
      supabase.from("fact_facturas").insert({
        mes_pago: mes,
        costo_mensual: r.costoMensual,
        iva: 0.16,
        total_tiendas: r.tiendasFacturar,
        subtotal: r.subtotal,
        total: r.total,
        cerrada_at: new Date().toISOString(),
      })
    );
    if (cab.error) throw new Error(cab.error.message);

    const filas = calculo.filas.map((f) => ({
      mes_pago: mes,
      tienda: f.tienda,
      codigo: f.codigo,
      tipo: f.tipo,
      estado: f.estado,
      ordenes: f.total,
      primer_dia: f.primerDia,
      dias_cobrar: f.diasCobrar,
      monto: f.monto,
      nota: f.nota,
    }));
    for (let i = 0; i < filas.length; i += 500) {
      const { error } = await withRetryResult(() => supabase.from("fact_tiendas").insert(filas.slice(i, i + 500)));
      if (error) {
        await supabase.from("fact_facturas").delete().eq("mes_pago", mes);
        throw new Error(error.message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en POST /api/facturacion/cerrar:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Reabre la factura (?mes=2026-10) para poder corregirla. */
export async function DELETE(req: Request) {
  const mes = leerMes(new URL(req.url).searchParams.get("mes"));
  if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { error } = await withRetryResult(() => supabase.from("fact_facturas").delete().eq("mes_pago", mes));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
