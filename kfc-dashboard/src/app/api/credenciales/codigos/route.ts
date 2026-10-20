import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { VIGENCIAS_HORAS, huellaCodigo, nuevoCodigo } from "@/lib/credenciales-codigo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

async function soloAdmin() {
  const sesion = await sesionActual();
  return sesion?.rol === "admin" ? sesion : null;
}
const prohibido = () => NextResponse.json({ error: "Solo el administrador." }, { status: 403 });

/** Historial de códigos (nunca el código en sí). */
export async function GET() {
  if (!(await soloAdmin())) return prohibido();
  const { data, error } = await withRetryResult(() =>
    getSupabaseAdmin().from("credenciales_codigos").select("id,para,creado_en,vence_en,usado_en,usado_por").order("creado_en", { ascending: false }).limit(30)
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ codigos: data ?? [] }, { headers: NO_CACHE });
}

/** Genera un código nuevo. Se devuelve una sola vez: aquí solo queda su huella. */
export async function POST(req: Request) {
  try {
    const sesion = await soloAdmin();
    if (!sesion) return prohibido();
    const b = (await req.json().catch(() => ({}))) as { para?: unknown; horas?: unknown };
    const horas = VIGENCIAS_HORAS.includes(Number(b.horas)) ? Number(b.horas) : 24;
    const para = typeof b.para === "string" ? b.para.trim().slice(0, 120) || null : null;
    const codigo = nuevoCodigo();
    const vence = new Date(Date.now() + horas * 3600000).toISOString();
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin()
        .from("credenciales_codigos")
        .insert({ codigo_hash: huellaCodigo(codigo), para, creado_por: sesion.nombre ?? null, vence_en: vence })
        .select("id,para,creado_en,vence_en,usado_en,usado_por")
        .single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ codigo, registro: data }, { headers: NO_CACHE });
  } catch (err) {
    console.error("Error en POST /api/credenciales/codigos:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

/** Anula un código que todavía no se usó. */
export async function DELETE(req: Request) {
  try {
    if (!(await soloAdmin())) return prohibido();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const { error } = await withRetryResult(() => getSupabaseAdmin().from("credenciales_codigos").delete().eq("id", id).is("usado_en", null));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /api/credenciales/codigos:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
