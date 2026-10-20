import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { huellaCodigo, normalizarCodigo } from "@/lib/credenciales-codigo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INTENTOS = 5;
const VENTANA_MIN = 15;
const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Canjea un código de un solo uso y devuelve los usuarios master. El código
 * queda gastado en el mismo instante: no sirve una segunda vez.
 */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (!sesion) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
    const quien = sesion.email || sesion.nombre || "desconocido";
    const supabase = getSupabaseAdmin();

    const desde = new Date(Date.now() - VENTANA_MIN * 60000).toISOString();
    const previos = await withRetryResult(() =>
      supabase.from("credenciales_intentos").select("id").eq("quien", quien).gte("en", desde)
    );
    if ((previos.data?.length ?? 0) >= MAX_INTENTOS) {
      return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos y pide un código nuevo." }, { status: 429 });
    }

    const { codigo } = (await req.json()) as { codigo?: unknown };
    const limpio = typeof codigo === "string" ? normalizarCodigo(codigo) : "";
    if (limpio.length !== 8) return NextResponse.json({ error: "Escribe el código completo." }, { status: 400 });

    // Un solo UPDATE condicionado: si dos personas lo usan a la vez, solo una lo logra
    const canje = await withRetryResult(() =>
      supabase
        .from("credenciales_codigos")
        .update({ usado_en: new Date().toISOString(), usado_por: quien })
        .eq("codigo_hash", huellaCodigo(limpio))
        .is("usado_en", null)
        .gt("vence_en", new Date().toISOString())
        .select("id")
    );
    if (canje.error) throw new Error(canje.error.message);
    if (!canje.data || canje.data.length === 0) {
      await withRetryResult(() => supabase.from("credenciales_intentos").insert({ quien }));
      return NextResponse.json({ error: "Código inválido, vencido o ya usado." }, { status: 400 });
    }

    const { data, error } = await withRetryResult(() =>
      supabase.from("credenciales_master").select("id,etiqueta,usuario,contrasena").order("etiqueta")
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ masters: data ?? [] }, { headers: NO_CACHE });
  } catch (err) {
    console.error("Error en POST /api/credenciales/master/revelar:", err);
    return NextResponse.json({ error: "No se pudo validar el código." }, { status: 500 });
  }
}
