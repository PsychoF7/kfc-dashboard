import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { revisarSlack } from "@/lib/reportes-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Revisa el hilo de Slack de un reporte y guarda lo que encuentre. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return NextResponse.json({ error: "Id inválido." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      supabase.from("reportes").select("id, slack_url").eq("id", id).single()
    );
    if (error || !data) return NextResponse.json({ error: "No se encontró el reporte." }, { status: 404 });
    const reporte = await revisarSlack(supabase, data as { id: number; slack_url: string | null });
    return NextResponse.json({ reporte });
  } catch (err) {
    console.error("Error en POST /api/reportes/[id]/slack:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
