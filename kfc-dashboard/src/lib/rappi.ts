// Tipos de la sección Rappi (reporte de Rappi KFC, meta mensual y Rappi Turbo).

export interface RappiPanorama {
  sin_datos?: boolean;
  periodo: { desde: string; hasta: string };
  tiendas_opciones: string[];
  kpis: {
    envios: number;
    ordenes: number;
    entregadas: number;
    devueltas: number;
    canceladas: number;
    reintentos: number;
    pct_entregadas: number | null;
    pct_devueltas: number | null;
    pct_canceladas: number | null;
    min_asignar: number | null;
    min_a_tienda: number | null;
    espera: number | null;
    min_a_cliente: number | null;
    tiempo_a_cliente: number | null;
    pct_45: number | null;
    valor_entregado: number;
  };
  general_vs_exclusivo: { exclusivo: number; general: number };
  tiendas_general: { tienda: string; general: number; exclusivo: number; total: number }[];
  por_dia: { dia: string; envios: number; entregadas: number; canceladas: number; devueltas: number; tiempo_a_cliente: number | null }[];
  por_hora: { hora: number; envios: number; pct_canceladas: number; min_asignar: number | null }[];
  cancelaciones: { etapa: string; motivo: string; envios: number }[];
  vehiculos: { vehiculo: string; envios: number; pct_entregadas: number; tiempo_a_cliente: number | null }[];
  tiendas: {
    tienda: string;
    envios: number;
    entregadas: number;
    canceladas: number;
    devueltas: number;
    pct_canceladas: number;
    sin_repartidor: number;
    min_asignar: number | null;
    espera: number | null;
    tiempo_a_cliente: number | null;
    turbo: boolean;
  }[];
}

export interface RappiMeta {
  mes: string;
  meta: number | null;
  entregadas: number;
  ultimo_dia: string | null;
  por_dia: { dia: string; entregadas: number }[];
}

export interface TurboResumen {
  turbo: boolean;
  post: boolean;
  n: number;
  completas: number;
  devueltas: number;
  canceladas: number;
  en_regreso: number;
  rechazadas: number;
  t_rest: number | null;
  t_rep: number | null;
  t_llegar: number | null;
  t_recoger: number | null;
  t_entregar: number | null;
  t_completar: number | null;
  ciclo: number | null;
  c_rest: number | null;
  c_rep: number | null;
  c_llegar: number | null;
  c_recoger: number | null;
  c_entregar: number | null;
  c_completar: number | null;
  c_ciclo: number | null;
  lt45: number;
  lt60: number;
  gt60: number;
  sc45: number;
  sc60: number;
  scgt60: number;
}

export interface TurboTienda {
  picking_point_id: number;
  store_id: string | null;
  nombre: string;
  restaurant_id: string | null;
  fecha_activacion: string;
  activa: boolean;
  ordenes: number;
  ultimo_nombre: string | null;
}

/** Fila de la hoja Datos: [orderId, tienda, creada, estatus, t_rest, t_rep, t_llegar,
 * t_recoger, t_entregar, t_completar, total, sin_cooking, aceptada, completada, activación] */
export type TurboDato = [
  string, string, string, string,
  number | null, number | null, number | null, number | null, number | null, number | null,
  number | null, number | null, string | null, string | null, string | null,
];

export interface RappiTurbo {
  sin_tiendas?: boolean;
  periodo: { desde: string; hasta: string };
  activacion: string;
  tiendas: TurboTienda[];
  resumen: TurboResumen[];
  semanas: {
    semana: string;
    n: number;
    completas: number;
    devueltas: number;
    canceladas: number;
    t_rep: number | null;
    t_llegar: number | null;
    t_recoger: number | null;
    t_entregar: number | null;
    ciclo: number | null;
    gt60: number;
  }[];
  datos: TurboDato[];
}

export const ETAPAS_CANCELACION: Record<string, string> = {
  RT_UNASSIGNED: "Sin repartidor asignado",
  RT_TO_STORE: "Repartidor en camino a tienda",
  RT_IN_STORE: "Repartidor en tienda",
  RT_TO_USER: "Repartidor en camino al cliente",
  RT_AT_USER: "Repartidor con el cliente",
};

export const MOTIVOS_CANCELACION: Record<string, string> = {
  EARLY_CANCELATION: "Cancelación temprana",
  ALLY_AT_STORE: "Aliado (tienda) — en tienda",
  ALLY_TO_STORE: "Aliado (tienda) — camino a tienda",
  ALLY_AT_USER: "Aliado (tienda) — con el cliente",
  ALLY_TO_USER: "Aliado (tienda) — camino al cliente",
  LACK_OF_RT: "Falta de repartidores",
  RAPPI_TO_STORE: "Rappi — camino a tienda",
  RAPPI_AT_STORE: "Rappi — en tienda",
};
