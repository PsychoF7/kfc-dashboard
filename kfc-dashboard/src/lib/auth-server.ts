import { cookies } from "next/headers";
import { COOKIE, leerSesion, type Sesion } from "@/lib/sesion";

/** Sesión de quien hace la petición (solo en servidor: layout, rutas de la API). */
export async function sesionActual(): Promise<Sesion | null> {
  try {
    return await leerSesion(cookies().get(COOKIE)?.value);
  } catch {
    return null;
  }
}
