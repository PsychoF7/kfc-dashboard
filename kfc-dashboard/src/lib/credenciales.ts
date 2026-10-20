// Credenciales de las tiendas: tipos, limpieza y cómo se agrupan por tienda
// según el producto que tiene HOY cada una (Altas y bajas).
import { agruparSucursales, type Movimiento } from "@/lib/altas-bajas";

export const PRODUCTOS_CRED = ["Delivery", "Flotilla", "Franquicia"] as const;
export type ProductoCred = (typeof PRODUCTOS_CRED)[number];

export interface Credencial {
  id: number;
  restaurant_id: string | null;
  tienda_num: string | null;
  sucursal: string;
  direccion: string | null;
  producto: ProductoCred;
  usuario: string;
  contrasena: string;
  codigo_flotilla: string | null;
  updated_at?: string;
}

export const COLUMNAS_CRED = "id,restaurant_id,tienda_num,sucursal,direccion,producto,usuario,contrasena,codigo_flotilla,updated_at";

export type EstadoCred = "vigente" | "anterior" | "baja";

export interface CredencialVista extends Credencial {
  estado: EstadoCred;
  /** Producto con el que opera hoy la tienda (si es distinto al de esta credencial). */
  ahora: string | null;
  /** Fecha de solicitud del movimiento que la dejó sin vigencia. */
  desde: string | null;
}

export interface GrupoTienda {
  clave: string;
  tienda_num: string | null;
  sucursal: string;
  /** Producto actual según Altas y bajas (null si la tienda no está registrada ahí). */
  producto: string | null;
  baja: boolean;
  credenciales: CredencialVista[];
  /** El producto actual no tiene usuario cargado. */
  sinUsuarioActual: boolean;
}

export const quitarAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normalizar = (s: unknown) => quitarAcentos(String(s ?? "")).toLowerCase().replace(/\s+/g, " ").trim();

/** "227 KFC PASEO ARCOS BOSQUES MF" -> sin el MF/FQ del final. */
export const nombreLimpio = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\s+(MF|FQ)$/i, "").trim();

export const tiendaNum = (s: string): string | null => (s.match(/^\s*(\d{1,6})\b/) ?? [])[1] ?? null;

/** Arregla textos como "JuÃ¡rez" (UTF-8 leído como Latin-1) y deja "Juárez". */
export function arreglarTexto(s: string): string {
  const t = s.replace(/_x0081_/g, "\u0081").replace(/_x008D_/g, "\u008D").replace(/_x008F_/g, "\u008F").replace(/_x0090_/g, "\u0090").replace(/_x009D_/g, "\u009D");
  if (!/[ÃÂ]/.test(t)) return t;
  try {
    const bytes = Uint8Array.from(Array.from(t).map((c) => c.charCodeAt(0)));
    if (Array.from(t).some((c) => c.charCodeAt(0) > 255)) return t;
    const x = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return x;
  } catch {
    return t;
  }
}

const texto = (v: unknown, max: number) => {
  const s = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  return s.slice(0, max);
};

/** Valida y limpia una credencial que viene del formulario o del Excel. */
export function limpiarCredencial(b: Record<string, unknown>, parcial: boolean): { fila?: Record<string, unknown>; error?: string } {
  const fila: Record<string, unknown> = {};
  const hay = (k: string) => b[k] !== undefined;

  if (!parcial || hay("sucursal")) {
    const s = nombreLimpio(texto(b.sucursal, 200));
    if (!s) return { error: "Falta la sucursal." };
    fila.sucursal = s;
    fila.tienda_num = tiendaNum(s);
  }
  if (!parcial || hay("producto")) {
    const p = PRODUCTOS_CRED.find((x) => x === b.producto);
    if (!p) return { error: "Producto inválido." };
    fila.producto = p;
  }
  if (!parcial || hay("usuario")) {
    const u = texto(b.usuario, 120);
    if (!u) return { error: "Falta el usuario." };
    fila.usuario = u;
  }
  if (!parcial || hay("contrasena")) {
    const c = texto(b.contrasena, 120);
    if (!c) return { error: "Falta la contraseña." };
    fila.contrasena = c;
  }
  if (!parcial || hay("restaurant_id")) fila.restaurant_id = texto(b.restaurant_id, 80) || null;
  if (!parcial || hay("direccion")) fila.direccion = texto(b.direccion, 300) || null;
  if (!parcial || hay("codigo_flotilla")) {
    const c = texto(b.codigo_flotilla, 20).toUpperCase();
    fila.codigo_flotilla = c || null;
  }
  return { fila };
}

/**
 * Junta las credenciales por tienda y marca cuáles siguen vigentes:
 * si Altas y bajas dice que hoy la tienda es Delivery, el código para unirse a
 * la flotilla queda como "anterior"; y al revés. Si no está en Altas y bajas,
 * todo se considera vigente.
 */
export function agruparCredenciales(creds: Credencial[], movs: Movimiento[]): GrupoTienda[] {
  const sucursales = new Map(agruparSucursales(movs).map((s) => [s.clave, s]));
  const grupos = new Map<string, GrupoTienda>();

  for (const c of creds) {
    const clave = normalizar(nombreLimpio(c.sucursal)) || String(c.id);
    const s = c.tienda_num ? sucursales.get(c.tienda_num) : undefined;
    let g = grupos.get(clave);
    if (!g) {
      g = {
        clave,
        tienda_num: c.tienda_num,
        sucursal: nombreLimpio(c.sucursal),
        producto: s && !s.baja ? s.producto : null,
        baja: !!s?.baja,
        credenciales: [],
        sinUsuarioActual: false,
      };
      grupos.set(clave, g);
    }
    let estado: EstadoCred = "vigente";
    let ahora: string | null = null;
    let desde: string | null = null;
    if (s) {
      if (s.baja) {
        estado = "baja";
        desde = s.actual.fecha_solicitud;
      } else if (s.producto !== c.producto) {
        estado = "anterior";
        ahora = s.producto;
        desde = s.actual.fecha_solicitud;
      }
    }
    g.credenciales.push({ ...c, estado, ahora, desde });
  }

  const orden: Record<EstadoCred, number> = { vigente: 0, anterior: 1, baja: 2 };
  const lista = Array.from(grupos.values());
  for (const g of lista) {
    g.credenciales.sort((a, b) => orden[a.estado] - orden[b.estado] || a.producto.localeCompare(b.producto));
    g.sinUsuarioActual = !!g.producto && !g.credenciales.some((c) => c.producto === g.producto);
  }
  return lista.sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es", { numeric: true }));
}

/**
 * ¿La tienda coincide con lo que escribió quien busca? Todas las palabras deben
 * aparecer. Un número corto (hasta 4 cifras) solo se compara con el número de
 * la tienda, para que "260" no traiga tiendas cuyo ID o usuario lo contienen
 * por casualidad; el ID solo cuenta si se escribe un fragmento largo.
 */
export function coincide(g: GrupoTienda, q: string): boolean {
  const palabras = normalizar(q).split(" ").filter(Boolean);
  if (palabras.length === 0) return true;
  const nombre = normalizar(g.sucursal);
  const usuarios = normalizar(g.credenciales.map((c) => c.usuario).join(" "));
  const ids = normalizar(g.credenciales.map((c) => c.restaurant_id ?? "").join(" "));
  return palabras.every((p) => {
    if (/^\d{1,4}$/.test(p)) return (g.tienda_num ?? "").startsWith(p) || nombre.split(" ").some((w) => w === p);
    return nombre.includes(p) || usuarios.includes(p) || (p.length >= 6 && ids.includes(p));
  });
}
