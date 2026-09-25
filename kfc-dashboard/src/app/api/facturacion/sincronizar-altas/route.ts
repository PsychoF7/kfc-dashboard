import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALTAS_SPREADSHEET_ID = "1hwRvxv8lJ9XLIuiSRq2VQ-3Fm5Eojl-_uZW8b8g8WfU";

interface Movimiento {
  sucursal: string;
  tipo_movimiento: string;
  fecha_solicitud: string | null;
  fecha_inicio_operacion: string | null;
  estado: string | null;
  activa: string | null;
  motivo: string | null;
  comentarios: string | null;
  notas: string | null;
}

function colIndex(headers: unknown[], name: string): number {
  return headers.findIndex((h) => String(h ?? "").trim() === name);
}

/** Google Sheets regresa las fechas como número de serie (igual que
 * Excel) cuando pedimos valores "sin formato". Esto las convierte, y
 * descarta las fechas placeholder tipo "Diciembre 1899" (columnas vacías
 * con formato de fecha). */
function serialToISODate(serial: unknown): string | null {
  const n = Number(serial);
  if (!n || isNaN(n)) return null;
  const utcDays = Math.floor(n - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  if (d.getFullYear() < 2000) return null;
  return d.toISOString().slice(0, 10);
}

function cellText(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v).trim();
}

export async function POST() {
  try {
    const sheets = getSheetsClient();

    async function readTab(tabName: string) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: ALTAS_SPREADSHEET_ID,
        range: `'${tabName}'!A1:Q1000`,
        valueRenderOption: "UNFORMATTED_VALUE",
      });
      const rows = res.data.values ?? [];
      const [headers, ...data] = rows;
      return { headers: (headers ?? []) as unknown[], data };
    }

    const movimientos: Movimiento[] = [];

    // --- Altas (General 2026: Delivery + Flotilla juntas) ---
    {
      const { headers, data } = await readTab("General 2026");
      const iSolicitud = colIndex(headers, "Solicitud alta");
      const iSucursal = colIndex(headers, "Sucursal");
      const iProducto = colIndex(headers, "Producto contratado");
      const iEstado = colIndex(headers, "Estado");
      const iActiva = colIndex(headers, "Activa");
      const iFechaInicio = colIndex(headers, "Fecha inicio operación");
      const iComentarios = colIndex(headers, "Comentarios");
      const iNotas = colIndex(headers, "Notas");

      for (const row of data) {
        const sucursal = cellText(row[iSucursal]);
        if (!sucursal) continue;
        const producto = cellText(row[iProducto])?.toLowerCase();
        const tipo =
          producto === "delivery" ? "alta_delivery" : producto === "flotilla" ? "alta_flotilla" : null;
        if (!tipo) continue;
        movimientos.push({
          sucursal,
          tipo_movimiento: tipo,
          fecha_solicitud: serialToISODate(row[iSolicitud]),
          fecha_inicio_operacion: serialToISODate(row[iFechaInicio]),
          estado: cellText(row[iEstado]),
          activa: cellText(row[iActiva]),
          motivo: null,
          comentarios: cellText(row[iComentarios]),
          notas: cellText(row[iNotas]),
        });
      }
    }

    // --- Cambios de producto ---
    for (const [tabName, tipo] of [
      ["Delivery a Flotilla", "cambio_a_flotilla"],
      ["Flotilla a Delivery", "cambio_a_delivery"],
    ] as const) {
      const { headers, data } = await readTab(tabName);
      const iSolicitud = colIndex(headers, "Solicitud alta");
      const iSucursal = colIndex(headers, "Sucursal");
      const iEstado = colIndex(headers, "Estado");
      const iActiva = colIndex(headers, "Activa");
      const iFechaInicio = colIndex(headers, "Fecha inicio operación");
      const iComentarios = colIndex(headers, "Comentarios");
      const iNotas = colIndex(headers, "Notas");

      for (const row of data) {
        const sucursal = cellText(row[iSucursal]);
        if (!sucursal) continue;
        movimientos.push({
          sucursal,
          tipo_movimiento: tipo,
          fecha_solicitud: serialToISODate(row[iSolicitud]),
          fecha_inicio_operacion: serialToISODate(row[iFechaInicio]),
          estado: cellText(row[iEstado]),
          activa: cellText(row[iActiva]),
          motivo: null,
          comentarios: cellText(row[iComentarios]),
          notas: cellText(row[iNotas]),
        });
      }
    }

    // --- Bajas ---
    {
      const { headers, data } = await readTab("Bajas 2026");
      const iSolicitud = colIndex(headers, "Solicitud baja");
      const iSucursal = colIndex(headers, "Sucursal");
      const iEstado = colIndex(headers, "Estado");
      const iMotivo = colIndex(headers, "Motivo");
      const iComentarios = colIndex(headers, "Comentarios");

      for (const row of data) {
        const sucursal = cellText(row[iSucursal]);
        if (!sucursal) continue;
        movimientos.push({
          sucursal,
          tipo_movimiento: "baja",
          fecha_solicitud: serialToISODate(row[iSolicitud]),
          fecha_inicio_operacion: null,
          estado: cellText(row[iEstado]),
          activa: null,
          motivo: cellText(row[iMotivo]),
          comentarios: cellText(row[iComentarios]),
          notas: null,
        });
      }
    }

    if (movimientos.length === 0) {
      return NextResponse.json(
        { error: "No se encontró ningún movimiento en la hoja. Revisa que esté compartida con la cuenta de servicio." },
        { status: 400 }
      );
    }

    // Reemplazo completo: la hoja de Google es la fuente de verdad, así
    // que en cada sincronización se borra todo y se vuelve a cargar tal
    // cual está ahí en ese momento.
    const supabase = getSupabaseAdmin();

    const { error: deleteError } = await withRetryResult(() =>
      supabase.from("movimientos_tiendas").delete().gte("created_at", "1900-01-01")
    );
    if (deleteError) throw deleteError;

    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < movimientos.length; i += BATCH_SIZE) {
      const batch = movimientos.slice(i, i + BATCH_SIZE);
      const { error } = await withRetryResult(() => supabase.from("movimientos_tiendas").insert(batch));
      if (error) throw error;
      inserted += batch.length;
    }

    return NextResponse.json({ ok: true, total: inserted });
  } catch (err: unknown) {
    console.error("Error en /api/facturacion/sincronizar-altas:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
