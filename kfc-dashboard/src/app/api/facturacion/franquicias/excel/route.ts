import { NextResponse } from "next/server";
import { leerMes } from "@/lib/facturacion-server";
import { adjunto, comprimir, facturaFranquicia, todasLasFacturas } from "@/lib/facturas-franquicias";
import { nombreMes } from "@/lib/facturacion";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Facturas de franquicias:
 *  ?mes=2026-11&codigo=1185        una tienda
 *  ?mes=2026-11&razon=NOMBRE       una razón social (todas sus tiendas)
 *  ?mes=2026-11&zip=razon|tienda   todas, en un ZIP (un Excel por razón social o por tienda)
 */
export async function GET(req: Request) {
  try {
    const sesion = await sesionActual();
    if (sesion?.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const p = new URL(req.url).searchParams;
    const mes = leerMes(p.get("mes"));
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    const cabeceras = { "Cache-Control": "no-store" };

    const zip = p.get("zip");
    if (zip === "razon" || zip === "tienda") {
      const facturas = await todasLasFacturas(mes, zip);
      if (!facturas.length) return NextResponse.json({ error: "No hay franquicias con órdenes en el mes." }, { status: 404 });
      const buf = await comprimir(facturas);
      const nombre = `Facturas Franquicias ${zip === "razon" ? "por razón social" : "por tienda"} ${nombreMes(mes)}.zip`;
      return new NextResponse(new Uint8Array(buf), {
        headers: { ...cabeceras, "Content-Type": "application/zip", "Content-Disposition": adjunto(nombre) },
      });
    }

    const codigo = p.get("codigo");
    const razon = p.get("razon");
    if (!codigo && !razon) return NextResponse.json({ error: "Falta la tienda o la razón social." }, { status: 400 });
    const factura = await facturaFranquicia(mes, { codigo, razon });
    if (!factura) return NextResponse.json({ error: "No hay órdenes de esa franquicia en el mes." }, { status: 404 });
    return new NextResponse(new Uint8Array(factura.buffer), {
      headers: { ...cabeceras, "Content-Type": XLSX, "Content-Disposition": adjunto(factura.nombre) },
    });
  } catch (err) {
    console.error("Error en /api/facturacion/franquicias/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
