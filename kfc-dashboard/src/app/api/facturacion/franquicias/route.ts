import { NextResponse } from "next/server";
import { leerMes, obtenerFranquicias } from "@/lib/facturacion-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Franquicias del mes de pago (?mes=2026-11) con su cobro y razón social. */
export async function GET(req: Request) {
  try {
    const mes = leerMes(new URL(req.url).searchParams.get("mes"));
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    const { filas, razones } = await obtenerFranquicias(mes);
    return NextResponse.json(
      {
        razones,
        filas: filas.map(({ dias: _dias, ...resto }) => resto),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Error en /api/facturacion/franquicias:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
