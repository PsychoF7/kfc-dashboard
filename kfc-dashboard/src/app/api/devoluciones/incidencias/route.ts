import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["clima", "trafico", "intermitencia", "bug", "evento", "otro"];
const ALCANCES = ["general", "zona", "ciudad", "tienda"];
const CAMPOS = "id, tipo, fecha_inicio, fecha_fin, alcance, alcance_valores, descripcion";

/** Lista las incidencias. Con ?desde=&hasta= trae solo las que tocan ese periodo. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const supabase = getSupabaseAdmin();

  const { data, error } = await withRetryResult(() => {
    let q = supabase.from("dev_incidencias").select(CAMPOS).order("fecha_inicio", { ascending: false });
    if (hasta) q = q.lte("fecha_inicio", hasta);
    if (desde) q = q.gte("fecha_fin", desde);
    return q;
  });
  if (error) {
    console.error("Error en GET /api/devoluciones/incidencias:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ incidencias: data ?? [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Crea una incidencia nueva, o la actualiza si viene con id. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tipo = String(body.tipo ?? "");
    const alcance = String(body.alcance ?? "general");
    const fecha_inicio = String(body.fecha_inicio ?? "");
    const fecha_fin = String(body.fecha_fin || body.fecha_inicio || "");
    const descripcion = String(body.descripcion ?? "").trim();
    const alcance_valores: string[] =
      alcance === "general" ? [] : Array.isArray(body.alcance_valores) ? body.alcance_valores.map(String) : [];

    if (!TIPOS.includes(tipo)) return NextResponse.json({ error: "Elige el tipo de incidencia." }, { status: 400 });
    if (!ALCANCES.includes(alcance)) return NextResponse.json({ error: "Alcance inválido." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
      return NextResponse.json({ error: "Elige la fecha de inicio (y de fin si dura varios días)." }, { status: 400 });
    }
    if (fecha_fin < fecha_inicio) {
      return NextResponse.json({ error: "La fecha de fin no puede ser antes que la de inicio." }, { status: 400 });
    }
    if (!descripcion) return NextResponse.json({ error: "Escribe una descripción breve." }, { status: 400 });
    if (alcance !== "general" && alcance_valores.length === 0) {
      return NextResponse.json({ error: "Elige al menos una zona, ciudad o tienda." }, { status: 400 });
    }

    const fila = { tipo, alcance, alcance_valores, fecha_inicio, fecha_fin, descripcion, updated_at: new Date().toISOString() };
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      body.id
        ? supabase.from("dev_incidencias").update(fila).eq("id", body.id).select(CAMPOS).single()
        : supabase.from("dev_incidencias").insert(fila).select(CAMPOS).single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, incidencia: data });
  } catch (err) {
    console.error("Error en POST /api/devoluciones/incidencias:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Borra una incidencia (?id=...). */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { error } = await withRetryResult(() => supabase.from("dev_incidencias").delete().eq("id", id));
  if (error) {
    console.error("Error en DELETE /api/devoluciones/incidencias:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
