import JSZip from "jszip";
import { FilaFranquicia, nombreArchivoFranquicia } from "@/lib/facturacion";
import { obtenerFranquicias } from "@/lib/facturacion-server";
import { construirExcelFranquicias } from "@/lib/facturacion-franquicias-excel";

export interface FacturaFranquicia {
  nombre: string; // nombre del archivo
  buffer: Buffer;
  razonSocial: string | null;
  correo: string | null;
  tiendas: FilaFranquicia[];
}

async function excelDe(tiendas: FilaFranquicia[], mes: string, esTienda: boolean): Promise<FacturaFranquicia> {
  const razones = new Set(tiendas.map((x) => x.razonSocial));
  const una = tiendas[0];
  const unica = razones.size === 1;
  return {
    nombre: nombreArchivoFranquicia(esTienda ? una.tienda : una.razonSocial, mes, esTienda),
    buffer: await construirExcelFranquicias(tiendas, {
      mesPago: mes,
      razonSocial: unica ? una.razonSocial : null,
      rfc: unica ? una.rfc : null,
      iva: 0.16,
    }),
    razonSocial: unica ? una.razonSocial : null,
    correo: unica ? una.correo : null,
    tiendas,
  };
}

/** Una factura: de una tienda (codigo) o de una razón social completa (razon). */
export async function facturaFranquicia(mes: string, sel: { codigo?: string | null; razon?: string | null }) {
  const { filas } = await obtenerFranquicias(mes);
  const elegidas = sel.codigo ? filas.filter((x) => x.codigo === sel.codigo) : filas.filter((x) => x.razonSocial === sel.razon);
  if (!elegidas.length) return null;
  return excelDe(elegidas, mes, !!sel.codigo);
}

/** Todas las facturas del mes: una por razón social o una por tienda. */
export async function todasLasFacturas(mes: string, por: "razon" | "tienda") {
  const { filas } = await obtenerFranquicias(mes);
  const grupos = new Map<string, FilaFranquicia[]>();
  for (const f of filas) {
    const k = por === "tienda" ? f.codigo : f.razonSocial;
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  const lista: FacturaFranquicia[] = [];
  for (const g of Array.from(grupos.values())) lista.push(await excelDe(g, mes, por === "tienda"));
  return lista;
}

export async function comprimir(facturas: FacturaFranquicia[]): Promise<Buffer> {
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const f of facturas) {
    let nombre = f.nombre;
    for (let i = 2; usados.has(nombre); i++) nombre = f.nombre.replace(/\.xlsx$/, ` ${i}.xlsx`);
    usados.add(nombre);
    zip.file(nombre, f.buffer);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Content-Disposition con acentos y espacios bien codificados. */
export function adjunto(nombre: string) {
  const ascii = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}
