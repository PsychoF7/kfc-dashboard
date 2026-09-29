import { NextResponse } from "next/server";
import { leerParametros, obtenerReporte } from "@/lib/devoluciones-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { weekStart, weekEnd, opciones } = leerParametros(req);
  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: "Faltan week_start y week_end." }, { status: 400 });
  }
  try {
    const data = await obtenerReporte(weekStart, weekEnd, opciones);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/devoluciones/reporte:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
