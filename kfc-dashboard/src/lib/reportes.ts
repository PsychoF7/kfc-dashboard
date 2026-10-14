// Tipos y textos compartidos de Bugs y Solicitudes de desarrollo.

export type TipoReporte = "bug" | "desarrollo";
export type EstatusReporte = "nuevo" | "en_proceso" | "en_espera" | "resuelto";
export type PrioridadReporte = "baja" | "media" | "alta";

export interface Reporte {
  id: number;
  tipo: TipoReporte;
  titulo: string;
  descripcion: string | null;
  pantalla: string | null;
  prioridad: PrioridadReporte;
  estatus: EstatusReporte;
  slack_url: string | null;
  jira: string | null;
  slack_respuestas: number | null;
  slack_ultima_respuesta: string | null;
  slack_ultimo_autor: string | null;
  slack_ultimo_texto: string | null;
  slack_resuelto: boolean | null;
  slack_visto_respuestas: number;
  slack_revisado_en: string | null;
  slack_error: string | null;
  reportado_por: string | null;
  created_at: string;
  updated_at: string;
  resuelto_en: string | null;
}

export interface Comentario {
  id: number;
  reporte_id: number;
  autor: string | null;
  texto: string;
  created_at: string;
}

export const ESTATUS: { id: EstatusReporte; label: string }[] = [
  { id: "nuevo", label: "Nuevo" },
  { id: "en_proceso", label: "En proceso" },
  { id: "en_espera", label: "En espera" },
  { id: "resuelto", label: "Resuelto" },
];

export const PRIORIDADES: { id: PrioridadReporte; label: string }[] = [
  { id: "alta", label: "Alta" },
  { id: "media", label: "Media" },
  { id: "baja", label: "Baja" },
];

export const PANTALLAS = [
  "Panel principal",
  "Cargar datos",
  "Desglose de pagos",
  "Facturación mensual",
  "Devoluciones y cancelaciones",
  "Análisis de tiempos",
  "Mi Flotilla",
  "Rappi",
  "General / otra",
];

export const COLUMNAS_REPORTE =
  "id, tipo, titulo, descripcion, pantalla, prioridad, estatus, slack_url, jira, slack_respuestas, slack_ultima_respuesta, slack_ultimo_autor, slack_ultimo_texto, slack_resuelto, slack_visto_respuestas, slack_revisado_en, slack_error, reportado_por, created_at, updated_at, resuelto_en";

export function esEstatus(v: unknown): v is EstatusReporte {
  return ESTATUS.some((e) => e.id === v);
}
export function esPrioridad(v: unknown): v is PrioridadReporte {
  return PRIORIDADES.some((p) => p.id === v);
}
export function esTipo(v: unknown): v is TipoReporte {
  return v === "bug" || v === "desarrollo";
}

// ¿Cómo se le da seguimiento? Con Jira, solo con el link de Slack, o sin ningún enlace.
export type Seguimiento = "jira" | "solo_link" | "ninguno";

export const SEGUIMIENTOS: { id: Seguimiento; label: string }[] = [
  { id: "jira", label: "Con Jira" },
  { id: "solo_link", label: "Solo link de Slack" },
  { id: "ninguno", label: "Sin enlace" },
];

export function seguimientoDe(r: Pick<Reporte, "jira" | "slack_url">): Seguimiento {
  if (r.jira && r.jira.trim()) return "jira";
  if (r.slack_url && r.slack_url.trim()) return "solo_link";
  return "ninguno";
}

/** Si lo guardado en "Jira" es un link, regresa el link; si es solo la clave (ej. KFC-123), null. */
export function urlJira(j: string | null | undefined): string | null {
  const t = (j ?? "").trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

/** Texto corto para mostrar: la clave del ticket (KFC-123) o "Jira". */
export function etiquetaJira(j: string | null | undefined): string {
  const t = (j ?? "").trim();
  if (!t) return "";
  const m = t.match(/[A-Z][A-Z0-9]+-\d+/);
  if (m) return m[0];
  return urlJira(t) ? "Jira" : t.slice(0, 24);
}
