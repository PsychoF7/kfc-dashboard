import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NIVELES = ["info", "importante"];

// La fecha de los datos cambia solo al cargar archivos: se guarda un minuto.
let memoFecha: { en: number; valor: string | null } | null = null;
async function fechaDatos(): Promise<string | null> {
  if (memoFecha && Date.now() - memoFecha.en < 60_000) return memoFecha.valor;
  const { data } = await getSupabaseAdmin().rpc("datos_hasta");
  const valor = typeof data === "string" ? data : null;
  memoFecha = { en: Date.now(), valor };
  return valor;
}

/** Avisos activos y fecha de los datos. El administrador también recibe todos los avisos y el mantenimiento. */
export async function GET() {
  const s = await sesionActual();
  if (!s) return NextResponse.json({ error: "Tu sesión terminó." }, { status: 401 });
  const admin = getSupabaseAdmin();
  let q = admin.from("avisos").select("id, titulo, mensaje, nivel, activo, creado_en, actualizado_en").order("creado_en", { ascending: false });
  if (s.rol !== "admin") q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "No se pudieron cargar los avisos." }, { status: 500 });
  const datos_hasta = await fechaDatos();
  return NextResponse.json({ avisos: data ?? [], datos_hasta });
}

/** Solo el administrador crea avisos. */
export async function POST(req: Request) {
  const s = await sesionActual();
  if (!s || s.rol !== "admin") return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const titulo = String(body?.titulo ?? "").trim().slice(0, 120);
  const mensaje = String(body?.mensaje ?? "").trim().slice(0, 1500);
  const nivel = NIVELES.includes(body?.nivel) ? body.nivel : "info";
  if (!titulo || !mensaje) return NextResponse.json({ error: "Escribe el título y el mensaje del aviso." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin()
    .from("avisos")
    .insert({ titulo, mensaje, nivel, activo: true, creado_por: s.email })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "No se pudo crear el aviso." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
