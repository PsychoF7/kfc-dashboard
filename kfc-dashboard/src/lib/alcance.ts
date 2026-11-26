// Región de cada usuario de KFC (consulta): un coordinador solo ve las tiendas que le tocan.
// El usuario principal de KFC no tiene región y ve todo el país. Todo esto se aplica en el
// servidor, antes de pedir los datos: no depende de lo que mande el navegador.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import type { Sesion } from "@/lib/sesion";

export interface Alcance {
  nombres: string[]; // nombres de tienda tal como vienen en la data (ej. "320 KFC ACAPULCO CUAUHTEMOC")
  codigos: string[]; // número de tienda (ej. "320")
  ciudades: string[];
  zonas: string[];
  fq: boolean; // región de franquicias: además ve cualquier tienda que termine en " FQ"
}

// Si algo falla o la región no tiene tiendas, no se muestra nada (nunca "todo").
export const NINGUNA = "__sin_tiendas__";

/** ¿Este usuario tiene una región asignada? */
export function esRegional(s: Sesion | null | undefined): s is Sesion & { alcance: string } {
  return !!s && s.rol === "consulta" && !!s.alcance;
}

const memo = new Map<string, { t: number; v: Alcance }>();
const VIGENCIA_MS = 60_000;

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

/** Tiendas, ciudades y zonas de la región del usuario. null = sin restricción. */
export async function alcanceDe(s: Sesion | null | undefined): Promise<Alcance | null> {
  if (!esRegional(s)) return null;
  const hit = memo.get(s.alcance);
  if (hit && Date.now() - hit.t < VIGENCIA_MS) return hit.v;
  const { data, error } = await withRetryResult(() => getSupabaseAdmin().rpc("alcance_catalogo", { p_alcance: s.alcance }));
  if (error) {
    console.error("Error al leer la región:", error);
    return { nombres: [], codigos: [], ciudades: [], zonas: [], fq: false };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  const v: Alcance = {
    nombres: lista(d.nombres),
    codigos: lista(d.codigos),
    ciudades: lista(d.ciudades),
    zonas: lista(d.zonas),
    fq: d.fq === true,
  };
  memo.set(s.alcance, { t: Date.now(), v });
  return v;
}

/** Lo que pidió el usuario, recortado a lo que le toca. Sin pedir nada = todo lo suyo. */
export function acotar(pedidas: string[] | null, permitidas: string[] | null): string[] | null {
  if (permitidas === null) return pedidas;
  const ok = new Set(permitidas);
  const base = pedidas && pedidas.length > 0 ? pedidas.filter((p) => ok.has(p)) : permitidas;
  return base.length > 0 ? base : [NINGUNA];
}

/** Número de tienda al inicio del nombre ("1152 MAYORAZGO KFC FQ" → "1152"). */
export function codigoDeNombre(nombre: string | null | undefined): string | null {
  return /^\s*(\d+)/.exec(nombre ?? "")?.[1] ?? null;
}

/** ¿Esta tienda (por número y/o nombre) es de la región? */
export function tiendaEnAlcance(a: Alcance | null, codigo: string | null | undefined, nombre?: string | null): boolean {
  if (!a) return true;
  const cod = (codigo && String(codigo).trim()) || codigoDeNombre(nombre);
  if (cod && a.codigos.includes(cod)) return true;
  if (a.fq && /\sFQ\s*$/i.test(nombre ?? "")) return true;
  return false;
}

const norm = (t: string) => t.trim().toUpperCase();

/** Avisos (zonas rojas, incidencias): los generales los ve todo el mundo; los demás, solo si tocan su región. */
export function avisoEnAlcance(a: Alcance | null, alcance: string | null | undefined, valores: string[] | null | undefined): boolean {
  if (!a) return true;
  const tipo = String(alcance ?? "general").toLowerCase();
  if (tipo === "general") return true;
  const vals = (valores ?? []).map(norm);
  const base = tipo === "ciudad" ? a.ciudades : tipo === "zona" ? a.zonas : a.nombres;
  const propios = new Set(base.map(norm));
  return vals.some((v) => propios.has(v));
}

/** Opciones de filtro (ciudades, tiendas, zonas…) recortadas a la región. */
export function opcionesEnAlcance<T extends Record<string, unknown>>(o: T, a: Alcance | null): T {
  if (!a || !o || typeof o !== "object") return o;
  const filtrar = (k: string, ok: string[]) => {
    const v = (o as Record<string, unknown>)[k];
    if (!Array.isArray(v)) return v;
    const set = new Set(ok);
    return v.filter((x) => set.has(String(x)));
  };
  return { ...o, ciudades: filtrar("ciudades", a.ciudades), restaurantes: filtrar("restaurantes", a.nombres), zonas: filtrar("zonas", a.zonas) };
}
