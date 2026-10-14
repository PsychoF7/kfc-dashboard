import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/auth-server";
import { esRol } from "@/lib/permisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function soloAdmin() {
  const s = await sesionActual();
  return s?.rol === "admin" ? s : null;
}

/** Lista de usuarios con acceso al panel. */
export async function GET() {
  if (!(await soloAdmin())) return NextResponse.json({ error: "Solo el administrador puede ver usuarios." }, { status: 403 });
  const { data, error } = await getSupabaseAdmin()
    .from("perfiles")
    .select("id, email, nombre, rol, activo, created_at, ultimo_acceso")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ usuarios: data ?? [] });
}

/** Crea un usuario nuevo (cuenta en Supabase + perfil con su rol). */
export async function POST(req: Request) {
  if (!(await soloAdmin())) return NextResponse.json({ error: "Solo el administrador puede crear usuarios." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const nombre = String(body?.nombre ?? "").trim();
  const password = String(body?.password ?? "");
  const rol = body?.rol;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: "Escribe un nombre." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  if (!esRol(rol)) return NextResponse.json({ error: "Elige un rol." }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    const yaExiste = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: yaExiste ? "Ese correo ya tiene una cuenta." : error?.message ?? "No se pudo crear la cuenta." },
      { status: yaExiste ? 409 : 500 }
    );
  }
  const { error: errPerfil } = await admin
    .from("perfiles")
    .insert({ id: data.user.id, email, nombre, rol, activo: true });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(data.user.id); // no dejar cuentas a medias
    return NextResponse.json({ error: errPerfil.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.user.id });
}
