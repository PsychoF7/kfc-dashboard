import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import type { DevOpciones, DevReporte, DevSemanaTendencia, Incidencia } from "@/lib/devoluciones";
import { sincronizarClima } from "@/lib/clima";
import { conCache } from "@/lib/cache";
import type { ClimaDia } from "@/lib/devoluciones";

/** Lee semana y switches de la URL (?week_start=&week_end=&returning=1&rechazadas=1). */
export function leerParametros(req: Request) {
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("week_start");
  const weekEnd = searchParams.get("week_end");
  const opciones: DevOpciones = {
    incluirReturning: searchParams.get("returning") === "1",
    incluirRechazadas: searchParams.get("rechazadas") !== "0",
  };
  return { weekStart, weekEnd, opciones };
}

/** Parte "base" del reporte: lo indispensable para pintar la pantalla
 * (el reporte de la semana y las incidencias). Es lo más pesado, así que
 * va solo, sin competir con otras consultas. */
export async function obtenerReporteBase(weekStart: string, weekEnd: string, op: DevOpciones) {
  const supabase = getSupabaseAdmin();
  const paramsRep = {
    p_week_start: weekStart,
    p_week_end: weekEnd,
    p_incluir_returning: op.incluirReturning,
    p_incluir_rechazadas: op.incluirRechazadas,
  };
  const [reporte, inc] = await Promise.all([
    // El reporte se guarda mientras no haya data ni notas nuevas
    conCache(
      "dev-reporte",
      paramsRep,
      async () => {
        const { data, error } = await withRetryResult(() => supabase.rpc("get_dev_reporte", paramsRep));
        if (error) throw new Error(error.message);
        return data as DevReporte;
      },
      { notas: true }
    ),
    withRetryResult(() =>
      supabase
        .from("dev_incidencias")
        .select("id, tipo, fecha_inicio, fecha_fin, alcance, alcance_valores, descripcion")
        .lte("fecha_inicio", weekEnd)
        .gte("fecha_fin", weekStart)
        .order("fecha_inicio", { ascending: true })
    ),
  ]);
  return {
    reporte,
    // Si la tabla de incidencias no existe todavía, el reporte sale igual
    incidencias: (inc.error ? [] : inc.data ?? []) as Incidencia[],
  };
}

/** Complemento: tendencia de las últimas 12 semanas y clima. Si alguno
 * falla o tarda, el reporte NO se cae: simplemente llega vacío. */
export async function obtenerReporteExtra(weekStart: string, weekEnd: string, op: DevOpciones) {
  const supabase = getSupabaseAdmin();
  const [tend, clima] = await Promise.all([
    withRetryResult(() =>
      supabase.rpc("get_dev_tendencia", {
        p_hasta: weekEnd,
        p_semanas: 12,
        p_incluir_returning: op.incluirReturning,
        p_incluir_rechazadas: op.incluirRechazadas,
      })
    ),
    sincronizarClima(supabase, weekStart, weekEnd).catch((err) => {
      console.warn("Clima no disponible:", err);
      return [] as ClimaDia[];
    }),
  ]);
  if (tend.error) console.warn("Tendencia no disponible:", tend.error.message);
  return {
    tendencia: (tend.error ? [] : tend.data ?? []) as DevSemanaTendencia[],
    clima,
  };
}

/** Todo junto (lo usa el Excel). La tendencia y el clima ya no pueden
 * tumbar el reporte. */
export async function obtenerReporte(weekStart: string, weekEnd: string, op: DevOpciones) {
  const base = await obtenerReporteBase(weekStart, weekEnd, op);
  const extra = await obtenerReporteExtra(weekStart, weekEnd, op);
  return { ...base, ...extra };
}
