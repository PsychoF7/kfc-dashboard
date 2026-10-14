import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/auth-server";
import { esRol } from "@/lib/permisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cambia nombre, rol, estado (activo/baja) o contraseña de un usuario. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const yo = await sesionActual();
  if (yo?.rol !== "admin") return NextResponse.json({ error: "Solo el administrador puede editar usuarios." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const admin = getSupabaseAdmin();
  const esYo = params.id === yo.uid;

  const cambios: Record<string, unknown> = {};
  if (typeof body.nombre === "string") {
    if (!body.nombre.trim()) return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
    cambios.nombre = body.nombre.trim();
  }
  if (body.rol !== undefined) {
    if (!esRol(body.rol)) return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    if (esYo && body.rol !== "admin") return NextResponse.json({ error: "No puedes quitarte tu propio rol de administrador." }, { status: 400 });
    cambios.rol = body.rol;
  }
  if (body.activo !== undefined) {
    if (esYo && body.activo === false) return NextResponse.json({ error: "No puedes darte de baja a ti misma." }, { status: 400 });
    cambios.activo = !!body.activo;
  }

  if (Object.keys(cambios).length > 0) {
    const { error } = await admin.from("perfiles").update(cambios).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.password === "string" && body.password !== "") {
    if (body.password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    const { error } = await admin.auth.admin.updateUserById(params.id, { password: body.password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
