import { NextResponse } from "next/server";
import { obtenerTurbo } from "@/lib/rappi-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rappi Turbo: antes vs después de la activación (sin la hoja de datos, para la pantalla). */
export async function GET(req: Request) {
  try {
    const t = await obtenerTurbo(req);
    const { datos, ...resto } = t ?? ({} as typeof t);
    return NextResponse.json({ ...resto, total_datos: datos?.length ?? 0 }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("Error en /api/rappi/turbo:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
