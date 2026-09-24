export interface FilterOptions {
  ciudades: string[] | null;
  restaurantes: string[] | null;
  zonas: string[] | null;
  estatus: string[] | null;
  repartidores: string[] | null;
}

export interface DashboardFilters {
  date_from: string; // yyyy-mm-dd
  date_to: string; // yyyy-mm-dd
  ciudad: string[];
  restaurant: string[];
  zona: string[];
  estatus: string[];
  repartido_por: string[];
  orden_planeada: string; // "" | "true" | "false"
  price_min: number | null;
  price_max: number | null;
}

export interface KpiSummary {
  total_ordenes: number;
  completadas: number;
  devueltas: number;
  canceladas: number;
  pct_completadas: number;
  pct_devueltas: number;
  pct_canceladas: number;
  tiendas_activas: number;
  ordenes_efectivo: number;
  ordenes_tarjeta: number;
  promedio_total: number;
  suma_total: number;
}

export const EMPTY_FILTERS: DashboardFilters = {
  date_from: "",
  date_to: "",
  ciudad: [],
  restaurant: [],
  zona: [],
  estatus: [],
  repartido_por: [],
  orden_planeada: "",
  price_min: null,
  price_max: null,
};
