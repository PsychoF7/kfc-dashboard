import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALCANCES = ["zona", "ciudad", "tienda"];
const CAMPOS = "id, alcance, valores, horario, nota";

/** Crea una zona roja, o la actualiza si viene con id. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const alcance = String(body.alcance ?? "");
    const valores: string[] = Array.isArray(body.valores) ? body.valores.map(String) : [];
    const nota = String(body.nota ?? "").trim();
    const horario = String(body.horario ?? "").trim() || null;
    if (!ALCANCES.includes(alcance)) return NextResponse.json({ error: "Elige zona, ciudad o tienda." }, { status: 400 });
    if (valores.length === 0) return NextResponse.json({ error: "Elige al menos una opción." }, { status: 400 });
    if (!nota) return NextResponse.json({ error: "Escribe por qué es zona roja." }, { status: 400 });

    const fila = { alcance, valores, nota, horario, updated_at: new Date().toISOString() };
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      body.id
        ? supabase.from("tiempos_zonas_rojas").update(fila).eq("id", body.id).select(CAMPOS).single()
        : supabase.from("tiempos_zonas_rojas").insert(fila).select(CAMPOS).single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, zona: data });
  } catch (err) {
    console.error("Error en POST /api/tiempos/zonas-rojas:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Borra una zona roja (?id=...). */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { error } = await withRetryResult(() => supabase.from("tiempos_zonas_rojas").delete().eq("id", id));
  if (error) {
    console.error("Error en DELETE /api/tiempos/zonas-rojas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
