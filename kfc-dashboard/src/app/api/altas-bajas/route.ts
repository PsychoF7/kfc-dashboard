import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { COLUMNAS_COMPLETAS, COLUMNAS_PUBLICAS } from "@/lib/altas-bajas";
import { limpiarMovimiento } from "@/lib/altas-bajas-validar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };

/** Todos los movimientos. KFC (consulta) no recibe los pasos internos ni las notas. */
export async function GET() {
  const sesion = await sesionActual();
  const columnas = sesion?.rol === "consulta" ? COLUMNAS_PUBLICAS : COLUMNAS_COMPLETAS;
  const { data, error } = await withRetryResult(() =>
    getSupabaseAdmin().from("altas_bajas").select(columnas).order("fecha_solicitud", { ascending: false, nullsFirst: false }).order("id", { ascending: false })
  );
  if (error) {
    console.error("Error en GET /api/altas-bajas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ movimientos: data ?? [] }, { headers: NO_CACHE });
}

/** Registra un movimiento. */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (sesion?.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const b = (await req.json()) as Record<string, unknown>;
    const { fila, error: invalido } = limpiarMovimiento(b, false);
    if (invalido || !fila) return NextResponse.json({ error: invalido }, { status: 400 });
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin()
        .from("altas_bajas")
        .insert({ ...fila, creado_por: sesion?.nombre ?? null })
        .select(COLUMNAS_COMPLETAS)
        .single()
    );
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe ese movimiento (misma sucursal, producto y fecha de solicitud)." }, { status: 409 });
    if (error) throw new Error(error.message);
    return NextResponse.json({ movimiento: data });
  } catch (err) {
    console.error("Error en POST /api/altas-bajas:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
