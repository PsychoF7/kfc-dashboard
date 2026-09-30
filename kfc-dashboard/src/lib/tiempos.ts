// Tipos y utilidades de la sección Análisis de tiempos (data de operaciones).
import type { DashboardFilters } from "@/lib/types";

export const META_MINUTOS = 45;

export interface TiemposKpis {
  completadas: number;
  total_prom: number | null;
  pct_45: number | null;
  pct_60: number | null;
  recol_prom: number | null;
  recol_med: number | null;
  entrega_prom: number | null;
  espera_prom: number | null;
  n_espera: number;
  kmh_med: number | null;
  ant_completadas: number;
  ant_total_prom: number | null;
  ant_pct_45: number | null;
}

export interface TiemposDia {
  dia: string;
  ordenes: number;
  total_prom: number | null;
  recol_prom: number | null;
  pct_45: number | null;
}

export interface TiemposHora {
  hora: number;
  ordenes: number;
  total_prom: number | null;
  recol_prom: number | null;
  pct_45: number | null;
  kmh: number | null;
}

export interface TiemposTienda {
  tienda: string;
  zona: string;
  ciudad: string | null;
  lat: number | null;
  lon: number | null;
  ordenes: number;
  completadas: number;
  devueltas: number;
  pct_dev: number | null;
  total_prom: number | null;
  pct_45: number | null;
  recol_med: number | null;
  recol_zona: number | null;
  vs_zona: number | null;
  entrega_prom: number | null;
  espera_prom: number | null;
  n_espera: number;
  asignacion_prom: number | null;
}

export interface TiemposTrafico {
  zona: string;
  hora: number;
  kmh: number;
  ordenes: number;
}

export interface TiemposRelacion {
  rango: string;
  orden: number;
  ordenes: number;
  devueltas: number;
  pct_dev: number | null;
}

export interface TiemposPanorama {
  periodo: { desde: string; hasta: string };
  kpis: TiemposKpis;
  por_dia: TiemposDia[];
  por_hora: TiemposHora[];
  etapas: {
    recol: number | null;
    entrega: number | null;
    detalle: {
      ordenes: number;
      asignacion: number | null;
      llegada: number | null;
      espera: number | null;
      entrega: number | null;
    } | null;
  };
  tiendas: TiemposTienda[];
  trafico: TiemposTrafico[];
  relacion_devoluciones: TiemposRelacion[];
}

export type AlcanceZonaRoja = "zona" | "ciudad" | "tienda";

export interface ZonaRoja {
  id: string;
  alcance: AlcanceZonaRoja;
  valores: string[];
  horario: string | null;
  nota: string;
}

/** Las zonas rojas que aplican a una tienda (por tienda, zona o ciudad). */
export function zonasRojasDe(t: Pick<TiemposTienda, "tienda" | "zona" | "ciudad">, zonas: ZonaRoja[]) {
  return zonas.filter((z) =>
    z.alcance === "tienda"
      ? z.valores.includes(t.tienda)
      : z.alcance === "zona"
        ? z.valores.includes(t.zona)
        : !!t.ciudad && z.valores.includes(t.ciudad)
  );
}

/** Color por minutos hasta que el repartidor sale con la orden. */
export function colorMinutos(min: number | null | undefined) {
  if (min == null) return "#B9B8C8";
  if (min <= 25) return "#1F8A54";
  if (min <= 35) return "#E0B000";
  if (min <= 45) return "#F07C1B";
  return "#D63A3A";
}

/** Color por velocidad (km/h): lento = rojo (más tráfico). */
export function colorVelocidad(kmh: number | null | undefined) {
  if (kmh == null) return "#F2F2F7";
  if (kmh < 9) return "#D63A3A";
  if (kmh < 11) return "#F07C1B";
  if (kmh < 13) return "#F5C84C";
  if (kmh < 16) return "#B8DDA0";
  return "#63BE7B";
}

export const minutos = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${n.toFixed(d)} min`);
export const pctTxt = (x: number | null | undefined, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);

/** Mismos parámetros de URL que usa el panel principal. */
export function filtrosAQuery(f: DashboardFilters) {
  const p = new URLSearchParams();
  if (f.date_from) p.set("date_from", f.date_from);
  if (f.date_to) p.set("date_to", f.date_to);
  f.ciudad.forEach((v) => p.append("ciudad", v));
  f.restaurant.forEach((v) => p.append("restaurant", v));
  f.zona.forEach((v) => p.append("zona", v));
  f.estatus.forEach((v) => p.append("estatus", v));
  f.repartido_por.forEach((v) => p.append("repartido_por", v));
  if (f.orden_planeada) p.set("orden_planeada", f.orden_planeada);
  if (f.price_min != null) p.set("price_min", String(f.price_min));
  if (f.price_max != null) p.set("price_max", String(f.price_max));
  return p.toString();
}
