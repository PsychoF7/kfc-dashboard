import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { COOKIE, DURACION_LARGA_SEG, DURACION_SEG, firmarSesion } from "@/lib/sesion";
import { esRol } from "@/lib/permisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_GENERICO = "Correo o contraseña incorrectos.";

/** Valida correo y contraseña con Supabase Auth y abre la sesión. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const duracion = body?.recordar === true ? DURACION_LARGA_SEG : DURACION_SEG;
    if (!email || !password) {
      return NextResponse.json({ error: "Escribe tu correo y tu contraseña." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const publico = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await publico.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await new Promise((r) => setTimeout(r, 600)); // frena intentos a lo bruto
      return NextResponse.json({ error: ERROR_GENERICO }, { status: 401 });
    }

    // Tener cuenta en Supabase no basta: además debe estar dada de alta en "perfiles".
    const admin = getSupabaseAdmin();
    const { data: perfil, error: errPerfil } = await admin
      .from("perfiles")
      .select("rol, nombre, activo")
      .eq("id", data.user.id)
      .maybeSingle();
    if (errPerfil) {
      return NextResponse.json({ error: "No se pudo revisar tu perfil. Intenta de nuevo." }, { status: 500 });
    }
    if (!perfil || !perfil.activo || !esRol(perfil.rol)) {
      return NextResponse.json(
        { error: "Tu usuario no tiene acceso al panel. Pide que te den de alta." },
        { status: 403 }
      );
    }

    await admin.from("perfiles").update({ ultimo_acceso: new Date().toISOString() }).eq("id", data.user.id);

    const valor = await firmarSesion({
      uid: data.user.id,
      email,
      nombre: perfil.nombre || email,
      rol: perfil.rol,
    }, duracion);
    const res = NextResponse.json({ ok: true, rol: perfil.rol });
    res.cookies.set(COOKIE, valor, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: duracion,
    });
    return res;
  } catch (err) {
    console.error("Error en /api/auth/login:", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Intenta de nuevo." }, { status: 500 });
  }
}
