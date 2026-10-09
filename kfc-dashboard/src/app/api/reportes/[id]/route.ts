import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { COLUMNAS_REPORTE, esEstatus, esPrioridad } from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function texto(v: unknown, max: number): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, max) : null;
}

/** Cambia campos de un reporte (solo los que vengan en el cuerpo). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const b = await req.json();
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("titulo" in b) {
      const t = texto(b.titulo, 200);
      if (!t) return NextResponse.json({ error: "El título no puede quedar vacío." }, { status: 400 });
      cambios.titulo = t;
    }
    if ("descripcion" in b) cambios.descripcion = texto(b.descripcion, 5000);
    if ("pantalla" in b) cambios.pantalla = texto(b.pantalla, 100);
    if ("slack_url" in b) {
      cambios.slack_url = texto(b.slack_url, 500);
      // Link nuevo = se borra lo que se había leído del anterior
      Object.assign(cambios, {
        slack_respuestas: null,
        slack_ultima_respuesta: null,
        slack_ultimo_autor: null,
        slack_ultimo_texto: null,
        slack_resuelto: null,
        slack_visto_respuestas: 0,
        slack_revisado_en: null,
        slack_error: null,
      });
    }
    if ("prioridad" in b) {
      if (!esPrioridad(b.prioridad)) return NextResponse.json({ error: "Prioridad inválida." }, { status: 400 });
      cambios.prioridad = b.prioridad;
    }
    if ("estatus" in b) {
      if (!esEstatus(b.estatus)) return NextResponse.json({ error: "Estatus inválido." }, { status: 400 });
      cambios.estatus = b.estatus;
      cambios.resuelto_en = b.estatus === "resuelto" ? new Date().toISOString() : null;
    }

    const supabase = getSupabaseAdmin();
    // "Ya vi las respuestas de Slack": se iguala el contador visto al actual
    if (b.marcar_visto === true) {
      const { data: actual } = await withRetryResult(() =>
        supabase.from("reportes").select("slack_respuestas").eq("id", id).single()
      );
      cambios.slack_visto_respuestas = (actual as { slack_respuestas: number | null } | null)?.slack_respuestas ?? 0;
    }

    const { data, error } = await withRetryResult(() =>
      supabase.from("reportes").update(cambios).eq("id", id).select(COLUMNAS_REPORTE).single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ reporte: data });
  } catch (err) {
    console.error("Error en PATCH /api/reportes/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

/** Borra un reporte (y sus comentarios). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { error } = await withRetryResult(() => supabase.from("reportes").delete().eq("id", id));
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en DELETE /api/reportes/[id]:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
