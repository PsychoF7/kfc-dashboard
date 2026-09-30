import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import type { TiemposPanorama, ZonaRoja } from "@/lib/tiempos";

function param(sp: URLSearchParams, key: string): string | null {
  const v = sp.get(key);
  return v && v !== "" ? v : null;
}

function arrayParam(sp: URLSearchParams, key: string): string[] | null {
  const values = sp.getAll(key).filter(Boolean);
  return values.length > 0 ? values : null;
}

/** Análisis de tiempos con los filtros del panel principal + zonas rojas. */
export async function obtenerTiempos(req: Request) {
  const sp = new URL(req.url).searchParams;
  const orden_planeada = param(sp, "orden_planeada");
  const supabase = getSupabaseAdmin();

  const [pan, zr] = await Promise.all([
    withRetryResult(() =>
      supabase.rpc("get_tiempos_panorama", {
        p_date_from: param(sp, "date_from"),
        p_date_to: param(sp, "date_to"),
        p_ciudad: arrayParam(sp, "ciudad"),
        p_restaurant: arrayParam(sp, "restaurant"),
        p_zona: arrayParam(sp, "zona"),
        p_estatus: arrayParam(sp, "estatus"),
        p_repartido_por: arrayParam(sp, "repartido_por"),
        p_orden_planeada: orden_planeada === null ? null : orden_planeada === "true",
        p_price_min: param(sp, "price_min"),
        p_price_max: param(sp, "price_max"),
      })
    ),
    withRetryResult(() =>
      supabase
        .from("tiempos_zonas_rojas")
        .select("id, alcance, valores, horario, nota")
        .order("created_at", { ascending: true })
    ),
  ]);
  if (pan.error) throw new Error(pan.error.message);
  return {
    panorama: (pan.data ?? null) as TiemposPanorama | null,
    zonasRojas: (zr.error ? [] : zr.data ?? []) as ZonaRoja[],
  };
}
