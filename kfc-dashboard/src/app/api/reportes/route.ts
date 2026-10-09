import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { COLUMNAS_REPORTE, esPrioridad, esTipo } from "@/lib/reportes";
import { slackConfigurado } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

function texto(v: unknown, max: number): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, max) : null;
}

/** Lista los reportes de un tipo (?tipo=bug|desarrollo) con su número de comentarios. */
export async function GET(req: Request) {
  const tipo = new URL(req.url).searchParams.get("tipo");
  if (!esTipo(tipo)) return NextResponse.json({ error: "Falta tipo (bug o desarrollo)." }, { status: 400 });
  const supabase = getSupabaseAdmin();

  const [rep, com] = await Promise.all([
    withRetryResult(() =>
      supabase.from("reportes").select(COLUMNAS_REPORTE).eq("tipo", tipo).order("created_at", { ascending: false })
    ),
    withRetryResult(() => supabase.from("reportes_comentarios").select("reporte_id")),
  ]);
  if (rep.error) {
    console.error("Error en GET /api/reportes:", rep.error);
    return NextResponse.json({ error: rep.error.message }, { status: 500 });
  }
  const comentarios: Record<number, number> = {};
  for (const c of (com.error ? [] : com.data ?? []) as { reporte_id: number }[]) {
    comentarios[c.reporte_id] = (comentarios[c.reporte_id] ?? 0) + 1;
  }
  return NextResponse.json(
    { reportes: rep.data ?? [], comentarios, slack_configurado: slackConfigurado() },
    { headers: NO_CACHE }
  );
}

/** Crea un reporte. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const titulo = texto(b.titulo, 200);
    if (!esTipo(b.tipo) || !titulo) {
      return NextResponse.json({ error: "Faltan el tipo y el título." }, { status: 400 });
    }
    const fila = {
      tipo: b.tipo,
      titulo,
      descripcion: texto(b.descripcion, 5000),
      pantalla: texto(b.pantalla, 100),
      prioridad: esPrioridad(b.prioridad) ? b.prioridad : "media",
      slack_url: texto(b.slack_url, 500),
      reportado_por: texto(b.reportado_por, 100),
    };
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      supabase.from("reportes").insert(fila).select(COLUMNAS_REPORTE).single()
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ reporte: data });
  } catch (err) {
    console.error("Error en POST /api/reportes:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
