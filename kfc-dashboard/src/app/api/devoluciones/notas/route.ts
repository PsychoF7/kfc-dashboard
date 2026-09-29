import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECCIONES = ["caso", "gps", "telefono", "direccion"];

/** Guarda (o borra, si viene vacío) el comentario de un caso o duplicado. */
export async function POST(req: Request) {
  try {
    const { week_start, seccion, clave, nota } = await req.json();
    if (!week_start || !clave || !SECCIONES.includes(seccion)) {
      return NextResponse.json({ error: "Faltan week_start, seccion o clave." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const texto = typeof nota === "string" ? nota.trim() : "";

    const { error } = texto
      ? await withRetryResult(() =>
          supabase.from("dev_notas").upsert(
            {
              semana_inicio: week_start,
              seccion,
              clave,
              nota: texto,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "semana_inicio,seccion,clave" }
          )
        )
      : await withRetryResult(() =>
          supabase
            .from("dev_notas")
            .delete()
            .eq("semana_inicio", week_start)
            .eq("seccion", seccion)
            .eq("clave", clave)
        );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en POST /api/devoluciones/notas:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
