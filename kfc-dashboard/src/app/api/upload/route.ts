import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OPS_COLUMNS, VENTAS_COLUMNS } from "@/lib/parse/columns";
import { findMissingRequiredColumns, mapRows, readSpreadsheet } from "@/lib/parse/parseFile";

// xlsx necesita el runtime de Node (no Edge), y los archivos semanales
// pueden tardar unos segundos en insertarse.
export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 500;
const BUCKET = "raw-uploads";

const TIPO_CONFIG = {
  ops: { table: "ops_orders", columns: OPS_COLUMNS, required: ["order_id", "estatus_orden"] },
  ventas: { table: "ventas_orders", columns: VENTAS_COLUMNS, required: ["order_id", "estatus_orden"] },
} as const;

type Tipo = keyof typeof TIPO_CONFIG;

// Vercel <-> Supabase a veces falla con errores de red transitorios
// (ECONNRESET / "fetch failed"). No son errores de nuestro código: es la
// infraestructura teniendo un hipo momentáneo. Reintentamos automático.
async function withRetry<T>(fn: () => PromiseLike<T>, retries = 3, baseDelayMs = 600): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? `${err.message} ${String((err as any).cause ?? "")}` : "";
      const isTransient = /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR/i.test(msg);
      if (!isTransient || attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

// El cliente ya subió el archivo directo a Supabase Storage (así evitamos
// el límite de 4.5MB por petición que tiene Vercel). Aquí solo recibimos
// la ruta del archivo dentro del bucket y lo procesamos desde ahí.
export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await req.json();
    const { path, tipo, filename } = body as { path: string; tipo: Tipo; filename: string };

    if (!path || !tipo || !filename) {
      return NextResponse.json(
        { error: "Falta la ruta del archivo, el tipo o el nombre." },
        { status: 400 }
      );
    }
    if (!TIPO_CONFIG[tipo]) {
      return NextResponse.json(
        { error: "Tipo de data inválido. Debe ser 'ops' o 'ventas'." },
        { status: 400 }
      );
    }

    const config = TIPO_CONFIG[tipo];

    // Descargar el archivo desde Storage (esto SÍ puede manejar archivos
    // grandes, porque no pasa por el límite de payload de la función).
    const { data: fileBlob, error: downloadError } = await withRetry(() =>
      supabase.storage.from(BUCKET).download(path)
    );
    if (downloadError || !fileBlob) {
      throw new Error(`No se pudo leer el archivo subido: ${downloadError?.message}`);
    }
    const buffer = Buffer.from(await fileBlob.arrayBuffer());

    const { headers, rows } = readSpreadsheet(buffer, filename);

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

    // 1) Registrar la carga en el histórico de uploads
    const dates = mapped
      .map((r) => r.values.creada_en as string | null)
      .filter((d): d is string => Boolean(d))
      .sort();
    const dateStart = dates[0] ? dates[0].slice(0, 10) : null;
    const dateEnd = dates.length ? dates[dates.length - 1].slice(0, 10) : null;

    const { data: uploadRow, error: uploadError } = await withRetry(() =>
      supabase
        .from("uploads")
        .insert({
          tipo,
          filename,
          row_count: mapped.length,
          date_range_start: dateStart,
          date_range_end: dateEnd,
        })
        .select()
        .single()
    );

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

      const { error } = await withRetry(() =>
        supabase.from(config.table).upsert(batch, { onConflict: "order_id" })
      );
      if (error) throw error;
      inserted += batch.length;
    }

    // 3) Ya que se guardó todo en la base, borramos el archivo temporal
    //    de Storage (cada fila ya quedó respaldada en la columna "raw").
    //    Si este paso falla no es grave — el archivo queda ahí sin usarse,
    //    así que no debe tumbar una carga que sí funcionó.
    try {
      await withRetry(() => supabase.storage.from(BUCKET).remove([path]));
    } catch (cleanupErr) {
      console.warn("No se pudo borrar el archivo temporal de Storage:", cleanupErr);
    }

    // 4) Actualizamos las estadísticas de la tabla para que las consultas
    //    sigan siendo rápidas después de una carga grande (si no, Postgres
    //    puede elegir un plan lento y algunas pantallas tardan o truenan).
    try {
      await supabase.rpc("analyze_table", { p_table: config.table });
    } catch (analyzeErr) {
      console.warn("No se pudo actualizar estadísticas de la tabla:", analyzeErr);
    }

    return NextResponse.json({
      ok: true,
      tipo,
      filename,
      rows_processed: inserted,
      date_range: dateStart && dateEnd ? `${dateStart} → ${dateEnd}` : null,
      upload_id: uploadRow.id,
    });
  } catch (err: unknown) {
    console.error("Error en /api/upload:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    // Dejamos el archivo en Storage si algo falló, para poder revisarlo.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
