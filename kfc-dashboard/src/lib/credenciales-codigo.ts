// Códigos de un solo uso para ver los usuarios master (solo servidor).
import { createHash, randomInt } from "crypto";

// Sin 0/O, 1/I/L para que no se confundan al dictarlos
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código nuevo con forma K7M2-9QXA (se muestra una sola vez). */
export function nuevoCodigo(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s.slice(0, 4) + "-" + s.slice(4);
}

/** Deja el código en su forma canónica (sin guiones ni espacios, en mayúsculas). */
export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function huellaCodigo(codigo: string): string {
  const pimienta = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createHash("sha256").update(`credenciales:${pimienta}:${normalizarCodigo(codigo)}`).digest("hex");
}

export const VIGENCIAS_HORAS = [1, 24, 168];
