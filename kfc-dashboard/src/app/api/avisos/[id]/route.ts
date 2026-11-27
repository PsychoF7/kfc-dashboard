import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NIVELES = ["info", "importante"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Edita un aviso o lo activa / desactiva. Solo administrador. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await sesionActual();
  if (!s || s.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Aviso no válido." }, { status: 400 });
  const body = await req.json().catch(() => null);
  const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
  if (typeof body?.titulo === "string") {
    const t = body.titulo.trim().slice(0, 120);
    if (!t) return NextResponse.json({ error: "El título no puede quedar vacío." }, { status: 400 });
    cambios.titulo = t;
  }
  if (typeof body?.mensaje === "string") {
    const m = body.mensaje.trim().slice(0, 1500);
    if (!m) return NextResponse.json({ error: "El mensaje no puede quedar vacío." }, { status: 400 });
    cambios.mensaje = m;
  }
  if (NIVELES.includes(body?.nivel)) cambios.nivel = body.nivel;
  if (typeof body?.activo === "boolean") cambios.activo = body.activo;
  const { error } = await getSupabaseAdmin().from("avisos").update(cambios).eq("id", params.id);
  if (error) return NextResponse.json({ error: "No se pudo guardar el aviso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Elimina un aviso. Solo administrador. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const s = await sesionActual();
  if (!s || s.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Aviso no válido." }, { status: 400 });
  const { error } = await getSupabaseAdmin().from("avisos").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar el aviso." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
