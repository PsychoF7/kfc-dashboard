import { NextResponse } from "next/server";
import { leerMes, obtenerFranquicias } from "@/lib/facturacion-server";
import { construirExcelFranquicias } from "@/lib/facturacion-franquicias-excel";
import { nombreMes } from "@/lib/facturacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limpio = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/** Factura de franquicias: ?mes=2026-11&codigo=1185 (una tienda) o &razon=NOMBRE (una razón social). */
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const mes = leerMes(p.get("mes"));
    if (!mes) return NextResponse.json({ error: "Falta el mes." }, { status: 400 });
    const codigo = p.get("codigo");
    const razon = p.get("razon");
    if (!codigo && !razon) return NextResponse.json({ error: "Falta la tienda o la razón social." }, { status: 400 });

    const { filas } = await obtenerFranquicias(mes);
    const elegidas = codigo ? filas.filter((x) => x.codigo === codigo) : filas.filter((x) => x.razonSocial === razon);
    if (!elegidas.length) return NextResponse.json({ error: "No hay órdenes de esa franquicia en el mes." }, { status: 404 });

    const razones = new Set(elegidas.map((x) => x.razonSocial));
    const una = elegidas[0];
    const buffer = await construirExcelFranquicias(elegidas, {
      mesPago: mes,
      razonSocial: razones.size === 1 ? una.razonSocial : null,
      rfc: razones.size === 1 ? una.rfc : null,
      iva: 0.16,
    });
    const nombre = codigo ? `${una.codigo}_${limpio(una.tienda.replace(/^\d+\s*/, ""))}` : limpio(razon!);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Factura_Franquicia_${nombre}_${nombreMes(mes)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/facturacion/franquicias/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
