import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { COLUMNAS_COMPLETAS } from "@/lib/altas-bajas";
import { limpiarMovimiento } from "@/lib/altas-bajas-validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function soloEquipo() {
  const sesion = await sesionActual();
  return sesion?.rol === "consulta" ? NextResponse.json({ error: "Sin permiso." }, { status: 403 }) : null;
}

/** Edita un movimiento (solo los campos que vengan). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const sinPermiso = await soloEquipo();
    if (sinPermiso) return sinPermiso;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { fila, error: invalido } = limpiarMovimiento((await req.json()) as Record<string, unknown>, true);
    if (invalido || !fila) return NextResponse.json({ error: invalido }, { status: 400 });
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin()
        .from("altas_bajas")
        .update({ ...fila, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select(COLUMNAS_COMPLETAS)
        .single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ movimiento: data });
  } catch (err) {
    console.error("Error en PATCH /api/altas-bajas/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

/** Borra un movimiento. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sinPermiso = await soloEquipo();
    if (sinPermiso) return sinPermiso;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { error } = await withRetryResult(() => getSupabaseAdmin().from("altas_bajas").delete().eq("id", id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /api/altas-bajas/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
