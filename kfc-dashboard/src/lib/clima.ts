import type { SupabaseClient } from "@supabase/supabase-js";
import { withRetryResult } from "@/lib/supabase/retry";
import { esMalClima, sumarDias, type ClimaDia } from "@/lib/devoluciones";

// Consulta del clima histórico por ciudad con Open-Meteo (gratis, sin clave).
// Se guarda en la tabla dev_clima para no volver a consultar los mismos días.

const MAX_DIAS = 120; // por consulta, para no pedir años de clima de golpe
const LOTE_CIUDADES = 25; // ciudades por petición a Open-Meteo

interface Ciudad {
  ciudad: string;
  lat: number;
  lon: number;
}

function hoyMexico() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

async function pedirOpenMeteo(ciudades: Ciudad[], desde: string, hasta: string) {
  // El servicio de pronóstico guarda ~3 meses hacia atrás; más viejo, el archivo histórico.
  const reciente = desde >= sumarDias(hoyMexico(), -85);
  const base = reciente ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const url =
    `${base}?latitude=${ciudades.map((c) => c.lat.toFixed(4)).join(",")}` +
    `&longitude=${ciudades.map((c) => c.lon.toFixed(4)).join(",")}` +
    `&daily=precipitation_sum,weather_code,wind_gusts_10m_max` +
    `&timezone=America%2FMexico_City&start_date=${desde}&end_date=${hasta}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const json = await res.json();
  const lista = Array.isArray(json) ? json : [json];
  return lista.map((r: any) => r?.daily ?? null);
}

/** Se asegura de tener el clima de cada ciudad para cada día del rango
 * (solo días ya terminados) y regresa los días de mal clima. */
export async function sincronizarClima(
  supabase: SupabaseClient,
  desde: string,
  hasta: string
): Promise<ClimaDia[]> {
  const ayer = sumarDias(hoyMexico(), -1);
  const fin = hasta < ayer ? hasta : ayer;
  let inicio = desde;
  if (sumarDias(fin, -(MAX_DIAS - 1)) > inicio) inicio = sumarDias(fin, -(MAX_DIAS - 1));

  if (inicio <= fin) {
    try {
      const { data: coords } = await withRetryResult(() => supabase.rpc("get_dev_ciudades_coords"));
      const ciudades = ((coords ?? []) as Ciudad[]).filter((c) => c.lat != null && c.lon != null);

      // ¿Qué ciudades ya tienen todos los días guardados?
      const dias = Math.round((Date.parse(fin) - Date.parse(inicio)) / 86400000) + 1;
      const { data: guardados } = await withRetryResult(() =>
        supabase.from("dev_clima").select("ciudad, fecha").gte("fecha", inicio).lte("fecha", fin).limit(20000)
      );
      const cuenta = new Map<string, number>();
      (guardados ?? []).forEach((g: { ciudad: string }) => cuenta.set(g.ciudad, (cuenta.get(g.ciudad) ?? 0) + 1));
      const faltan = ciudades.filter((c) => (cuenta.get(c.ciudad) ?? 0) < dias);

      for (let i = 0; i < faltan.length; i += LOTE_CIUDADES) {
        const lote = faltan.slice(i, i + LOTE_CIUDADES);
        const resultados = await pedirOpenMeteo(lote, inicio, fin);
        const filas: Record<string, unknown>[] = [];
        lote.forEach((c, idx) => {
          const d = resultados[idx];
          if (!d?.time) return;
          d.time.forEach((fecha: string, k: number) => {
            const lluvia = d.precipitation_sum?.[k] ?? null;
            const codigo = d.weather_code?.[k] ?? null;
            const rafaga = d.wind_gusts_10m_max?.[k] ?? null;
            filas.push({
              ciudad: c.ciudad,
              fecha,
              lat: c.lat,
              lon: c.lon,
              lluvia_mm: lluvia,
              codigo,
              rafaga_kmh: rafaga,
              malo: esMalClima(lluvia, codigo, rafaga),
              updated_at: new Date().toISOString(),
            });
          });
        });
        // ignoreDuplicates: si ya existía el día, se respeta (y su nota)
        if (filas.length) {
          await withRetryResult(() =>
            supabase.from("dev_clima").upsert(filas, { onConflict: "ciudad,fecha", ignoreDuplicates: true })
          );
        }
      }
    } catch (err) {
      // Si el servicio de clima no responde, seguimos con lo que ya esté guardado
      console.warn("No se pudo actualizar el clima:", err);
    }
  }

  const { data, error } = await withRetryResult(() =>
    supabase
      .from("dev_clima")
      .select("ciudad, fecha, lluvia_mm, codigo, rafaga_kmh, nota, descartado")
      .eq("malo", true)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
  );
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    ...r,
    lluvia_mm: r.lluvia_mm == null ? null : Number(r.lluvia_mm),
    rafaga_kmh: r.rafaga_kmh == null ? null : Number(r.rafaga_kmh),
  })) as ClimaDia[];
}
