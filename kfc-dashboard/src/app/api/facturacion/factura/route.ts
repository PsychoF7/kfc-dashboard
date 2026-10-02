import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { leerMes, obtenerFactura } from "@/lib/facturacion-server";
import { mesSiguiente } from "@/lib/facturacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Factura de un mes de pago (?mes=2026-10). Sin mes, regresa el siguiente por facturar. */
export async function GET(req: Request) {
  try {
    let mes = leerMes(new URL(req.url).searchParams.get("mes"));
    if (!mes) {
      // El siguiente por facturar: el mes después de la última factura cerrada
      const { data } = await getSupabaseAdmin()
        .from("fact_facturas")
        .select("mes_pago")
        .order("mes_pago", { ascending: false })
        .limit(1)
        .maybeSingle();
      const hoy = new Date();
      mes = data?.mes_pago
        ? mesSiguiente(String(data.mes_pago).slice(0, 10))
        : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const data = await obtenerFactura(mes);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/facturacion/factura:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
