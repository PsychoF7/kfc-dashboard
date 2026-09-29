import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import type { DevOpciones, DevReporte, DevSemanaTendencia } from "@/lib/devoluciones";

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

/** Trae el reporte de la semana y la tendencia de las últimas 12 semanas. */
export async function obtenerReporte(weekStart: string, weekEnd: string, op: DevOpciones) {
  const supabase = getSupabaseAdmin();
  const [rep, tend] = await Promise.all([
    withRetryResult(() =>
      supabase.rpc("get_dev_reporte", {
        p_week_start: weekStart,
        p_week_end: weekEnd,
        p_incluir_returning: op.incluirReturning,
        p_incluir_rechazadas: op.incluirRechazadas,
      })
    ),
    withRetryResult(() =>
      supabase.rpc("get_dev_tendencia", {
        p_hasta: weekEnd,
        p_semanas: 12,
        p_incluir_returning: op.incluirReturning,
        p_incluir_rechazadas: op.incluirRechazadas,
      })
    ),
  ]);
  if (rep.error) throw new Error(rep.error.message);
  if (tend.error) throw new Error(tend.error.message);
  return {
    reporte: rep.data as DevReporte,
    tendencia: (tend.data ?? []) as DevSemanaTendencia[],
  };
}
