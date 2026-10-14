import type { ColumnDef } from "@/lib/parse/columns";
import { mapRows } from "@/lib/parse/parseFile";

// Columnas del archivo general de reembolsos. Sirve tanto para tu hoja con
// encabezados (REPARTO, FECHA VENTA, ...) como para la hoja general (AGENTE,
// REPARTO, FECHA, ...). Se ignoran CLABE, correo, repartidor y comentarios.
export const REEMBOLSOS_COLUMNS: ColumnDef[] = [
  { key: "proveedor", aliases: ["REPARTO", "Proveedor"], type: "text" },
  { key: "fecha_venta", aliases: ["FECHA VENTA", "FECHA", "Fecha de venta"], type: "text" },
  { key: "restaurante", aliases: ["RESTAURANTE", "Restaurant"], type: "text" },
  { key: "monto", aliases: ["MONTO"], type: "number" },
  { key: "folio", aliases: ["FOLIO"], type: "text" },
  { key: "estatus", aliases: ["ESTATUS"], type: "text" },
  { key: "fecha_pago", aliases: ["Fecha de pago", "FECHA PAGO"], type: "text" },
  { key: "id_orden", aliases: ["ID orden largo", "ID de orden"], type: "text" },
  { key: "cant_ordenes", aliases: ["Cant Ordenes", "Cantidad de ordenes"], type: "number" },
  { key: "motivo", aliases: ["MOTIVO"], type: "text" },
  { key: "dictamen", aliases: ["DICTAMEN REEMBOLSO", "DICTAMEN"], type: "text" },
];

// Solo se guardan reembolsos desde esta fecha (2025 se registró con nombres de tienda inconsistentes).
export const FECHA_MINIMA = "2026-01-01";

export const REEMBOLSOS_REQUERIDAS = ["restaurante", "monto", "folio"] as const;

// Orden de columnas de la hoja general cuando viene SIN encabezados.
export const ENCABEZADOS_GENERAL = [
  "AGENTE", "REPARTO", "FECHA", "DIGITOS", "CLABE", "RESTAURANTE", "MONTO", "FOLIO", "CORREO", "ESTATUS",
  "Fecha de pago", "ID order corto", "ID orden largo", "ID reparto", "Cant Ordenes", "MOTIVO",
  "DICTAMEN REEMBOLSO", "Nombre del repartidor", "Comentarios Karina", "Comentarios SUPPORT",
];

/** Quita caracteres invisibles (los que dejan los copiar/pegar) y espacios de más. */
export function limpiar(v: unknown): string {
  return String(v ?? "")
    .replace(/[​-‏‪-‮⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_SERIAL = 20000; // 1954 en adelante: un número menor a esto no es fecha de Excel

/** Fecha de Excel / texto -> "YYYY-MM-DD" (o null). */
export function aFecha(v: unknown): string | null {
  const s = limpiar(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > MIN_SERIAL) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400) * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function capitalizar(s: string): string {
  const t = s.toLowerCase().replace(/\b(aaron|abel|uber|rappi)\b/g, (m) => m.charAt(0).toUpperCase() + m.slice(1));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function proveedorNormal(raw: string): string | null {
  const s = limpiar(raw).toUpperCase();
  if (!s) return null;
  if (/^UBER/.test(s)) return "Uber DaaS";
  if (s === "RAPPI") return "Rappi";
  return s.length <= 3 ? s : capitalizar(s);
}

function motivoNormal(raw: string): string | null {
  const s = limpiar(raw);
  if (!s) return null;
  if (/^orden cancelada y entregada/i.test(s)) return "Orden cancelada y entregada";
  return capitalizar(s);
}

function estatusNormal(raw: string): string | null {
  const s = limpiar(raw);
  if (!s || /^pendiente$/i.test(s)) return null;
  return capitalizar(s);
}

function tiendaClave(nombre: string): string {
  const m = nombre.match(/^(\d{2,5})\b/);
  return m ? m[1] : nombre.toUpperCase();
}

export interface FilaReembolso {
  clave: string;
  proveedor: string | null;
  fecha_venta: string | null;
  restaurante: string;
  tienda_clave: string;
  monto: number | null;
  folio: string | null;
  estatus: string | null;
  fecha_pago: string | null;
  id_orden: string | null;
  cant_ordenes: number | null;
  motivo: string | null;
  dictamen: string | null;
}

export interface ResultadoParseo {
  filas: FilaReembolso[];
  descartadas_no_kfc: number;
  omitidas: number;
}

/** Convierte las filas crudas del archivo en filas listas para guardar (solo KFC, sin repetidos). */
export function prepararReembolsos(headers: string[], rows: unknown[][]): ResultadoParseo {
  const mapeadas = mapRows(headers, rows, REEMBOLSOS_COLUMNS);
  const unicas = new Map<string, FilaReembolso>();
  let noKfc = 0;
  let omitidas = 0;

  for (const { values: v } of mapeadas) {
    const restaurante = limpiar(v.restaurante);
    if (!restaurante) {
      omitidas++;
      continue;
    }
    if (!/kfc/i.test(restaurante)) {
      noKfc++;
      continue;
    }
    const folio = limpiar(v.folio).replace(/[^0-9A-Za-z-]/g, "") || null;
    const idOrden = limpiar(v.id_orden).replace(/\s/g, "").toLowerCase() || null;
    const fecha = aFecha(v.fecha_venta);
    const monto = typeof v.monto === "number" ? v.monto : null;
    const tienda = tiendaClave(restaurante);
    // Sin número de tienda (ej. solo "KFC") o fuera del periodo: no se guarda
    if (!/^\d+$/.test(tienda) || !fecha || fecha < FECHA_MINIMA) {
      omitidas++;
      continue;
    }
    const clave = idOrden && idOrden.length >= 8 ? idOrden : folio ? `f:${folio}|${fecha ?? ""}|${monto ?? ""}|${tienda}` : "";
    if (!clave) {
      omitidas++;
      continue;
    }
    const cant = typeof v.cant_ordenes === "number" ? Math.round(v.cant_ordenes) : null;
    unicas.set(clave, {
      clave,
      proveedor: proveedorNormal(String(v.proveedor ?? "")),
      fecha_venta: fecha,
      restaurante,
      tienda_clave: tienda,
      monto,
      folio,
      estatus: estatusNormal(String(v.estatus ?? "")),
      fecha_pago: aFecha(v.fecha_pago),
      id_orden: idOrden,
      cant_ordenes: cant,
      motivo: motivoNormal(String(v.motivo ?? "")),
      dictamen: limpiar(v.dictamen) || null,
    });
  }
  return { filas: Array.from(unicas.values()), descartadas_no_kfc: noKfc, omitidas };
}
