import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/auth-server";
import { olvidarMantenimiento } from "@/lib/mantenimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Solo el administrador enciende o apaga el mantenimiento. */
export async function PUT(req: Request) {
  const s = await sesionActual();
  if (!s || s.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const activo = body?.activo === true;
  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 500);
  const { error } = await getSupabaseAdmin()
    .from("app_config")
    .upsert({ clave: "mantenimiento", valor: { activo, mensaje }, actualizado_en: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "No se pudo guardar el mantenimiento." }, { status: 500 });
  olvidarMantenimiento();
  return NextResponse.json({ ok: true, mantenimiento: { activo, mensaje } });
}
