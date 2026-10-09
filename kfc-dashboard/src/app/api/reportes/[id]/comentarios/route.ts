import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Comentarios de un reporte, del más viejo al más nuevo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() =>
    supabase
      .from("reportes_comentarios")
      .select("id, reporte_id, autor, texto, created_at")
      .eq("reporte_id", id)
      .order("created_at", { ascending: true })
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comentarios: data ?? [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

/** Agrega un comentario. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const b = await req.json();
    const texto = typeof b.texto === "string" ? b.texto.trim().slice(0, 3000) : "";
    if (!texto) return NextResponse.json({ error: "Escribe el comentario." }, { status: 400 });
    const autor = typeof b.autor === "string" && b.autor.trim() ? b.autor.trim().slice(0, 100) : null;
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      supabase
        .from("reportes_comentarios")
        .insert({ reporte_id: id, autor, texto })
        .select("id, reporte_id, autor, texto, created_at")
        .single()
    );
    if (error) throw new Error(error.message);
    await withRetryResult(() =>
      supabase.from("reportes").update({ updated_at: new Date().toISOString() }).eq("id", id)
    );
    return NextResponse.json({ comentario: data });
  } catch (err) {
    console.error("Error en POST /api/reportes/[id]/comentarios:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
