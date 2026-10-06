import { NextResponse } from "next/server";
import { obtenerTurbo } from "@/lib/rappi-server";
import { construirExcelTurbo } from "@/lib/rappi-turbo-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Excel de Rappi Turbo (?desde=&hasta=) con tu formato de comparativa. */
export async function GET(req: Request) {
  try {
    const t = await obtenerTurbo(req);
    if (!t || t.sin_tiendas) return NextResponse.json({ error: "No hay tiendas Turbo activas." }, { status: 404 });
    if (!t.datos?.length) return NextResponse.json({ error: "No hay órdenes de Rappi en las tiendas Turbo para esas fechas." }, { status: 404 });
    const buffer = await construirExcelTurbo(t);
    const n = t.tiendas.filter((x) => x.activa).length;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="KFC_${n}_Rappi_Turbo_-_comparativa.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/rappi/turbo/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
