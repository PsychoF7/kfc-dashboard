import { NextResponse } from "next/server";
import { leerMes, obtenerFactura } from "@/lib/facturacion-server";
import { construirExcelFactura } from "@/lib/facturacion-excel";
import { nombreMes } from "@/lib/facturacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Excel de la factura (?mes=2026-10) con tus 3 hojas. */
export async function GET(req: Request) {
  try {
    const mes = leerMes(new URL(req.url).searchParams.get("mes"));
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    const { calculo } = await obtenerFactura(mes);
    const buffer = await construirExcelFactura(calculo);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Factura_KFC_${nombreMes(mes)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/facturacion/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
