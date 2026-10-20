import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "id,etiqueta,usuario,contrasena";
const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

async function soloAdmin() {
  const sesion = await sesionActual();
  return sesion?.rol === "admin" ? null : NextResponse.json({ error: "Solo el administrador." }, { status: 403 });
}

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Usuarios master (solo administrador). */
export async function GET() {
  const no = await soloAdmin();
  if (no) return no;
  const { data, error } = await withRetryResult(() => getSupabaseAdmin().from("credenciales_master").select(COLS).order("etiqueta"));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ masters: data ?? [] }, { headers: NO_CACHE });
}

export async function POST(req: Request) {
  try {
    const no = await soloAdmin();
    if (no) return no;
    const b = (await req.json()) as Record<string, unknown>;
    const fila = { etiqueta: texto(b.etiqueta, 120), usuario: texto(b.usuario, 120), contrasena: texto(b.contrasena, 120) };
    if (!fila.etiqueta || !fila.usuario || !fila.contrasena) return NextResponse.json({ error: "Faltan datos: nombre, usuario y contraseña." }, { status: 400 });
    const { data, error } = await withRetryResult(() => getSupabaseAdmin().from("credenciales_master").insert(fila).select(COLS).single());
    if (error) throw new Error(error.message);
    return NextResponse.json({ master: data });
  } catch (err) {
    console.error("Error en POST /api/credenciales/master:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
