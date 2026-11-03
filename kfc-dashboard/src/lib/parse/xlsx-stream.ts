// Lector de Excel (.xlsx) por partes, para archivos muy grandes (cientos de miles de filas).
// El lector normal carga toda la hoja de golpe y el navegador se rinde; este va
// descomprimiendo y leyendo fila por fila, y solo se queda con las filas que se piden.

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

interface EntradaZip {
  nombre: string;
  metodo: number;
  tamComprimido: number;
  inicioLocal: number;
}

async function leerBytes(blob: Blob, desde: number, hasta: number) {
  return new Uint8Array(await blob.slice(desde, hasta).arrayBuffer());
}

async function indiceZip(blob: Blob): Promise<Map<string, EntradaZip>> {
  const cola = Math.min(blob.size, 66000);
  const fin = await leerBytes(blob, blob.size - cola, blob.size);
  const dv = new DataView(fin.buffer);
  let eocd = -1;
  for (let i = cola - 22; i >= 0; i--) {
    if (u32(dv, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un Excel válido.");
  const total = u16(dv, eocd + 10);
  const tamDir = u32(dv, eocd + 12);
  const inicioDir = u32(dv, eocd + 16);
  const dir = await leerBytes(blob, inicioDir, inicioDir + tamDir);
  const d = new DataView(dir.buffer);
  const nombres = new TextDecoder();
  const mapa = new Map<string, EntradaZip>();
  let o = 0;
  for (let n = 0; n < total && o + 46 <= dir.length; n++) {
    if (u32(d, o) !== 0x02014b50) break;
    const metodo = u16(d, o + 10);
    const tamComprimido = u32(d, o + 20);
    const largoNombre = u16(d, o + 28);
    const largoExtra = u16(d, o + 30);
    const largoComentario = u16(d, o + 32);
    const inicioLocal = u32(d, o + 42);
    const nombre = nombres.decode(dir.subarray(o + 46, o + 46 + largoNombre));
    mapa.set(nombre, { nombre, metodo, tamComprimido, inicioLocal });
    o += 46 + largoNombre + largoExtra + largoComentario;
  }
  return mapa;
}

/** Flujo de texto (UTF-8) del contenido de un archivo dentro del .xlsx. */
async function flujoTexto(blob: Blob, e: EntradaZip): Promise<ReadableStream<string>> {
  const cab = new DataView((await leerBytes(blob, e.inicioLocal, e.inicioLocal + 30)).buffer);
  const inicio = e.inicioLocal + 30 + u16(cab, 26) + u16(cab, 28);
  let datos: ReadableStream<Uint8Array> = blob.slice(inicio, inicio + e.tamComprimido).stream() as ReadableStream<Uint8Array>;
  if (e.metodo === 8) {
    datos = datos.pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  } else if (e.metodo !== 0) throw new Error("Formato de compresión no compatible.");
  return datos.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>);
}

async function textoCompleto(blob: Blob, e: EntradaZip | undefined) {
  if (!e) return "";
  const lector = (await flujoTexto(blob, e)).getReader();
  let t = "";
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    t += value;
  }
  return t;
}

const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
function desescapar(s: string) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (m, _n, dec, hex) =>
    ENTIDADES[m] ?? String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16))
  );
}

function textosCompartidos(xml: string): string[] {
  const lista: string[] = [];
  const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    let t = "";
    const re2 = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(m[1] ?? ""))) t += m2[1] ?? "";
    lista.push(desescapar(t));
  }
  return lista;
}

/** Estilos que son fecha u hora (índice de estilo -> true). */
function estilosDeFecha(xml: string): Set<number> {
  const personalizados = new Map<number, string>();
  for (const m of Array.from(xml.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g))) {
    personalizados.set(Number(m[1]), desescapar(m[2]));
  }
  const esFecha = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58)) return true;
    const codigo = personalizados.get(id);
    if (!codigo) return false;
    return /[ymdhs]/i.test(codigo.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, ""));
  };
  const resultado = new Set<number>();
  const bloque = xml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] ?? "";
  let i = 0;
  for (const m of Array.from(bloque.matchAll(/<xf\b([^>]*?)\/?>/g))) {
    const id = /numFmtId="(\d+)"/.exec(m[1]);
    if (id && esFecha(Number(id[1]))) resultado.add(i);
    i++;
  }
  return resultado;
}

const dos = (n: number) => String(n).padStart(2, "0");
/** Número de serie de Excel -> "2026-09-21 18:19:20" (la misma hora que se ve en el archivo). */
function serialATexto(v: number) {
  const f = new Date(Math.round((v - 25569) * 86400) * 1000);
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())} ${dos(f.getUTCHours())}:${dos(f.getUTCMinutes())}:${dos(f.getUTCSeconds())}`;
}

function columnaDe(ref: string) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

export interface ResultadoLectura {
  encabezados: unknown[];
  filas: unknown[][];
  leidas: number;
}

/**
 * Lee la primera hoja fila por fila. `filtrar` recibe los encabezados y devuelve una función
 * que dice si una fila se conserva (así no se guarda todo el archivo en memoria).
 */
export async function leerExcelGrande(
  archivo: Blob,
  filtrar?: (encabezados: unknown[]) => ((fila: unknown[]) => boolean) | null,
  alAvanzar?: (filasLeidas: number) => void
): Promise<ResultadoLectura> {
  const indice = await indiceZip(archivo);

  // Primera hoja del libro
  const libro = await textoCompleto(archivo, indice.get("xl/workbook.xml"));
  const rels = await textoCompleto(archivo, indice.get("xl/_rels/workbook.xml.rels"));
  const idHoja = /<sheet\b[^>]*r:id="([^"]+)"/.exec(libro)?.[1];
  let ruta: string | undefined;
  if (idHoja) {
    for (const m of Array.from(rels.matchAll(/<Relationship\b[^>]*>/g))) {
      if (m[0].includes(`Id="${idHoja}"`)) {
        const destino = /Target="([^"]+)"/.exec(m[0])?.[1];
        if (destino) ruta = destino.startsWith("/") ? destino.slice(1) : `xl/${destino}`;
      }
    }
  }
  const entradaHoja = (ruta && indice.get(ruta)) || indice.get("xl/worksheets/sheet1.xml");
  if (!entradaHoja) throw new Error("No encontré la hoja del archivo.");

  const compartidos = textosCompartidos(await textoCompleto(archivo, indice.get("xl/sharedStrings.xml")));
  const fechas = estilosDeFecha(await textoCompleto(archivo, indice.get("xl/styles.xml")));

  const valorDe = (atributos: string, cuerpo: string): unknown => {
    const tipo = /\bt="(\w+)"/.exec(atributos)?.[1];
    if (tipo === "inlineStr") {
      let t = "";
      for (const m of Array.from(cuerpo.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g))) t += m[1] ?? "";
      return desescapar(t);
    }
    const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1];
    if (v === undefined) return null;
    if (tipo === "s") return compartidos[Number(v)] ?? null;
    if (tipo === "str" || tipo === "e") return desescapar(v);
    if (tipo === "b") return v === "1";
    const n = Number(v);
    if (Number.isNaN(n)) return desescapar(v);
    const estilo = /\bs="(\d+)"/.exec(atributos)?.[1];
    return estilo !== undefined && fechas.has(Number(estilo)) ? serialATexto(n) : n;
  };

  const filas: unknown[][] = [];
  let encabezados: unknown[] = [];
  let conservar: ((fila: unknown[]) => boolean) | null = null;
  let leidas = 0;
  const lector = (await flujoTexto(archivo, entradaHoja)).getReader();
  let resto = "";

  const procesarFila = (cuerpo: string) => {
    const fila: unknown[] = [];
    const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cuerpo))) {
      const ref = /\br="([A-Z]+)\d+"/.exec(m[1])?.[1];
      if (!ref) continue;
      const i = columnaDe(ref);
      const v = m[2] === undefined ? null : valorDe(m[1], m[2]);
      while (fila.length < i) fila.push(null);
      fila[i] = v;
    }
    if (!fila.some((c) => c !== null && c !== "")) return;
    leidas++;
    if (leidas === 1) {
      encabezados = fila;
      conservar = filtrar ? filtrar(fila) : null;
      return;
    }
    if (!conservar || conservar(fila)) filas.push(fila);
    if (leidas % 20000 === 0) alAvanzar?.(leidas);
  };

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += value;
    let pos = 0;
    for (;;) {
      const a = resto.indexOf("<row ", pos);
      if (a < 0) break;
      const finEtiqueta = resto.indexOf(">", a);
      if (finEtiqueta < 0) break;
      if (resto.charCodeAt(finEtiqueta - 1) === 47) {
        pos = finEtiqueta + 1; // fila vacía: <row ... />
        continue;
      }
      const b = resto.indexOf("</row>", finEtiqueta);
      if (b < 0) break;
      procesarFila(resto.slice(finEtiqueta + 1, b));
      pos = b + 6;
    }
    resto = pos > 0 ? resto.slice(pos) : resto;
    // Si no hay ninguna fila abierta, no se guarda lo que sobra
    if (resto.length > 0 && resto.indexOf("<row ") < 0) resto = resto.slice(-8);
  }
  alAvanzar?.(leidas);
  return { encabezados, filas, leidas };
}
