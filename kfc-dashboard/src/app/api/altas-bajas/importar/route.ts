import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { limpiarMovimiento } from "@/lib/altas-bajas-validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 300;

/** Importa los movimientos leídos del Excel: agrega los nuevos y actualiza los que ya existían. */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (sesion?.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = (await req.json()) as { movimientos?: Record<string, unknown>[] };
    const crudos = Array.isArray(body.movimientos) ? body.movimientos : [];
    if (crudos.length === 0) return NextResponse.json({ error: "El archivo no trae movimientos." }, { status: 400 });

    const filas: Record<string, unknown>[] = [];
    let omitidos = 0;
    for (const b of crudos) {
      const { fila } = limpiarMovimiento({ ...b, estado: b.estado ?? "Pendiente", activa: b.activa ?? "No iniciada" }, false);
      if (!fila) {
        omitidos++;
        continue;
      }
      filas.push(fila);
    }
    if (filas.length === 0) return NextResponse.json({ error: "No encontré movimientos válidos en el archivo." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let nuevos = 0;
    let actualizados = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
      const { data, error } = await withRetryResult(() =>
        supabase.rpc("importar_altas_bajas", { p_rows: filas.slice(i, i + LOTE), p_creado: sesion?.nombre ?? "Excel" })
      );
      if (error) throw new Error(error.message);
      const r = data as { nuevos: number; actualizados: number };
      nuevos += r.nuevos;
      actualizados += r.actualizados;
    }
    return NextResponse.json({ ok: true, nuevos, actualizados, omitidos });
  } catch (err) {
    console.error("Error en POST /api/altas-bajas/importar:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
