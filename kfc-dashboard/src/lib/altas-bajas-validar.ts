import { ACTIVAS, ESTADOS, esActiva, esEstado, esTipo, PASOS } from "@/lib/altas-bajas";

const texto = (v: unknown, max: number): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, max) : null;
};
const fecha = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Convierte lo que manda el formulario en columnas válidas. `parcial` = solo lo que venga (edición). */
export function limpiarMovimiento(b: Record<string, unknown>, parcial: boolean): { fila?: Record<string, unknown>; error?: string } {
  const f: Record<string, unknown> = {};
  const hay = (k: string) => !parcial || k in b;

  if (hay("tipo")) {
    if (!esTipo(b.tipo)) return { error: "Elige si es alta, cambio de producto o baja." };
    f.tipo = b.tipo;
  }
  if (hay("sucursal")) {
    const s = texto(b.sucursal, 200);
    if (!s) return { error: "Escribe la sucursal." };
    f.sucursal = s;
    f.tienda_num = (s.match(/^\s*(\d{1,6})\b/) ?? [])[1] ?? null;
  }
  if (hay("producto")) {
    const p = texto(b.producto, 40);
    if (!p) return { error: "Elige el producto." };
    f.producto = p;
  }
  if (hay("producto_anterior")) f.producto_anterior = texto(b.producto_anterior, 40);
  if (hay("fecha_solicitud")) f.fecha_solicitud = fecha(b.fecha_solicitud);
  if (hay("estado") && !(b.estado === undefined && !parcial)) {
    if (!esEstado(b.estado)) return { error: `Estado inválido (${ESTADOS.join(", ")}).` };
    f.estado = b.estado;
  }
  if (hay("activa") && !(b.activa === undefined && !parcial)) {
    if (!esActiva(b.activa)) return { error: `Activa inválida (${ACTIVAS.join(", ")}).` };
    f.activa = b.activa;
  }
  if (hay("fecha_inicio")) f.fecha_inicio = fecha(b.fecha_inicio);
  if (hay("fecha_confirmacion")) f.fecha_confirmacion = fecha(b.fecha_confirmacion);
  if (hay("motivo")) f.motivo = texto(b.motivo, 300);
  if (hay("comentarios")) f.comentarios = texto(b.comentarios, 2000);
  if (hay("notas")) f.notas = texto(b.notas, 2000);
  if (hay("pasos")) {
    const ids = new Set(Object.values(PASOS).flat().map((p) => p.id));
    const pasos: Record<string, boolean> = {};
    const crudo = b.pasos && typeof b.pasos === "object" ? (b.pasos as Record<string, unknown>) : {};
    for (const k of Object.keys(crudo)) if (ids.has(k)) pasos[k] = crudo[k] === true;
    f.pasos = pasos;
  }

  const tipo = f.tipo ?? b.tipo;
  if (tipo === "cambio" && hay("producto_anterior") && !f.producto_anterior) {
    return { error: "En un cambio de producto indica el producto anterior." };
  }
  if (tipo !== "cambio" && !parcial) f.producto_anterior = null;
  return { fila: f };
}
