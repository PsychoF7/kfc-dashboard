// Altas, cambios de producto y bajas de sucursales.

export type TipoMov = "alta" | "cambio" | "baja";
export const TIPOS: { id: TipoMov; nombre: string }[] = [
  { id: "alta", nombre: "Alta" },
  { id: "cambio", nombre: "Cambio de producto" },
  { id: "baja", nombre: "Baja" },
];
export const PRODUCTOS = ["Delivery", "Flotilla", "Franquicia"] as const;
export const ESTADOS = ["Pendiente", "En proceso", "Completada"] as const;
export const ACTIVAS = ["No iniciada", "En operación"] as const;

/** Pasos internos de cada tipo de movimiento (solo los ve el equipo, no KFC). */
export const PASOS: Record<TipoMov, { id: string; nombre: string }[]> = {
  alta: [
    { id: "correo", nombre: "Solicitud en correo" },
    { id: "marca", nombre: 'Agregar a "Marca"' },
    { id: "envio", nombre: "Configuración básica de envío" },
    { id: "pos", nombre: "Configuración POS (usuarios)" },
    { id: "usuarios", nombre: "Agregar a usuarios (kfcmaster y atcprbcommx)" },
    { id: "confirmacion", nombre: "Confirmación de alta y permisos" },
  ],
  cambio: [
    { id: "correo", nombre: "Solicitud de cambio en correo" },
    { id: "envio", nombre: "Configuración básica de envío" },
    { id: "pos", nombre: "Configuración POS (usuarios)" },
    { id: "confirmacion", nombre: "Confirmación de cambio y permisos" },
  ],
  baja: [{ id: "correo", nombre: "Solicitud en correo" }],
};

/** Días mínimos entre un cambio de producto y el siguiente (para avisar). */
export const DIAS_ENTRE_CAMBIOS = 30;

export interface Movimiento {
  id: number;
  tipo: TipoMov;
  tienda_num: string | null;
  sucursal: string;
  producto: string;
  producto_anterior: string | null;
  fecha_solicitud: string | null;
  estado: (typeof ESTADOS)[number];
  activa: (typeof ACTIVAS)[number];
  fecha_inicio: string | null;
  fecha_confirmacion: string | null;
  motivo: string | null;
  comentarios: string | null;
  // Solo para admin y editor:
  pasos?: Record<string, boolean>;
  notas?: string | null;
  creado_por?: string | null;
  created_at?: string;
}

export const COLUMNAS_PUBLICAS =
  "id,tipo,tienda_num,sucursal,producto,producto_anterior,fecha_solicitud,estado,activa,fecha_inicio,fecha_confirmacion,motivo,comentarios";
export const COLUMNAS_COMPLETAS = COLUMNAS_PUBLICAS + ",pasos,notas,creado_por,created_at";

export const esTipo = (v: unknown): v is TipoMov => v === "alta" || v === "cambio" || v === "baja";
export const esEstado = (v: unknown): v is Movimiento["estado"] => (ESTADOS as readonly string[]).includes(v as string);
export const esActiva = (v: unknown): v is Movimiento["activa"] => (ACTIVAS as readonly string[]).includes(v as string);

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** "2026-09-10" -> "Septiembre 2026" */
export function mesDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

/** "2026-09" (para el filtro por mes) */
export const claveMes = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");

export function textoMovimiento(m: Pick<Movimiento, "tipo" | "producto" | "producto_anterior">): string {
  if (m.tipo === "cambio") return `${m.producto_anterior ?? "?"} → ${m.producto}`;
  if (m.tipo === "baja") return `Baja de ${m.producto}`;
  return `Alta de ${m.producto}`;
}

/** Número de tienda (lo que va antes del nombre) o el nombre en mayúsculas. */
export function claveTienda(m: Pick<Movimiento, "tienda_num" | "sucursal">): string {
  return m.tienda_num || m.sucursal.trim().toUpperCase();
}

export function diasDesde(iso: string | null | undefined, hoy = new Date()): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((a - Date.UTC(y, m - 1, d)) / 86400000);
}

export interface Sucursal {
  clave: string;
  nombre: string;
  actual: Movimiento; // último movimiento
  baja: boolean;
  producto: string;
  historial: Movimiento[]; // del más reciente al más antiguo
  cambios: number;
  ultimoCambio: Movimiento | null;
}

/** Orden cronológico: por fecha de solicitud y, si empatan, por orden de captura. */
function porFecha(a: Movimiento, b: Movimiento) {
  const fa = a.fecha_solicitud ?? "";
  const fb = b.fecha_solicitud ?? "";
  return fa === fb ? a.id - b.id : fa < fb ? -1 : 1;
}

/** Agrupa los movimientos por sucursal; la situación actual es la del último movimiento. */
export function agruparSucursales(movs: Movimiento[]): Sucursal[] {
  const mapa = new Map<string, Movimiento[]>();
  for (const m of movs) {
    const k = claveTienda(m);
    mapa.set(k, [...(mapa.get(k) ?? []), m]);
  }
  const lista: Sucursal[] = [];
  for (const [clave, ms] of Array.from(mapa.entries())) {
    const orden = [...ms].sort(porFecha);
    const actual = orden[orden.length - 1];
    const historial = [...orden].reverse();
    const cambiosLista = historial.filter((m) => m.tipo === "cambio");
    lista.push({
      clave,
      nombre: actual.sucursal,
      actual,
      baja: actual.tipo === "baja",
      producto: actual.producto,
      historial,
      cambios: cambiosLista.length,
      ultimoCambio: cambiosLista[0] ?? null,
    });
  }
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));
}
