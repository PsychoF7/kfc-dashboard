import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "id,etiqueta,usuario,contrasena";
const t = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function soloAdmin() {
  const sesion = await sesionActual();
  return sesion?.rol === "admin" ? null : NextResponse.json({ error: "Solo el administrador." }, { status: 403 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const no = await soloAdmin();
    if (no) return no;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const b = (await req.json()) as Record<string, unknown>;
    const fila = { etiqueta: t(b.etiqueta, 120), usuario: t(b.usuario, 120), contrasena: t(b.contrasena, 120) };
    if (!fila.etiqueta || !fila.usuario || !fila.contrasena) return NextResponse.json({ error: "Faltan datos: nombre, usuario y contraseña." }, { status: 400 });
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin().from("credenciales_master").update({ ...fila, updated_at: new Date().toISOString() }).eq("id", id).select(COLS).single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ master: data });
  } catch (err) {
    console.error("Error en PATCH /api/credenciales/master/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const no = await soloAdmin();
    if (no) return no;
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { error } = await withRetryResult(() => getSupabaseAdmin().from("credenciales_master").delete().eq("id", id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /api/credenciales/master/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
