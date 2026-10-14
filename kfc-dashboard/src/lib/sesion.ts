// Sesión propia, firmada con HMAC-SHA256. Funciona en el middleware (edge),
// en el servidor y en las rutas de la API, sin librerías extra.
//
// La cookie guarda quién eres y tu rol, firmado con una llave secreta que solo
// existe en Vercel. Si alguien la modifica, la firma deja de coincidir y se
// rechaza. La contraseña NUNCA se guarda aquí: la valida Supabase al entrar.
import type { Rol } from "@/lib/permisos";
import { esRol } from "@/lib/permisos";

export const COOKIE = "kfc-sesion";
export const DURACION_SEG = 12 * 60 * 60; // 12 horas

export interface Sesion {
  uid: string;
  email: string;
  nombre: string;
  rol: Rol;
  exp: number; // segundos desde 1970
}

const enc = new TextEncoder();

function secreto(): string {
  const s = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para firmar las sesiones.");
  return "kfc-sesion:" + s;
}

function aB64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64url(txt: string): Uint8Array<ArrayBuffer> {
  const b = txt.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((txt.length + 3) % 4);
  const bin = atob(b);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function llave(usos: KeyUsage[]) {
  return crypto.subtle.importKey("raw", enc.encode(secreto()), { name: "HMAC", hash: "SHA-256" }, false, usos);
}

export async function firmarSesion(datos: Omit<Sesion, "exp">): Promise<string> {
  const payload: Sesion = { ...datos, exp: Math.floor(Date.now() / 1000) + DURACION_SEG };
  const cuerpo = aB64url(enc.encode(JSON.stringify(payload)));
  const firma = await crypto.subtle.sign("HMAC", await llave(["sign"]), enc.encode(cuerpo));
  return `${cuerpo}.${aB64url(new Uint8Array(firma))}`;
}

/** Devuelve la sesión si la cookie es auténtica y no ha vencido; si no, null. */
export async function leerSesion(valor: string | undefined | null): Promise<Sesion | null> {
  if (!valor) return null;
  const partes = valor.split(".");
  if (partes.length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await llave(["verify"]), deB64url(partes[1]), enc.encode(partes[0]));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(deB64url(partes[0]))) as Sesion;
    if (!s || typeof s.exp !== "number" || s.exp < Date.now() / 1000) return null;
    if (!esRol(s.rol) || !s.uid || !s.email) return null;
    return s;
  } catch {
    return null;
  }
}
