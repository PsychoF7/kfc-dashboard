import { NextResponse } from "next/server";
import { leerParametros, obtenerReporte } from "@/lib/devoluciones-server";
import { construirExcelDevoluciones } from "@/lib/devoluciones-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// "2026-09-21" -> "21Sep" (mismo nombre de archivo que usas hoy)
function etiqueta(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}${MES[m - 1]}`;
}

export async function GET(req: Request) {
  const { weekStart, weekEnd, opciones } = leerParametros(req);
  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: "Faltan week_start y week_end." }, { status: 400 });
  }
  try {
    const { reporte, tendencia } = await obtenerReporte(weekStart, weekEnd, opciones);
    if (!reporte?.resumen?.total) {
      return NextResponse.json(
        { error: "No hay data de tiempos cargada para esa semana." },
        { status: 404 }
      );
    }
    const buffer = await construirExcelDevoluciones(reporte, tendencia, opciones);
    const nombre = `Reporte_KFC_-_${etiqueta(weekStart)}_-_${etiqueta(weekEnd)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/devoluciones/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
