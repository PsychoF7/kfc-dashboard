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
  t.value = `⚠ LO QUE YA SE MENCIONO EN ${mes.toUpperCase()} Y CONTINUA APARECIENDO`;
  t.font = { name: FONT, size: 17, bold: true, color: { argb: C.blanco } };
  t.fill = fill(C.rojo);
  t.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  let fila = 5;
  if (rep.meses_con_data === 0) {
    nota(ws, fila, `No hay data cargada de ${mes} (mes completo). Carga los CSV de ese mes en "Cargar datos" para activar esta hoja.`, "O", 30);
    return;
  }

  // 1) Tiendas
  barra(ws, fila, `1) Tiendas: top 20 en problemas de Dirección (${mes}) — como estan esta semana`, "I");
  fila++;
  encabezados(ws, fila, [
    ["B", "Tienda"],
    ["C", `% con problema de\nDirección, ${Mes}`],
    ["D", "% con problema de\nDirección, Semana"],
    ["E", "Ordenes esta\nsemana"],
  ]);
  p.tiendas.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", v: x.tienda },
      { col: "C", v: x.pct_mes, f: "pct" },
      { col: "D", v: x.pct_semana ?? "Sin ordenes", f: "pct" },
      { col: "E", v: x.ordenes_semana, f: "entero" },
    ], i + 1);
  });

  // 2) GPS
  fila += 3;
  barra(ws, fila, `2) Puntos GPS de ${mes} que volvieron a tener ordenes esta semana`, "O");
  fila++;
  nota(ws, fila, `${p.gps.length} de los ${p.total_gps} puntos marcados en ${mes} (mes completo) tuvieron al menos 1 orden esta semana.`, "O", 24);
  fila++;
  encabezados(ws, fila, [
    ["B", "Latitud"], ["C", "Longitud"], ["D", "Tienda"], ["E", `Ordenes\n${Mes}`], ["F", `% Dev.\n${Mes}`],
    ["G", "Ordenes\nSemana"], ["H", "Dev.\nEfectivo"], ["I", "Dev.\nTarjeta"], ["J", "% Dev.\nSemana"],
    ["K", "Monto Total\nDevuelto"], ["L", "teléfonos"], ["M", "Direcciones"], ["N", "Ver en\nMaps"], ["O", "Fecha+ID"],
  ], 25.5);
  p.gps.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", v: x.latitud, f: "coord" }, { col: "C", v: x.longitud, f: "coord" },
      { col: "D", v: x.tiendas, f: "wrap" }, { col: "E", v: x.ordenes_mes, f: "entero" },
      { col: "F", v: x.pct_mes, f: "pct" }, { col: "G", v: x.ordenes_semana, f: "entero" },
      { col: "H", v: x.dev_efectivo, f: "entero" }, { col: "I", v: x.dev_tarjeta, f: "entero" },
      { col: "J", v: x.pct_semana, f: "pct" }, { col: "K", v: x.monto_devuelto, f: "dinero" },
      { col: "L", v: x.telefonos, f: "wrap" }, { col: "M", v: x.direcciones, f: "wrap" },
      { col: "N", v: link(x.latitud, x.longitud), f: "link" }, { col: "O", v: x.fechas_ids, f: "wrap" },
    ], i + 1, 45);
  });

  // 3) Teléfonos
  fila += 3;
  barra(ws, fila, `3) Teléfonos de ${mes} que volvieron a ordenar esta semana`, "O");
  fila++;
  nota(ws, fila, `${p.telefonos.length} de los ${p.total_telefonos} teléfonos marcados en ${mes} (mes completo) ordenaron esta semana.`, "O", 24);
  fila++;
  encabezados(ws, fila, [
    ["B", "teléfono", "C"], ["D", "Tiendas\nesta semana"], ["E", `Ordenes\n${Mes}`], ["F", `% Dev.\n${Mes}`],
    ["G", "Ordenes\nSemana"], ["H", "Dev.\nEfectivo"], ["I", "Dev.\nTarjeta"], ["J", "% Dev.\nSemana"],
    ["K", "Monto Total\nDevuelto"], ["L", "Direcciones", "M"], ["N", "Ver en\nMaps"], ["O", "Fecha+ID"],
  ], 25.5);
  p.telefonos.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", hasta: "C", v: x.clave }, { col: "D", v: x.tiendas, f: "wrap" },
      { col: "E", v: x.ordenes_mes, f: "entero" }, { col: "F", v: x.pct_mes, f: "pct" },
      { col: "G", v: x.ordenes_semana, f: "entero" }, { col: "H", v: x.dev_efectivo, f: "entero" },
      { col: "I", v: x.dev_tarjeta, f: "entero" }, { col: "J", v: x.pct_semana, f: "pct" },
      { col: "K", v: x.monto_devuelto, f: "dinero" }, { col: "L", hasta: "M", v: x.direcciones, f: "wrap" },
      { col: "N", v: link(x.latitud, x.longitud), f: "link" }, { col: "O", v: x.fechas_ids, f: "wrap" },
    ], i + 1, 30);
  });

  // 4) Direcciones
  fila += 3;
  barra(ws, fila, `4) Direcciones de ${mes} que volvieron a tener ordenes esta semana`, "O");
  fila++;
  nota(ws, fila, `${p.direcciones.length} de las ${p.total_direcciones} Direcciones marcadas en ${mes} (mes completo) tuvieron ordenes esta semana.`, "O", 24);
  fila++;
  encabezados(ws, fila, [
    ["B", "Dirección escrita"], ["C", "Tienda"], ["D", `Ordenes\n${Mes}`], ["E", `% Dev.\n${Mes}`],
    ["F", "Ordenes\nSemana"], ["G", "Dev.\nEfectivo"], ["H", "Dev.\nTarjeta"], ["I", "% Dev.\nSemana"],
    ["J", "Monto Total\nDevuelto"], ["K", "teléfonos", "L"], ["M", "Fecha+ID"], ["N", "Ver en\nMaps"],
  ], 25.5);
  p.direcciones.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", v: x.clave, f: "wrap" }, { col: "C", v: x.tiendas, f: "wrap" },
      { col: "D", v: x.ordenes_mes, f: "entero" }, { col: "E", v: x.pct_mes, f: "pct" },
      { col: "F", v: x.ordenes_semana, f: "entero" }, { col: "G", v: x.dev_efectivo, f: "entero" },
      { col: "H", v: x.dev_tarjeta, f: "entero" }, { col: "I", v: x.pct_semana, f: "pct" },
      { col: "J", v: x.monto_devuelto, f: "dinero" }, { col: "K", hasta: "L", v: x.telefonos, f: "wrap" },
      { col: "M", v: x.fechas_ids, f: "wrap" }, { col: "N", v: link(x.latitud, x.longitud), f: "link" },
    ], i + 1, 30);
  });
}

function hojaEspera(wb: ExcelJS.Workbook, rep: DevReporte) {
  const ws = prepararHoja(wb, "Tiendas - Tiempo de Espera", { B: 39.4, C: 12, D: 12, E: 14, F: 13, G: 14, H: 3 });
  barra(ws, 2, "TIENDAS DONDE MAS ESPERA EL REPARTIDOR EN TIENDA", "G");
  nota(ws, 3, "Minimo 10 ordenes CON dato para aparecer aqui.", "G", 27.75);
  encabezados(ws, 5, [
    ["B", "Tienda"], ["C", "Ordenes\ntotales"], ["D", "Ordenes\ncon dato"], ["E", "% Devueltas"],
    ["F", "Espera\npromedio (min)"], ["G", "% ordenes con\nespera >15 min"],
  ], 51);
  let fila = 5;
  rep.espera_tiendas.forEach((x, i) => {
    fila++;
    filaDatos(ws, fila, [
      { col: "B", v: x.tienda }, { col: "C", v: x.ordenes, f: "entero" }, { col: "D", v: x.con_dato, f: "entero" },
      { col: "E", v: formula(`${x.devueltas}/C${fila}`, div(x.devueltas, x.ordenes)), f: "pct" },
      { col: "F", v: x.espera_prom, f: "dec1" },
      { col: "G", v: formula(`${x.mas_15}/D${fila}`, div(x.mas_15, x.con_dato)), f: "pct" },
    ], i);
  });
  if (fila > 5) escala(ws, `F6:F${fila}`);
  else sinDatos(ws, 6, "G", "Ninguna tienda tiene 10+ ordenes con dato de espera esta semana.");
}

function hojaCalidad(wb: ExcelJS.Workbook, rep: DevReporte) {
  const ws = prepararHoja(wb, "Tiendas - Calidad de Datos", { B: 39.4, C: 12, D: 12, E: 13, F: 12, G: 12, H: 14, I: 3 });
  barra(ws, 2, "TIENDAS CON MAS PROBLEMAS DE CAPTURA DE DIRECCIÓN", "H");
  nota(ws, 3, "Mismo criterio de siempre. Minimo 50 ordenes en la semana.", "H");
  encabezados(ws, 5, [
    ["B", "Tienda"], ["C", "Ordenes\n(semana)"], ["D", "% Devueltas"], ["E", "% CP\nfaltante"],
    ["F", "% Calle\nsin numero"], ["G", "% Colonia\nvacia"], ["H", "% con algun\nproblema de Dirección"],
  ]);
  let fila = 5;
  rep.calidad_tiendas.forEach((x, i) => {
    fila++;
    const f = (n: number) => formula(`${n}/C${fila}`, div(n, x.ordenes));
    filaDatos(ws, fila, [
      { col: "B", v: x.tienda }, { col: "C", v: x.ordenes, f: "entero" },
      { col: "D", v: f(x.devueltas), f: "pct" }, { col: "E", v: f(x.cp_faltante), f: "pct" },
      { col: "F", v: f(x.calle_sin_numero), f: "pct" }, { col: "G", v: f(x.colonia_vacia), f: "pct" },
      { col: "H", v: f(x.problema), f: "pct" },
    ], i);
  });
  if (fila > 5) escala(ws, `H6:H${fila}`);
}

function hojaCasos(wb: ExcelJS.Workbook, rep: DevReporte) {
  const conComentario = rep.casos.some((c) => c.nota);
  const ws = prepararHoja(wb, "Casos Detallados", {
    B: 22, C: 37.9, D: 15, E: 40, F: 10, G: 10, H: 10, I: 13, J: 12, K: conComentario ? 35 : 3, L: 3,
  });
  const ultima = conComentario ? "K" : "J";
  barra(ws, 2, "CASOS PUNTUALES PARA VERIFICACION", ultima);
  nota(ws, 3, "Ordenadas de mayor a menor espera.", ultima);
  const cols: [string, string, string?][] = [
    ["B", "Fecha"], ["C", "Tienda"], ["D", "teléfono"], ["E", "Dirección escrita"], ["F", "Latitud"],
    ["G", "Longitud"], ["H", "Espera\n(min)"], ["I", "Problema de\nDirección"], ["J", "ID de la\norden"],
  ];
  if (conComentario) cols.push(["K", "Comentario"]);
  encabezados(ws, 5, cols, 25.5);
  let fila = 5;
  rep.casos.forEach((x, i) => {
    fila++;
    const celdas: Celda[] = [
      { col: "B", v: x.fecha }, { col: "C", v: x.tienda }, { col: "D", v: x.telefono },
      { col: "E", v: x.direccion, f: "wrap" }, { col: "F", v: x.latitud, f: "coord" },
      { col: "G", v: x.longitud, f: "coord" }, { col: "H", v: x.espera, f: "dec1" },
      { col: "I", v: x.problema_direccion ? "Si" : "" }, { col: "J", v: x.id_corto },
    ];
    if (conComentario) celdas.push({ col: "K", v: x.nota ?? "", f: "wrap" });
    filaDatos(ws, fila, celdas, i, 27.75);
    ws.getCell(`I${fila}`).alignment = { horizontal: "center", vertical: "middle" };
  });
  if (fila > 5) escala(ws, `H6:H${fila}`);
}

function hojaDuplicados(wb: ExcelJS.Workbook, rep: DevReporte) {
  const conComentario = [...rep.duplicados_gps, ...rep.duplicados_telefono, ...rep.duplicados_direccion].some(
    (g) => g.nota
  );
  const ws = prepararHoja(wb, "Duplicados", {
    B: 11, C: 11, D: 37.7, E: 35.6, F: 11, G: 11, H: 9, I: 13, J: 13, K: 13, L: 26, M: 35.3, N: 18.3, O: 30, P: 45,
    Q: conComentario ? 35 : 3, R: 3,
  });
  const ultima = conComentario ? "Q" : "P";
  const s = rep.semana;
  barra(ws, 2, "ORDENES DUPLICADAS: MISMO PUNTO GPS, TELÉFONO O DIRECCIÓN", ultima);
  nota(
    ws,
    3,
    `Nuevos casos de esta semana (${rangoCorto(s.inicio, s.fin)}), 3+ ordenes y 50%+ de Devolución. 3 secciones: A) coordenadas GPS, B) teléfono, C) Dirección escrita. Incluye fecha e ID corto de cada orden.`,
    ultima,
    27.75
  );

  const notaCelda = (tipo: TipoDuplicado, g: DevGrupo, col: string): Celda => ({
    col,
    v: notaDuplicado(tipo, g),
    f: esAlerta(tipo, g) ? "alerta" : "wrap",
  });

  // A) GPS
  let fila = 5;
  barra(ws, fila, "A) Mismo punto GPS exacto con varias ordenes", ultima, { color: C.morado });
  fila++;
  const colsA: [string, string, string?][] = [
    ["B", "Latitud"], ["C", "Longitud"], ["D", "Tienda"], ["E", "Ordenes"], ["F", "Efectivo (#)"], ["G", "Tarjeta (#)"],
    ["H", "% Dev."], ["I", "Monto Efectivo"], ["J", "Monto Tarjeta"], ["K", "Monto Total"], ["L", "teléfonos\nespecificos"],
    ["M", "Direcciones\nespecificas"], ["N", "Ver en\nMaps"], ["O", "Fecha + ID de cada\norden"], ["P", "Nota"],
  ];
  if (conComentario) colsA.push(["Q", "Comentario"]);
  encabezados(ws, fila, colsA, 25.5);
  const iniA = fila + 1;
  rep.duplicados_gps.forEach((g, i) => {
    fila++;
    const celdas: Celda[] = [
      { col: "B", v: g.latitud, f: "coord" }, { col: "C", v: g.longitud, f: "coord" },
      { col: "D", v: g.tiendas, f: "wrap" }, { col: "E", v: g.ordenes, f: "entero" },
      { col: "F", v: g.dev_efectivo, f: "entero" }, { col: "G", v: g.dev_tarjeta, f: "entero" },
      { col: "H", v: formula(`${g.devueltas}/E${fila}`, g.pct_dev), f: "pct" },
      { col: "I", v: g.monto_efectivo, f: "dinero" }, { col: "J", v: g.monto_tarjeta, f: "dinero" },
      { col: "K", v: formula(`I${fila}+J${fila}`, g.monto_efectivo + g.monto_tarjeta), f: "dinero" },
      { col: "L", v: g.telefonos, f: "wrap" }, { col: "M", v: g.direcciones, f: "wrap" },
      { col: "N", v: link(g.latitud, g.longitud), f: "link" }, { col: "O", v: g.fechas_ids, f: "wrap" },
      notaCelda("gps", g, "P"),
    ];
    if (conComentario) celdas.push({ col: "Q", v: g.nota ?? "", f: "wrap" });
    filaDatos(ws, fila, celdas, i + 1, 49.5);
  });
  if (fila >= iniA) escala(ws, `H${iniA}:H${fila}`);

  // B) Teléfono
  fila += 2;
  barra(ws, fila, "B) Mismo teléfono repitiendo (misma o distintas Direcciones)", ultima, { color: C.morado });
  fila++;
  const colsB: [string, string, string?][] = [
    ["B", "teléfono", "C"], ["D", "Tiendas\nespecificas"], ["E", "Ordenes"], ["F", "Efectivo (#)"], ["G", "Tarjeta (#)"],
    ["H", "% Dev."], ["I", "Monto Efectivo"], ["J", "Monto Tarjeta"], ["K", "Monto Total"],
    ["L", "Direcciones\nespecificas", "M"], ["N", "Ver en\nMaps"], ["O", "Fecha + ID de cada\norden"], ["P", "Nota"],
  ];
  if (conComentario) colsB.push(["Q", "Comentario"]);
  encabezados(ws, fila, colsB, 25.5);
  const iniB = fila + 1;
  rep.duplicados_telefono.forEach((g, i) => {
    fila++;
    const celdas: Celda[] = [
      { col: "B", hasta: "C", v: g.clave }, { col: "D", v: g.tiendas, f: "wrap" },
      { col: "E", v: g.ordenes, f: "entero" }, { col: "F", v: g.dev_efectivo, f: "entero" },
      { col: "G", v: g.dev_tarjeta, f: "entero" },
      { col: "H", v: formula(`${g.devueltas}/E${fila}`, g.pct_dev), f: "pct" },
      { col: "I", v: g.monto_efectivo, f: "dinero" }, { col: "J", v: g.monto_tarjeta, f: "dinero" },
      { col: "K", v: formula(`I${fila}+J${fila}`, g.monto_efectivo + g.monto_tarjeta), f: "dinero" },
      { col: "L", hasta: "M", v: g.direcciones, f: "wrap" }, { col: "N", v: link(g.latitud, g.longitud), f: "link" },
      { col: "O", v: g.fechas_ids, f: "wrap" }, notaCelda("telefono", g, "P"),
    ];
    if (conComentario) celdas.push({ col: "Q", v: g.nota ?? "", f: "wrap" });
    filaDatos(ws, fila, celdas, i + 1, 49.5);
  });
  if (fila >= iniB) escala(ws, `H${iniB}:H${fila}`);

  // C) Dirección
  fila += 2;
  barra(ws, fila, "C) Misma Dirección escrita repitiendo (texto exacto)", ultima, { color: C.morado });
  fila++;
  const colsC: [string, string, string?][] = [
    ["B", "Dirección escrita", "D"], ["E", "Tienda"], ["F", "Ordenes"], ["G", "Efectivo (#)"], ["H", "Tarjeta (#)"],
    ["I", "% Dev."], ["J", "Monto Efectivo"], ["K", "Monto Tarjeta"], ["L", "Monto Total"],
    ["M", "teléfonos\nespecificos"], ["N", "Ver en\nMaps"], ["O", "Fecha + ID de cada\norden"], ["P", "Nota"],
  ];
  if (conComentario) colsC.push(["Q", "Comentario"]);
  encabezados(ws, fila, colsC, 25.5);
  const iniC = fila + 1;
  rep.duplicados_direccion.forEach((g, i) => {
    fila++;
    const celdas: Celda[] = [
      { col: "B", hasta: "D", v: g.clave, f: "wrap" }, { col: "E", v: g.tiendas, f: "wrap" },
      { col: "F", v: g.ordenes, f: "entero" }, { col: "G", v: g.dev_efectivo, f: "entero" },
      { col: "H", v: g.dev_tarjeta, f: "entero" },
      { col: "I", v: formula(`${g.devueltas}/F${fila}`, g.pct_dev), f: "pct" },
      { col: "J", v: g.monto_efectivo, f: "dinero" }, { col: "K", v: g.monto_tarjeta, f: "dinero" },
      { col: "L", v: formula(`J${fila}+K${fila}`, g.monto_efectivo + g.monto_tarjeta), f: "dinero" },
      { col: "M", v: g.telefonos, f: "wrap" }, { col: "N", v: link(g.latitud, g.longitud), f: "link" },
      { col: "O", v: g.fechas_ids, f: "wrap" }, notaCelda("direccion", g, "P"),
    ];
    if (conComentario) celdas.push({ col: "Q", v: g.nota ?? "", f: "wrap" });
    filaDatos(ws, fila, celdas, i + 1, 49.5);
  });
  if (fila >= iniC) escala(ws, `I${iniC}:I${fila}`);
}

function hojaRanking(wb: ExcelJS.Workbook, rep: DevReporte, op: DevOpciones) {
  const ws = prepararHoja(wb, "Ranking Nacional", { B: 39.4, C: 12, D: 12, E: 14, F: 14, G: 14, H: 3 });
  const canc = op.incluirRechazadas ? "Cancelacion/Rechazo" : "Cancelacion";
  barra(ws, 2, "RANKING NACIONAL DE TIENDAS: MEJORES Y PEORES", "G");
  nota(ws, 3, `% Problema = % Devolución + % ${canc}, sobre el total de ordenes de cada tienda. Minimo 50 ordenes en la semana; no incluye tiendas Mi Flotilla (MF).`, "G", 27.75);
  nota(
    ws,
    4,
    `💡 Como leerlo: '% Problema total' = '% Devolución' + '% ${canc}' (es la suma de las dos columnas de al lado, no un dato aparte). Si una tienda tiene 0% en Devolución pero un % Problema total alto, es porque ese problema viene TODO de cancelaciones.`,
    "G",
    40
  );
  const titCanc = op.incluirRechazadas ? "Canceladas/\nRechazadas" : "Canceladas";

  let fila = 6;
  const bloque = (titulo: string, filas: DevReporte["ranking_peores"]) => {
    barra(ws, fila, titulo, "G");
    fila++;
    encabezados(ws, fila, [
      ["B", "Tienda"], ["C", "Ordenes"], ["D", "Devueltas"], ["E", titCanc], ["F", "% Devolución"], ["G", "% Problema total"],
    ]);
    const ini = fila + 1;
    filas.forEach((x, i) => {
      fila++;
      filaDatos(ws, fila, [
        { col: "B", v: x.tienda }, { col: "C", v: x.ordenes, f: "entero" },
        { col: "D", v: x.devueltas, f: "entero" }, { col: "E", v: x.canceladas, f: "entero" },
        { col: "F", v: formula(`D${fila}/C${fila}`, div(x.devueltas, x.ordenes)), f: "pct" },
        { col: "G", v: formula(`(D${fila}+E${fila})/C${fila}`, x.pct_problema), f: "pct" },
      ], i);
    });
    if (fila >= ini) escala(ws, `G${ini}:G${fila}`);
  };
  bloque("Top 20 PEORES tiendas (mayor % de problema)", rep.ranking_peores);
  fila += 3;
  bloque("Top 20 MEJORES tiendas (menor % de problema)", rep.ranking_mejores);
}

/** Arma el libro completo y regresa el archivo listo para descargar. */
export async function construirExcelDevoluciones(
  rep: DevReporte,
  tendencia: DevSemanaTendencia[],
  op: DevOpciones
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel Operativo KFC";
  wb.created = new Date();

  hojaResumen(wb, rep, tendencia, op);
  hojaPersiste(wb, rep);
  hojaEspera(wb, rep);
  hojaCalidad(wb, rep);
  hojaCasos(wb, rep);
  hojaDuplicados(wb, rep);
  hojaRanking(wb, rep, op);

  const data = await wb.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}
