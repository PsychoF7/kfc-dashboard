"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Rol } from "@/lib/permisos";

export interface DatosSesion {
  email: string;
  nombre: string;
  rol: Rol;
}

const Ctx = createContext<DatosSesion | null>(null);

export function SesionProvider({ sesion, children }: { sesion: DatosSesion | null; children: ReactNode }) {
  return <Ctx.Provider value={sesion}>{children}</Ctx.Provider>;
}

/** Datos de quien tiene la sesión abierta (null en la pantalla de entrada). */
export function useSesion(): DatosSesion | null {
  return useContext(Ctx);
}

/** Cierra solo lo que el rol no debe ver. Si no hay sesión, no muestra nada. */
export function useEsConsulta(): boolean {
  return useContext(Ctx)?.rol === "consulta";
}
