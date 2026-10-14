import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { filtrosDe, buscarDe } from "@/lib/reembolsos-filtros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Fila {
  fecha_venta: string | null;
  restaurante: string;
  proveedor: string | null;
  monto: number | null;
  folio: string | null;
  estatus: string;
  fecha_pago: string | null;
  id_orden: string | null;
  cant_ordenes: number | null;
  motivo: string | null;
  dictamen: string | null;
}

/** Descarga en Excel lo que se ve en la tabla (con los mismos filtros). */
export async function GET(req: Request) {
  const params = { ...filtrosDe(req), p_buscar: buscarDe(req), p_limit: 50000, p_offset: 0 };
  try {
    const { data, error } = await withRetryResult(() => getSupabaseAdmin().rpc("get_reembolsos_detalle", params));
    if (error) throw new Error(error.message);
    const filas = ((data as { filas?: Fila[] })?.filas ?? []).map((f) => ({
      "Fecha de venta": f.fecha_venta,
      Sucursal: f.restaurante,
      Proveedor: f.proveedor,
      Monto: f.monto,
      Folio: f.folio,
      Estatus: f.estatus,
      "Fecha de pago": f.fecha_pago,
      "ID de orden": f.id_orden,
      Órdenes: f.cant_ordenes,
      Motivo: f.motivo,
      Dictamen: f.dictamen,
    }));
    if (filas.length === 0) return NextResponse.json({ error: "No hay reembolsos con esos filtros." }, { status: 404 });
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [12, 34, 12, 11, 16, 11, 13, 38, 8, 32, 24].map((wch) => ({ wch }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Reembolsos");
    const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="Reembolsos_KFC.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error en /api/reembolsos/excel:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
