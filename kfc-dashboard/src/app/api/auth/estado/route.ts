import { NextResponse } from "next/server";
import { estadoMantenimiento } from "@/lib/mantenimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Público: la pantalla de entrada y la de mantenimiento lo consultan. Solo dice si hay mantenimiento y su mensaje. */
export async function GET() {
  const m = await estadoMantenimiento();
  return NextResponse.json({ mantenimiento: m }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
