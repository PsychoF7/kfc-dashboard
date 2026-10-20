// Lee el Excel de usuarios y contraseñas (hojas "Usuarios Delivery", "Usuarios
// Flotilla" y "Usuarios Franquicias") y devuelve las credenciales.
import { normalizeHeader } from "@/lib/parse/columns";
import { arreglarTexto, nombreLimpio, type ProductoCred } from "@/lib/credenciales";

export interface HojaCruda {
  nombre: string;
  filas: unknown[][];
}

export interface CredencialImportada {
  restaurant_id: string | null;
  sucursal: string;
  direccion: string | null;
  producto: ProductoCred;
  usuario: string;
  contrasena: string;
  codigo_flotilla: string | null;
}

const limpio = (v: unknown) => String(v ?? "").replace(/[​-‏‪-‮﻿]/g, "").replace(/\s+/g, " ").trim();

const productoDeHoja = (nombre: string): ProductoCred | null => {
  const n = normalizeHeader(nombre);
  if (!n.includes("usuarios")) return null;
  if (n.includes("flotilla")) return "Flotilla";
  if (n.includes("franquicia")) return "Franquicia";
  if (n.includes("delivery")) return "Delivery";
  return null;
};

export function credencialesDeLibro(hojas: HojaCruda[]): { credenciales: CredencialImportada[]; hojasUsadas: string[]; duplicadas: number } {
  const salida = new Map<string, CredencialImportada>();
  const usadas: string[] = [];
  let duplicadas = 0;

  for (const hoja of hojas) {
    const producto = productoDeHoja(hoja.nombre);
    if (!producto) continue;
    const iEnc = hoja.filas.findIndex((f) => {
      const n = f.map(normalizeHeader);
      return n.includes("usuario") && (n.includes("contrasena") || n.includes("contraseña"));
    });
    if (iEnc < 0) continue;
    const enc = hoja.filas[iEnc].map(normalizeHeader);
    const col = (...nombres: string[]) => enc.findIndex((h) => nombres.some((n) => h === n || h.startsWith(n)));
    const cId = col("restaurantid", "restaurant id", "id");
    const cSuc = col("sucursal", "nombre", "tienda");
    const cDir = col("direccion", "dirección");
    const cUsu = col("usuario");
    const cPas = col("contrasena", "contraseña");
    const cCod = col("codigo para unirse", "código para unirse", "codigo");
    if (cSuc < 0 || cUsu < 0 || cPas < 0) continue;
    usadas.push(hoja.nombre);

    for (const f of hoja.filas.slice(iEnc + 1)) {
      const sucursal = nombreLimpio(arreglarTexto(limpio(f[cSuc])));
      const usuario = limpio(f[cUsu]);
      const contrasena = limpio(f[cPas]);
      if (!sucursal || !usuario || !contrasena) continue;
      const id = cId >= 0 ? limpio(f[cId]) : "";
      let codigo = cCod >= 0 && producto === "Flotilla" ? limpio(f[cCod]).replace(/\.0+$/, "").toUpperCase() : "";
      // El código para unirse son los primeros 6 caracteres del ID del restaurante
      const derivado = id.replace(/-/g, "").slice(0, 6).toUpperCase();
      if (producto === "Flotilla" && derivado.length === 6 && (!codigo || codigo !== derivado)) codigo = derivado;
      const fila: CredencialImportada = {
        restaurant_id: id || null,
        sucursal,
        direccion: cDir >= 0 ? arreglarTexto(limpio(f[cDir])) || null : null,
        producto,
        usuario,
        contrasena,
        codigo_flotilla: codigo || null,
      };
      const k = producto + "|" + usuario.toLowerCase();
      if (salida.has(k)) duplicadas++;
      salida.set(k, fila);
    }
  }
  return { credenciales: Array.from(salida.values()), hojasUsadas: usadas, duplicadas };
}
