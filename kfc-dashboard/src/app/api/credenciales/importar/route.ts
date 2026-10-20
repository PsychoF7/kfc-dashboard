import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { limpiarCredencial } from "@/lib/credenciales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 200;

/** Importa las credenciales leídas del Excel: agrega las nuevas y actualiza las existentes. */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (!sesion || sesion.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const body = (await req.json()) as { credenciales?: Record<string, unknown>[] };
    const crudas = Array.isArray(body.credenciales) ? body.credenciales : [];
    if (crudas.length === 0) return NextResponse.json({ error: "El archivo no trae credenciales." }, { status: 400 });

    const filas: Record<string, unknown>[] = [];
    let omitidas = 0;
    for (const b of crudas) {
      const { fila } = limpiarCredencial(b, false);
      if (fila) filas.push(fila);
      else omitidas++;
    }
    if (filas.length === 0) return NextResponse.json({ error: "No encontré credenciales válidas en el archivo." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let nuevos = 0;
    let actualizados = 0;
    for (let i = 0; i < filas.length; i += LOTE) {
      const { data, error } = await withRetryResult(() =>
        supabase.rpc("importar_credenciales", { p_rows: filas.slice(i, i + LOTE), p_creado: sesion.nombre ?? "Excel" })
      );
      if (error) throw new Error(error.message);
      const r = data as { nuevos: number; actualizados: number };
      nuevos += r.nuevos;
      actualizados += r.actualizados;
    }
    return NextResponse.json({ ok: true, nuevos, actualizados, omitidas });
  } catch (err) {
    console.error("Error en POST /api/credenciales/importar:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
