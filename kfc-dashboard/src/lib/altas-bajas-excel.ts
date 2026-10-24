// Lee la hoja de seguimiento de altas y bajas (Excel) y la convierte en movimientos.
import { normalizeHeader } from "@/lib/parse/columns";

export interface MovimientoImportado {
  tipo: "alta" | "cambio" | "baja";
  sucursal: string;
  producto: string;
  producto_anterior: string | null;
  fecha_solicitud: string | null;
  estado: "Pendiente" | "Completada";
  activa: "No iniciada" | "En operación";
  fecha_inicio: string | null;
  fecha_confirmacion: string | null;
  motivo: string | null;
  comentarios: string | null;
  notas: string | null;
  pasos: Record<string, boolean>;
}

export interface HojaCruda {
  nombre: string;
  filas: unknown[][];
}

const limpio = (v: unknown) => String(v ?? "").replace(/[​-‏‪-‮﻿]/g, "").replace(/\s+/g, " ").trim();

function aFecha(v: unknown): string | null {
  const s = limpio(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d+(\.\d+)?$/.test(s) && Number(s) > 20000) return new Date(Math.round((Number(s) - 25569) * 86400) * 1000).toISOString().slice(0, 10);
  return null;
}

const siNo = (v: unknown) => v === true || /^(true|si|sí|1|x|✓)$/i.test(limpio(v));

/** "371 KFC PLAZA CENTRAL MF (Urgente)" -> nombre sin MF/FQ ni paréntesis, y el paréntesis como nota. */
export function limpiarSucursal(crudo: string): { nombre: string; nota: string | null } {
  const s = limpio(crudo);
  const notas = Array.from(s.matchAll(/\(([^)]*)\)/g)).map((m) => m[1].trim()).filter(Boolean);
  const nombre = s.replace(/\s*\([^)]*\)/g, "").replace(/\s+(MF|FQ)$/i, "").trim();
  return { nombre, nota: notas.join("; ") || null };
}

const PRODUCTOS = ["Delivery", "Flotilla", "Franquicia"];
function productoNormal(v: string): string {
  const p = PRODUCTOS.find((x) => x.toLowerCase() === v.toLowerCase());
  return p ?? (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "Delivery");
}

const esCorreoEnviado = (t: string) => /^se env[ií]a el correo/i.test(t);

function leerHoja(filas: unknown[][]): MovimientoImportado[] {
  const llenas = filas.filter((f) => f.some((c) => c !== null && c !== undefined && limpio(c) !== ""));
  const iEnc = llenas.findIndex((f) => {
    const n = f.map(normalizeHeader);
    return n.includes("sucursal") && (n.includes("solicitud alta") || n.includes("solicitud baja"));
  });
  if (iEnc < 0) return [];
  const enc = llenas[iEnc].map(normalizeHeader);
  const col = (...nombres: string[]) => {
    for (const n of nombres) {
      const i = enc.indexOf(normalizeHeader(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const c = {
    solicitud: col("Solicitud alta", "Solicitud baja"),
    sucursal: col("Sucursal"),
    producto: col("Producto contratado", "Cambio producto contratado"),
    correo: col("Solicitud en correo", "Solicitud cambio en correo"),
    marca: col('Agregar a "Marca"'),
    envio: col("Configuración básica envio"),
    pos: col("Configuración POS (usuarios)"),
    usuarios: col("Agregar a usuario (kfcmaster y atcprbcommx)"),
    confirmacion: col("Confirmación alta y permisos"),
    estado: col("Estado"),
    activa: col("Activa"),
    inicio: col("Fecha inicio operación"),
    confKfc: col("Fecha de confimación a KFC", "Fecha de confirmación a KFC"),
    motivo: col("Motivo"),
    comentarios: col("Comentarios"),
    notas: col("Notas"),
  };
  const esBaja = enc.includes("solicitud baja");
  const get = (f: unknown[], i: number) => (i >= 0 ? f[i] : null);

  const salida: MovimientoImportado[] = [];
  for (const f of llenas.slice(iEnc + 1)) {
    const crudo = limpio(get(f, c.sucursal));
    if (!crudo) continue;
    const { nombre, nota } = limpiarSucursal(crudo);
    let producto = limpio(get(f, c.producto));
    let tipo: MovimientoImportado["tipo"] = esBaja ? "baja" : "alta";
    let anterior: string | null = null;
    const cambio = producto.match(/^(\S+)\s+a\s+(\S+)$/i);
    if (!esBaja && cambio) {
      tipo = "cambio";
      anterior = productoNormal(cambio[1]);
      producto = productoNormal(cambio[2]);
    } else producto = productoNormal(producto || "Delivery");

    let pasos: Record<string, boolean> = {
      correo: siNo(get(f, c.correo)),
      marca: siNo(get(f, c.marca)),
      envio: siNo(get(f, c.envio)),
      pos: siNo(get(f, c.pos)),
      usuarios: siNo(get(f, c.usuarios)),
      confirmacion: siNo(get(f, c.confirmacion)),
    };
    if (tipo === "cambio") pasos = { envio: pasos.envio, pos: pasos.pos, confirmacion: pasos.confirmacion };
    if (tipo === "baja") pasos = { correo: pasos.correo };

    let comentarios = limpio(get(f, c.comentarios)) || null;
    // Del correo solo se conserva el aviso de la alta; en los cambios no se manda correo.
    if (tipo === "cambio" && comentarios && esCorreoEnviado(comentarios)) comentarios = null;

    // En los cambios, la fecha de solicitud es la que dice el comentario ("…cambio … el 23/10/2026").
    let fechaSolicitud = aFecha(get(f, c.solicitud));
    const textoFechas = [comentarios, limpio(get(f, c.notas))].filter(Boolean).join(" ");
    if (tipo === "cambio" && textoFechas) {
      const fechas = [...textoFechas.matchAll(/\b([0-3]?\d)\/([01]?\d)\/(20\d\d)\b/g)];
      const ult = fechas[fechas.length - 1];
      if (ult) {
        const d = `${ult[3]}-${ult[2].padStart(2, "0")}-${ult[1].padStart(2, "0")}`;
        if (!Number.isNaN(Date.parse(d))) fechaSolicitud = d;
      }
    }

    const estadoTxt = limpio(get(f, c.estado));
    const activaTxt = limpio(get(f, c.activa));
    const internas = [nota, limpio(get(f, c.notas))].filter(Boolean);
    salida.push({
      tipo,
      sucursal: nombre,
      producto,
      producto_anterior: anterior,
      fecha_solicitud: fechaSolicitud,
      estado: /^completada$/i.test(estadoTxt) ? "Completada" : "Pendiente",
      activa: /^en operaci/i.test(activaTxt) ? "En operación" : "No iniciada",
      fecha_inicio: aFecha(get(f, c.inicio)),
      fecha_confirmacion: aFecha(get(f, c.confKfc)),
      motivo: tipo === "baja" ? limpio(get(f, c.motivo)) || null : null,
      comentarios,
      notas: internas.join("; ") || null,
      pasos,
    });
  }
  return salida;
}

/**
 * Si el libro tiene una hoja "General…" se usa esa (más las de "Bajas"), porque ya junta todo.
 * Si no, se leen todas las hojas que tengan el formato de seguimiento.
 */
export function movimientosDeLibro(hojas: HojaCruda[]): { movimientos: MovimientoImportado[]; hojasUsadas: string[] } {
  const general = hojas.filter((h) => /^general/i.test(h.nombre.trim()));
  const bajas = hojas.filter((h) => /^bajas/i.test(h.nombre.trim()));
  const elegidas = general.length > 0 ? [...general, ...bajas] : hojas;
  const movimientos: MovimientoImportado[] = [];
  const usadas: string[] = [];
  for (const h of elegidas) {
    const m = leerHoja(h.filas);
    if (m.length > 0) {
      movimientos.push(...m);
      usadas.push(h.nombre);
    }
  }
  return { movimientos, hojasUsadas: usadas };
}
