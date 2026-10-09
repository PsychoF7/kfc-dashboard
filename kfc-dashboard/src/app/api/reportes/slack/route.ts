import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { esTipo } from "@/lib/reportes";
import { revisarSlack } from "@/lib/reportes-server";
import { slackConfigurado } from "@/lib/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Revisa de un jalón el Slack de todos los reportes abiertos de un tipo que tengan link. */
export async function POST(req: Request) {
  try {
    const { tipo } = await req.json();
    if (!esTipo(tipo)) return NextResponse.json({ error: "Falta tipo." }, { status: 400 });
    if (!slackConfigurado()) {
      return NextResponse.json({ error: "Slack todavía no está conectado al tablero." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await withRetryResult(() =>
      supabase
        .from("reportes")
        .select("id, slack_url")
        .eq("tipo", tipo)
        .neq("estatus", "resuelto")
        .not("slack_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(40)
    );
    if (error) throw new Error(error.message);
    let revisados = 0;
    for (const r of (data ?? []) as { id: number; slack_url: string | null }[]) {
      await revisarSlack(supabase, r);
      revisados++;
    }
    return NextResponse.json({ revisados });
  } catch (err) {
    console.error("Error en POST /api/reportes/slack:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
