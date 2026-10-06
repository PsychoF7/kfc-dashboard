import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { OPS_COLUMNS, RAPPI_COLUMNS, TIEMPOS_COLUMNS, VENTAS_COLUMNS } from "@/lib/parse/columns";
import { findMissingRequiredColumns, mapRows } from "@/lib/parse/parseFile";

// Carga por partes: el navegador lee el CSV y lo manda en lotes chicos.
// Así no importa qué tan grande sea el archivo (mensual, 50 MB o más):
// cada lote se guarda en pocos segundos y nunca se pasa del tiempo límite.
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 500;

// clave = la columna que identifica cada renglón (si ya existe, se actualiza)
const TIPO_CONFIG = {
  ops: { table: "ops_orders", columns: OPS_COLUMNS, required: ["order_id", "estatus_orden"], clave: "order_id" },
  ventas: { table: "ventas_orders", columns: VENTAS_COLUMNS, required: ["order_id", "estatus_orden"], clave: "order_id" },
  tiempos: {
    table: "tiempos_orders",
    columns: TIEMPOS_COLUMNS,
    required: ["order_id", "estatus_orden", "direccion"],
    clave: "order_id",
  },
  // Reporte de Rappi KFC: un renglón por envío (una orden puede tener varios)
  rappi: { table: "rappi_envios", columns: RAPPI_COLUMNS, required: ["cargo_order_id", "order_id", "estado"], clave: "cargo_order_id" },
} as const;

type Tipo = keyof typeof TIPO_CONFIG;

interface Cuerpo {
  tipo: Tipo;
  filename: string;
  headers: string[];
  rows?: unknown[][];
  upload_id?: string;
  /** Último aviso: ya se mandaron todos los lotes; se cierra el registro de la carga. */
  final?: { row_count: number; date_start: string | null; date_end: string | null };
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const body = (await req.json()) as Cuerpo;
    const config = TIPO_CONFIG[body.tipo];
    if (!config) {
      return NextResponse.json({ error: "Tipo de data inválido." }, { status: 400 });
    }

    // Cierre de la carga: actualizar el histórico y las estadísticas de la tabla
    if (body.final && body.upload_id) {
      await withRetry(() =>
        supabase
          .from("uploads")
          .update({
            row_count: body.final!.row_count,
            date_range_start: body.final!.date_start,
            date_range_end: body.final!.date_end,
          })
          .eq("id", body.upload_id!)
      );
      try {
        await supabase.rpc("analyze_table", { p_table: config.table });
      } catch {
        // no es grave si no se pueden actualizar las estadísticas
      }
      return NextResponse.json({ ok: true });
    }

    const headers = body.headers ?? [];
    const rows = body.rows ?? [];

    // Primer lote: revisar columnas y abrir el registro de la carga
    let uploadId = body.upload_id;
    if (!uploadId) {
      const missing = findMissingRequiredColumns(headers, config.columns, config.required);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `El archivo no parece ser de tipo "${body.tipo}". Faltan columnas: ${missing.join(", ")}.` },
          { status: 400 }
        );
      }
      const { data, error } = await withRetry(() =>
        supabase.from("uploads").insert({ tipo: body.tipo, filename: body.filename, row_count: 0 }).select("id").single()
      );
      if (error) throw error;
      uploadId = data.id as string;
    }

    // Igual que la carga normal: solo KFC, sin repetidos dentro del lote
    const mapped = mapRows(headers, rows, config.columns);
    const soloKfc = mapped.filter((r) => {
      const restaurant = r.values.restaurant as string | null;
      return restaurant && /kfc/i.test(restaurant);
    });
    const unicos = new Map<string, (typeof soloKfc)[number]>();
    for (const r of soloKfc) {
      const id = r.values[config.clave];
      if (id !== null && id !== undefined && id !== "") unicos.set(String(id), r);
    }
    const filas = Array.from(unicos.values());

    for (let i = 0; i < filas.length; i += BATCH_SIZE) {
      const lote = filas.slice(i, i + BATCH_SIZE).map((r) => ({
        ...r.values,
        upload_batch_id: uploadId,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await withRetry(() => supabase.from(config.table).upsert(lote, { onConflict: config.clave }));
      if (error) throw error;
    }

    const fechas = filas
      .map((r) => r.values.creada_en as string | null)
      .filter((d): d is string => Boolean(d))
      .sort();

    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      guardadas: filas.length,
      descartadas_no_kfc: mapped.length - soloKfc.length,
      fecha_min: fechas[0]?.slice(0, 10) ?? null,
      fecha_max: fechas.length ? fechas[fechas.length - 1].slice(0, 10) : null,
    });
  } catch (err: unknown) {
    console.error("Error en /api/upload/lote:", err);
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as any).message) : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
