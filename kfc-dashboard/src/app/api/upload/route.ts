import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OPS_COLUMNS, VENTAS_COLUMNS } from "@/lib/parse/columns";
import { findMissingRequiredColumns, mapRows, readSpreadsheet } from "@/lib/parse/parseFile";

// xlsx necesita el runtime de Node (no Edge), y los archivos semanales
// pueden tardar unos segundos en insertarse.
export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 500;

const TIPO_CONFIG = {
  ops: { table: "ops_orders", columns: OPS_COLUMNS, required: ["order_id", "estatus_orden"] },
  ventas: { table: "ventas_orders", columns: VENTAS_COLUMNS, required: ["order_id", "estatus_orden"] },
} as const;

type Tipo = keyof typeof TIPO_CONFIG;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tipo = formData.get("tipo") as Tipo | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }
    if (!tipo || !TIPO_CONFIG[tipo]) {
      return NextResponse.json(
        { error: "Tipo de data inválido. Debe ser 'ops' o 'ventas'." },
        { status: 400 }
      );
    }

    const config = TIPO_CONFIG[tipo];
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { headers, rows } = readSpreadsheet(buffer, file.name);

    if (headers.length === 0) {
      return NextResponse.json(
        { error: "No se pudieron leer encabezados del archivo. ¿Está vacío o dañado?" },
        { status: 400 }
      );
    }

    const missing = findMissingRequiredColumns(headers, config.columns, config.required);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `El archivo no parece ser de tipo "${tipo}". Faltan columnas: ${missing.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const mapped = mapRows(headers, rows, config.columns);
    if (mapped.length === 0) {
      return NextResponse.json({ error: "El archivo no tiene filas de datos." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1) Registrar la carga en el histórico de uploads
    const dates = mapped
      .map((r) => r.values.creada_en as string | null)
      .filter((d): d is string => Boolean(d))
      .sort();
    const dateStart = dates[0] ? dates[0].slice(0, 10) : null;
    const dateEnd = dates.length ? dates[dates.length - 1].slice(0, 10) : null;

    const { data: uploadRow, error: uploadError } = await supabase
      .from("uploads")
      .insert({
        tipo,
        filename: file.name,
        row_count: mapped.length,
        date_range_start: dateStart,
        date_range_end: dateEnd,
      })
      .select()
      .single();

    if (uploadError) throw uploadError;

    // 2) Insertar/actualizar las filas por lotes.
    //    upsert por order_id: si una orden ya existía (semanas que se
    //    traslapan) se actualiza en vez de duplicarse.
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE).map((r) => ({
        ...r.values,
        raw: r.raw,
        upload_batch_id: uploadRow.id,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from(config.table).upsert(batch, { onConflict: "order_id" });
      if (error) throw error;
      inserted += batch.length;
    }

    return NextResponse.json({
      ok: true,
      tipo,
      filename: file.name,
      rows_processed: inserted,
      date_range: dateStart && dateEnd ? `${dateStart} → ${dateEnd}` : null,
      upload_id: uploadRow.id,
    });
  } catch (err: unknown) {
    console.error("Error en /api/upload:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
