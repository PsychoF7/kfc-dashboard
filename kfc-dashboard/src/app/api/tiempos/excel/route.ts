import { NextResponse } from "next/server";
import { obtenerTiempos } from "@/lib/tiempos-server";
import { construirExcelTiempos } from "@/lib/tiempos-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const etiqueta = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}${MES[m - 1]}`;
};

/** Descripción corta de los filtros aplicados, para el encabezado del Excel. */
function filtrosTexto(req: Request) {
  const sp = new URL(req.url).searchParams;
  const partes: string[] = [];
  const lista = (k: string, n: string) => {
    const v = sp.getAll(k).filter(Boolean);
    if (v.length) partes.push(`${n}: ${v.length > 3 ? `${v.length} seleccionadas` : v.join(", ")}`);
  };
  lista("ciudad", "Ciudad");
  lista("zona", "Zona");
  lista("restaurant", "Restaurante");
  lista("repartido_por", "Repartido por");
  lista("estatus", "Estatus");
  if (sp.get("orden_planeada")) partes.push(`Orden planeada: ${sp.get("orden_planeada") === "true" ? "Sí" : "No"}`);
  if (sp.get("price_min") || sp.get("price_max")) partes.push(`Precio: ${sp.get("price_min") ?? "0"} a ${sp.get("price_max") ?? "∞"}`);
  return `Data de operaciones, solo órdenes completadas de KFC. Filtros: ${partes.length ? partes.join(" · ") : "ninguno"}.`;
}

export async function GET(req: Request) {
  try {
    const { panorama, zonasRojas } = await obtenerTiempos(req);
    if (!panorama?.kpis?.completadas) {
      return NextResponse.json({ error: "No hay órdenes completadas con esos filtros." }, { status: 404 });
    }
    const buffer = await construirExcelTiempos(panorama, zonasRojas, filtrosTexto(req));
    const nombre = `Tiempos_KFC_-_${etiqueta(panorama.periodo.desde)}_-_${etiqueta(panorama.periodo.hasta)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/tiempos/excel:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
