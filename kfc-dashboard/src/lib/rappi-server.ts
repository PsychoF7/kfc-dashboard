import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import type { RappiTurbo } from "@/lib/rappi";

/** Análisis de Rappi Turbo (?desde=&hasta=). Sin fechas: desde 10 días antes
 * de la activación hasta el último día con data de operaciones. */
export async function obtenerTurbo(req: Request): Promise<RappiTurbo> {
  const sp = new URL(req.url).searchParams;
  const { data, error } = await withRetryResult(() =>
    getSupabaseAdmin().rpc("get_rappi_turbo", { p_desde: sp.get("desde") || null, p_hasta: sp.get("hasta") || null })
  );
  if (error) throw new Error(error.message);
  return data as RappiTurbo;
}
