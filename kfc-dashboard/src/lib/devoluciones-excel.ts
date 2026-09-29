import ExcelJS from "exceljs";
import {
  DevOpciones,
  DevReporte,
  DevSemanaTendencia,
  TipoDuplicado,
  DevGrupo,
  criterioTexto,
  esAlerta,
  mapsUrl,
  nombreMes,
  notaDuplicado,
  puntosResumen,
  rangoCorto,
  rangoTitulo,
  sumarDias,
  titularResumen,
} from "./devoluciones";

// Colores de tu reporte actual
const C = {
  oscuro: "FF212135",
  morado: "FF891DFF",
  gris: "FFE9EAF2",
  blanco: "FFFFFFFF",
  rojo: "FFC0392B",
  verde: "FF1E8449",
  texto: "FF212135",
  sutil: "FF6B6B7B",
};

const FONT = "Arial";
const thin = { style: "thin" as const, color: { argb: "FFCFCEDD" } };
const BORDE = { top: thin, left: thin, bottom: thin, right: thin };

type WS = ExcelJS.Worksheet;
type Valor = ExcelJS.CellValue;

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function colLetra(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function prepararHoja(wb: ExcelJS.Workbook, nombre: string, anchos: Record<string, number>) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ showGridLines: false }],
    // Para imprimir/PDF: horizontal y a lo ancho de una página
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn("A").width = 3;
  for (const [col, w] of Object.entries(anchos)) ws.getColumn(col).width = w;
  return ws;
}

/** Barra de título (fondo oscuro o de color, texto blanco en negritas). */
function barra(ws: WS, fila: number, texto: string, hasta: string, opts: { color?: string; size?: number; alto?: number } = {}) {
  ws.mergeCells(`B${fila}:${hasta}${fila}`);
  const c = ws.getCell(`B${fila}`);
  c.value = texto;
  c.font = { name: FONT, size: opts.size ?? 13, bold: true, color: { argb: C.blanco } };
  c.fill = fill(opts.color ?? C.oscuro);
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(fila).height = opts.alto ?? 24;
}

function nota(ws: WS, fila: number, texto: string, hasta: string, alto = 19.5) {
  ws.mergeCells(`B${fila}:${hasta}${fila}`);
  const c = ws.getCell(`B${fila}`);
  c.value = texto;
  c.font = { name: FONT, size: 9, color: { argb: C.sutil } };
  c.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(fila).height = alto;
}

/** Fila de encabezados morados. `columnas` = [letra inicial, texto, letra final opcional para combinar] */
function encabezados(ws: WS, fila: number, columnas: [string, string, string?][], alto = 38.25) {
  for (const [col, texto, hasta] of columnas) {
    if (hasta) ws.mergeCells(`${col}${fila}:${hasta}${fila}`);
    const c = ws.getCell(`${col}${fila}`);
    c.value = texto;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.blanco } };
    c.fill = fill(C.morado);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDE;
  }
  ws.getRow(fila).height = alto;
}

type Formato = "texto" | "entero" | "pct" | "dec1" | "coord" | "dinero" | "link" | "alerta" | "wrap";

interface Celda {
  col: string;
  hasta?: string;
  v: Valor;
  f?: Formato;
}

/** Escribe una fila de datos con zebra gris/blanco, bordes y formato numérico. */
function filaDatos(ws: WS, fila: number, celdas: Celda[], i: number, alto?: number) {
  const fondo = i % 2 === 0 ? C.gris : C.blanco;
  for (const cel of celdas) {
    if (cel.hasta) ws.mergeCells(`${cel.col}${fila}:${cel.hasta}${fila}`);
    const c = ws.getCell(`${cel.col}${fila}`);
    c.value = cel.v ?? null;
    c.fill = fill(fondo);
    c.border = BORDE;
    c.font = { name: FONT, size: 10, color: { argb: C.texto } };
    c.alignment = { vertical: "middle" };
    switch (cel.f) {
      case "entero":
        c.numFmt = "#,##0";
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "pct":
        c.numFmt = "0.00%";
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "dec1":
        c.numFmt = "0.0";
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "coord":
        c.numFmt = "0.0000";
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "dinero":
        c.numFmt = "$#,##0";
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "link":
        c.font = { name: FONT, size: 10, color: { argb: C.morado }, underline: true };
        c.alignment = { horizontal: "center", vertical: "middle" };
        break;
      case "alerta":
        c.font = { name: FONT, size: 10, bold: true, color: { argb: C.rojo } };
        c.alignment = { vertical: "middle", wrapText: true };
        break;
      case "wrap":
        c.alignment = { vertical: "middle", wrapText: true };
        break;
      default:
        break;
    }
    // Replicar el borde en todas las celdas combinadas
    if (cel.hasta) {
      const desde = ws.getColumn(cel.col).number;
      const hastaN = ws.getColumn(cel.hasta).number;
      for (let n = desde + 1; n <= hastaN; n++) {
        const o = ws.getCell(`${colLetra(n)}${fila}`);
        o.border = BORDE;
        o.fill = fill(fondo);
      }
    }
  }
  if (alto) ws.getRow(fila).height = alto;
}

const formula = (f: string, result: number | null): Valor =>
  ({ formula: f, result: result ?? undefined }) as ExcelJS.CellFormulaValue;
const div = (a: number, b: number) => (b ? a / b : 0);
const link = (lat: number | null, lon: number | null): Valor => {
  const url = mapsUrl(lat, lon);
  return url ? ({ text: "Abrir en Maps", hyperlink: url } as ExcelJS.CellHyperlinkValue) : "";
};

/** Escala de color verde (bajo) → rojo (alto), igual a la de tu reporte. */
function escala(ws: WS, rango: string) {
  ws.addConditionalFormatting({
    ref: rango,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: [{ argb: "FF63BE7B" }, { argb: "FFFFEB84" }, { argb: "FFF8696B" }],
      },
    ],
  });
}

function sinDatos(ws: WS, fila: number, hasta: string, texto: string) {
  ws.mergeCells(`B${fila}:${hasta}${fila}`);
  const c = ws.getCell(`B${fila}`);
  c.value = texto;
  c.font = { name: FONT, size: 10, italic: true, color: { argb: C.sutil } };
}

// =====================================================================
// Hojas
// =====================================================================

function hojaResumen(wb: ExcelJS.Workbook, rep: DevReporte, tend: DevSemanaTendencia[], op: DevOpciones) {
  const ws = prepararHoja(wb, "Resumen", { B: 17, C: 13, D: 13, E: 13, F: 13, G: 13, H: 13, I: 13, J: 13, K: 13, L: 3 });
  const r = rep.resumen;

  ws.mergeCells("B2:K3");
  const t = ws.getCell("B2");
  t.value = `REPORTE SEMANAL — ${rangoTitulo(rep.semana.inicio, rep.semana.fin)}`;
  t.font = { name: FONT, size: 17, bold: true, color: { argb: C.blanco } };
  t.fill = fill(C.oscuro);
  t.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(2).height = 21.75;
  ws.getRow(3).height = 21.75;

  const prevInicio = sumarDias(rep.semana.inicio, -7);
  const prevFin = sumarDias(rep.semana.inicio, -1);
  const cajas: [string, string, string, Valor, string][] = [
    ["B", "C", `Ordenes devueltas\n(${rangoCorto(rep.semana.inicio, rep.semana.fin)})`, r.devueltas, "#,##0"],
    ["D", "E", "% Devolución", r.pct_dev ?? 0, "0.00%"],
    [
      "F",
      "G",
      `% Devolución semana\nanterior (${rangoCorto(prevInicio, prevFin)})`,
      r.prev_total ? r.prev_pct_dev : "Sin data",
      "0.00%",
    ],
  ];
  for (const [a, b, titulo, valor, fmt] of cajas) {
    ws.mergeCells(`${a}5:${b}5`);
    ws.mergeCells(`${a}6:${b}7`);
    const h = ws.getCell(`${a}5`);
    h.value = titulo;
    h.font = { name: FONT, size: 10, color: { argb: C.texto } };
    h.fill = fill(C.gris);
    h.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    const v = ws.getCell(`${a}6`);
    v.value = valor;
    v.numFmt = fmt;
    v.font = { name: FONT, size: typeof valor === "string" ? 12 : 18, bold: true, color: { argb: C.morado } };
    v.fill = fill(C.gris);
    v.alignment = { horizontal: "center", vertical: "middle" };
    for (const celda of [`${a}5`, `${b}5`, `${a}6`, `${b}6`, `${a}7`, `${b}7`]) ws.getCell(celda).border = BORDE;
  }
  ws.getRow(5).height = 31.5;
  ws.getRow(6).height = 27.75;
  ws.getRow(7).height = 7.5;

  let fila = 9;
  const titular = titularResumen(rep, tend);
  if (titular) {
    ws.mergeCells(`B${fila}:K${fila}`);
    const c = ws.getCell(`B${fila}`);
    c.value = titular.texto;
    c.font = {
      name: FONT,
      size: 10,
      bold: true,
      color: { argb: titular.tono === "mejora" ? C.verde : titular.tono === "alerta" ? C.rojo : C.texto },
    };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(fila).height = 27.75;
    fila++;
  }
  for (const linea of puntosResumen(rep)) {
    ws.mergeCells(`B${fila}:K${fila}`);
    const c = ws.getCell(`B${fila}`);
    c.value = linea;
    c.font = { name: FONT, size: 10, color: { argb: C.texto } };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(fila).height = 27.75;
    fila++;
  }
  nota(ws, fila, criterioTexto(op), "K");
  fila += 2;

  barra(ws, fila, "Devolución por tiempo de espera del repartidor en tienda", "K");
  fila++;
  encabezados(ws, fila, [
    ["B", "Tiempo de espera"],
    ["C", "Ordenes\ncon dato"],
    ["D", "Devueltas"],
    ["E", "% Devolución"],
  ], 31.5);
  const inicio = fila + 1;
  rep.espera_rangos.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", v: x.etiqueta },
      { col: "C", v: x.ordenes, f: "entero" },
      { col: "D", v: x.devueltas, f: "entero" },
      { col: "E", v: formula(`IFERROR(D${fila}/C${fila},0)`, div(x.devueltas, x.ordenes)), f: "pct" },
    ], i);
  });
  escala(ws, `E${inicio}:E${fila}`);
}

function hojaPersiste(wb: ExcelJS.Workbook, rep: DevReporte) {
  const mes = nombreMes(rep.linea_base.inicio);
  const Mes = mes.charAt(0).toUpperCase() + mes.slice(1);
  const ws = prepararHoja(wb, `⚠ PERSISTE DESDE ${mes.toUpperCase()}`, {
    B: 42.9, C: 33.4, D: 23.7, E: 11, F: 11, G: 11, H: 11, I: 11, J: 11, K: 13, L: 22, M: 30, N: 11, O: 30, P: 3,
  });
  const p = rep.persiste;

  ws.mergeCells("B2:O3");
  const t = ws.getCell("B2");
  t.value = `⚠ LO QUE
