import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Coordinadores con tiendas asignadas (para elegir la región de un usuario de consulta). */
export async function regionesDisponibles() {
  const { data } = await getSupabaseAdmin().from("tienda_regiones").select("coordinador, region");
  const mapa = new Map<string, Set<string>>();
  (data ?? []).forEach((r) => {
    if (!mapa.has(r.coordinador)) mapa.set(r.coordinador, new Set());
    mapa.get(r.coordinador)!.add(r.region);
  });
  return [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([valor, regiones]) => ({ valor, etiqueta: regiones.has("FQ") ? `${valor} (Franquicias)` : valor }));
}
