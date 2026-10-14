import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetry, withRetryResult } from "@/lib/supabase/retry";
import { findMissingRequiredColumns } from "@/lib/parse/parseFile";
import { prepararReembolsos, REEMBOLSOS_COLUMNS, REEMBOLSOS_REQUERIDAS } from "@/lib/reembolsos";

// Carga de reembolsos por partes (el navegador lee el archivo y manda lotes chicos).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 500;

interface Cuerpo {
  filename: string;
  headers: string[];
  rows?: unknown[][];
  upload_id?: string;
  final?: { row_count: number; date_start: string | null; date_end: string | null };
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  try {
    const body = (await req.json()) as Cuerpo;

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
      return NextResponse.json({ ok: true });
    }

    const headers = body.headers ?? [];
    const rows = body.rows ?? [];

    const faltan = findMissingRequiredColumns(headers, REEMBOLSOS_COLUMNS, REEMBOLSOS_REQUERIDAS);
    if (faltan.length > 0) {
      return NextResponse.json(
        { error: `El archivo no parece ser de reembolsos. Faltan columnas: ${faltan.join(", ")}.` },
        { status: 400 }
      );
    }

    let uploadId = body.upload_id;
    if (!uploadId) {
      const { data, error } = await withRetry(() =>
        supabase.from("uploads").insert({ tipo: "reembolsos", filename: body.filename, row_count: 0 }).select("id").single()
      );
      if (error) throw error;
      uploadId = String(data.id);
    }

    const { filas, descartadas_no_kfc, omitidas } = prepararReembolsos(headers, rows);

    let guardadas = 0;
    for (let i = 0; i < filas.length; i += BATCH_SIZE) {
      const lote = filas.slice(i, i + BATCH_SIZE);
      const { data, error } = await withRetryResult(() =>
        supabase.rpc("cargar_reembolsos", { p_rows: lote, p_batch: uploadId })
      );
      if (error) throw new Error(error.message);
      guardadas += Number(data ?? lote.length);
    }

    const fechas = filas.map((f) => f.fecha_venta).filter((d): d is string => !!d).sort();
    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      guardadas,
      descartadas_no_kfc,
      omitidas,
      fecha_min: fechas[0] ?? null,
      fecha_max: fechas.length ? fechas[fechas.length - 1] : null,
    });
  } catch (err: unknown) {
    console.error("Error en /api/reembolsos/lote:", err);
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as any).message) : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
