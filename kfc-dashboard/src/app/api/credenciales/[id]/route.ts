import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { COLUMNAS_CRED, limpiarCredencial } from "@/lib/credenciales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function soloEquipo() {
  const sesion = await sesionActual();
  return !sesion || sesion.rol === "consulta" ? NextResponse.json({ error: "Sin permiso." }, { status: 403 }) : null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const sinPermiso = await soloEquipo();
    if (sinPermiso) return sinPermiso;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { fila, error: invalido } = limpiarCredencial((await req.json()) as Record<string, unknown>, true);
    if (invalido || !fila) return NextResponse.json({ error: invalido }, { status: 400 });
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin().from("credenciales").update({ ...fila, updated_at: new Date().toISOString() }).eq("id", id).select(COLUMNAS_CRED).single()
    );
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe ese usuario para ese producto." }, { status: 409 });
    if (error) throw new Error(error.message);
    return NextResponse.json({ credencial: data });
  } catch (err) {
    console.error("Error en PATCH /api/credenciales/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const sinPermiso = await soloEquipo();
    if (sinPermiso) return sinPermiso;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { error } = await withRetryResult(() => getSupabaseAdmin().from("credenciales").delete().eq("id", id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /api/credenciales/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
