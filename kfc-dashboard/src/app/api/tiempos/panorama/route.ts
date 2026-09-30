import { NextResponse } from "next/server";
import { obtenerTiempos } from "@/lib/tiempos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Análisis de tiempos con la data de operaciones y los filtros del panel principal. */
export async function GET(req: Request) {
  try {
    const data = await obtenerTiempos(req);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/tiempos/panorama:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
