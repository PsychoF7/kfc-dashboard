import ExcelJS from "exceljs";
import { CalculoFactura, FilaFactura, nombreMes, partesMes } from "./facturacion";

// Mismo formato que tus facturas: Calibri 11, encabezados azul marino,
// bloque de cobro verde/amarillo y TOTAL en rojo.
const AZUL = "FF002060";
const AZUL_CLARO = "FFB8D3EF";
const VERDE = "FF92D050";
const AMARILLO = "FFFFFF00";
const NARANJA = "FFFFC000";
const ROJO = "FFFF0000";
const ROJO_TEXTO = "FFC00000";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF000000";

const MONEDA = "[$$]#,##0";
const MONEDA_1 = "[$$]#,##0.0";
const CONTABLE = '_-"$"* #,##0.00_-;\\-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-';
const thin = { style: "thin" as const, color: { argb: NEGRO } };
const BORDE = { top: thin, left: thin, bottom: thin, right: thin };

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fuente = (opts: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Calibri", size: 11, ...opts });
const f = (formula: string, result?: number): ExcelJS.CellFormulaValue => ({ formula, result });
const col = (n: number) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function encabezadoAzul(c: ExcelJS.Cell) {
  c.font = fuente({ bold: true, color: { argb: BLANCO } });
  c.fill = fill(AZUL);
  c.alignment = { horizontal: "center", vertical: "middle" };
  c.border = BORDE;
}

/** Celdas de días: vacía si fue 0 (como en tu tabla dinámica). */
function escribirDias(ws: ExcelJS.Worksheet, fila: number, colInicio: number, dias: number[]) {
  dias.forEach((n, i) => {
    if (n > 0) ws.getCell(fila, colInicio + i).value = n;
  });
}

// ---------------------------------------------------------------------
// Hoja 1: tienda × día + bloque de cobro
// ---------------------------------------------------------------------
function hojaPrincipal(wb: ExcelJS.Workbook, c: CalculoFactura) {
  const mesPago = nombreMes(c.mesPago);
  const mesOp = nombreMes(c.mesOperado).toUpperCase();
  const N = c.diasMes;
  const ws = wb.addWorksheet(mesPago, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 41;
  for (let i = 0; i < N; i++) ws.getColumn(3 + i).width = 6;
  const colTotal = 3 + N;
  ws.getColumn(colTotal).width = 9;
  // el bloque de cobro usa C..J: les damos ancho para que se lean los títulos
  [18, 20, 25, 19, 27, 11, 16, 17].forEach((w, i) => (ws.getColumn(3 + i).width = Math.max(ws.getColumn(3 + i).width ?? 0, w)));

  ws.getCell(1, 2).value = "Tienda ";
  for (let d = 1; d <= N; d++) ws.getCell(1, 2 + d).value = d;
  ws.getCell(1, colTotal).value = "Total";
  for (let k = 2; k <= colTotal; k++) encabezadoAzul(ws.getCell(1, k));

  const lista = c.filas.filter((x) => x.estado !== "baja");
  lista.forEach((t, i) => {
    const r = i + 2;
    const a = ws.getCell(r, 1);
    a.value = i + 1;
    a.font = fuente({ bold: true, size: 12 });
    a.alignment = { horizontal: "center" };
    const b = ws.getCell(r, 2);
    b.value = t.tienda;
    b.font = fuente();
    escribirDias(ws, r, 3, t.dias);
    ws.getCell(r, colTotal).value = t.total || null;
  });

  const rTotal = lista.length + 2;
  for (let k = 1; k <= colTotal; k++) {
    const cel = ws.getCell(rTotal, k);
    cel.fill = fill(AZUL);
    cel.font = fuente({ bold: true, color: { argb: BLANCO } });
  }
  ws.getCell(rTotal, 2).value = "Total general";
  ws.getCell(rTotal, colTotal).value = f(`SUM(${col(colTotal)}2:${col(colTotal)}${rTotal - 1})`, c.resumen.ordenesMes);
  ws.getCell(rTotal, colTotal).alignment = { horizontal: "center" };

  // ----- Bloque de cobro
  const r0 = rTotal + 2;
  const titulos = [
    "SUCURSALES",
    "Fecha activacion",
    "Sucursales operativas",
    "Cant activaciones en el mes",
    "Cant facturadas total",
    "Días proporcionales a facturar",
    "Costo x dia",
    "Fact proporcional",
    "Facturación Total",
  ];
  titulos.forEach((t, i) => {
    const cel = ws.getCell(r0, 2 + i);
    cel.value = t;
    cel.font = fuente({ bold: true, color: { argb: NEGRO } });
    if (i < 8) cel.fill = fill(AZUL_CLARO);
    cel.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
    cel.border = BORDE;
  });
  ws.getRow(r0).height = 30;

  const R = c.resumen;
  const costoDia = `${R.costoMensual}/${N}`;
  const filasCobro: (string | number | ExcelJS.CellFormulaValue | null)[][] = [
    [`AL INICIO DE ${mesPago.toUpperCase()} ${partesMes(c.mesPago).y}`, "-", R.tiendasFacturar, 0, R.tiendasFacturar, N, f(costoDia), null, null],
    [`PROPORCIONAL DE ${mesOp} DELIVERY`, null, R.nuevasDelivery, R.nuevasDelivery, null, R.diasDelivery, f(costoDia), R.costoMensual, null],
    [`PROPORCIONAL DE ${mesOp} MI FLOTILLA`, null, R.nuevasFlotilla, R.nuevasFlotilla, null, R.diasFlotilla, f(costoDia), R.costoMensual, null],
    ["Total a Facturar ", null, R.tiendasFacturar, null, R.tiendasFacturar, N, f(costoDia), null, null],
    [null, null, null, null, null, null, f(costoDia), null, null],
    [null, null, null, null, null, null, f(costoDia), null, null],
  ];
  filasCobro.forEach((vals, i) => {
    const r = r0 + 1 + i;
    vals.forEach((v, k) => {
      const cel = ws.getCell(r, 2 + k);
      if (v !== null) cel.value = v as ExcelJS.CellValue;
      cel.font = fuente({ color: { argb: NEGRO } });
      cel.fill = fill(k === 8 ? AMARILLO : VERDE);
      cel.border = BORDE;
      cel.alignment = { horizontal: k === 0 ? "left" : "center" };
    });
    ws.getCell(r, 8).numFmt = MONEDA_1; // Costo x día
    ws.getCell(r, 9).numFmt = MONEDA_1; // Fact proporcional
    ws.getCell(r, 10).numFmt = MONEDA;
    // Fact proporcional = costo x día × días (filas 1, 4, 5 y 6, como en tu archivo)
    if (i === 0 || i >= 3) ws.getCell(r, 9).value = f(`H${r}*G${r}`, i < 4 ? R.costoMensual : 0);
  });
  const rInicio = r0 + 1;
  ws.getCell(rInicio + 1, 10).value = f(`G${rInicio + 1}*H${rInicio + 1}`, R.proporcionalDelivery);
  ws.getCell(rInicio + 2, 10).value = f(`G${rInicio + 2}*H${rInicio + 2}`, R.proporcionalFlotilla);
  ws.getCell(rInicio + 3, 10).value = f(`I${rInicio + 3}*F${rInicio + 3}`, R.montoBase);

  const rSuma = rInicio + filasCobro.length;
  const suma = ws.getCell(rSuma, 10);
  suma.value = f(`SUM(J${rInicio}:J${rSuma - 1})`, R.subtotal);
  suma.fill = fill(NARANJA);
  suma.font = fuente({ bold: true, color: { argb: NEGRO } });
  suma.numFmt = MONEDA;
  suma.border = BORDE;
  suma.alignment = { horizontal: "center" };
  const extra = ws.getCell(rSuma + 1, 10);
  extra.fill = fill(AMARILLO);
  extra.border = BORDE;
  extra.numFmt = MONEDA;

  const fin: [string, ExcelJS.CellFormulaValue, boolean][] = [
    ["SUBTOTAL", f(`SUM(J${rSuma}:J${rSuma + 1})`, R.subtotal), false],
    ["IVA", f(`J${rSuma + 2}*0.16`, R.iva), false],
    ["TOTAL", f(`J${rSuma + 2}+J${rSuma + 3}`, R.total), true],
  ];
  fin.forEach(([t, v, rojo], i) => {
    const r = rSuma + 2 + i;
    const a = ws.getCell(r, 9);
    const b = ws.getCell(r, 10);
    a.value = t;
    b.value = v;
    b.numFmt = MONEDA;
    for (const cel of [a, b]) {
      cel.font = fuente({ bold: true, color: { argb: rojo ? BLANCO : NEGRO } });
      cel.alignment = { horizontal: "center" };
      if (rojo) cel.fill = fill(ROJO);
    }
  });
}

// ---------------------------------------------------------------------
// Hoja 2: Nuevas (altas sin órdenes, bajas, nuevas y notas)
// ---------------------------------------------------------------------
function hojaNuevas(wb: ExcelJS.Workbook, c: CalculoFactura) {
  const N = c.diasMes;
  const ws = wb.addWorksheet(`Nuevas ${nombreMes(c.mesPago)}`);
  ws.getColumn(1).width = 38;
  for (let i = 0; i < N; i++) ws.getColumn(2 + i).width = 4;
  ws.getColumn(2 + N).width = 8;

  ws.getCell(1, 1).value = "Tienda";
  for (let d = 1; d <= N; d++) ws.getCell(1, 1 + d).value = d;
  ws.getCell(1, 2 + N).value = "Total";
  for (let k = 1; k <= 2 + N; k++) encabezadoAzul(ws.getCell(1, k));

  let r = 2;
  const sinOperar = c.filas.filter((x) => x.estado === "sin_ordenes" || x.estado === "alta_manual" || x.estado === "baja");
  for (const t of sinOperar) {
    const a = ws.getCell(r, 1);
    a.value = t.tienda;
    a.font = t.estado === "baja" ? fuente({ bold: true, color: { argb: ROJO_TEXTO } }) : fuente();
    if (t.estado === "baja") {
      escribirDias(ws, r, 2, t.dias);
      if (t.total) ws.getCell(r, 2 + N).value = t.total;
    }
    r++;
  }
  const nuevas = c.filas.filter((x) => x.estado === "nueva").sort((a, b) => (a.primerDia ?? 99) - (b.primerDia ?? 99));
  for (const t of nuevas) {
    ws.getCell(r, 1).value = t.tienda;
    ws.getCell(r, 1).font = fuente();
    escribirDias(ws, r, 2, t.dias);
    ws.getCell(r, 2 + N).value = t.total;
    r++;
  }

  // Notas (las que escribiste en la app)
  const conNota = c.filas.filter((x) => x.nota);
  if (conNota.length) {
    r += 2;
    for (const t of conNota) {
      const a = ws.getCell(r, 1);
      a.value = t.tienda;
      a.font = t.estado === "baja" ? fuente({ bold: true, color: { argb: ROJO_TEXTO } }) : fuente({ bold: true });
      ws.getCell(r + 1, 1).value = t.nota;
      ws.getCell(r + 1, 1).font = fuente();
      r += 3;
    }
  }
}

// ---------------------------------------------------------------------
// Hoja 3: Proporcional (Delivery y Mi Flotilla) con fórmulas
// ---------------------------------------------------------------------
function bloqueProporcional(ws: ExcelJS.Worksheet, inicio: number, titulo: string, tiendas: FilaFactura[], c: CalculoFactura) {
  const N = c.diasMes;
  const cTotal = 2 + N;
  const cDias = cTotal + 1;
  const cCosto = cTotal + 2;
  const cMonto = cTotal + 3;
  const L = (k: number) => col(k);
  const costo = `${c.resumen.costoMensual}/${N}`;

  ws.mergeCells(inicio, 1, inicio, cMonto);
  const t = ws.getCell(inicio, 1);
  t.value = titulo;
  t.font = fuente({ bold: true, color: { argb: BLANCO } });
  t.fill = fill(AZUL);
  t.alignment = { horizontal: "center" };

  const h = inicio + 1;
  ws.getCell(h, 1).value = "Tienda";
  for (let d = 1; d <= N; d++) ws.getCell(h, 1 + d).value = d;
  ws.getCell(h, cTotal).value = "Total";
  ws.getCell(h, cDias).value = "Dias a Cobrar ";
  ws.getCell(h, cCosto).value = "Costo Diario ";
  ws.getCell(h, cMonto).value = "Monto a Cobrar ";
  for (let k = 1; k <= cMonto; k++) encabezadoAzul(ws.getCell(h, k));

  let r = h + 1;
  const primera = r;
  for (const x of tiendas) {
    const rango = `B${r}:${L(cTotal - 1)}${r}`;
    ws.getCell(r, 1).value = x.tienda;
    escribirDias(ws, r, 2, x.dias);
    ws.getCell(r, cTotal).value = f(`SUM(${rango})`, x.total);
    ws.getCell(r, cDias).value = f(
      `IF(COUNTA(${rango})=0, 0, ${N + 1} - MATCH(TRUE, INDEX(${rango}<>"", 0), 0))`,
      x.diasCobrar ?? 0
    );
    ws.getCell(r, cCosto).value = f(costo, c.resumen.costoDiario);
    ws.getCell(r, cMonto).value = f(`${L(cDias)}${r}*${L(cCosto)}${r}`, x.monto ?? 0);
    ws.getCell(r, cCosto).numFmt = CONTABLE;
    ws.getCell(r, cMonto).numFmt = CONTABLE;
    r++;
  }
  const ultima = r - 1;
  const totDias = tiendas.reduce((s, x) => s + (x.diasCobrar ?? 0), 0);
  for (let k = cTotal; k <= cMonto; k++) {
    const cel = ws.getCell(r, k);
    cel.fill = fill(AZUL);
    cel.font = fuente({ bold: true, color: { argb: BLANCO } });
  }
  if (tiendas.length) {
    ws.getCell(r, cTotal).value = f(`SUM(${L(cTotal)}${primera}:${L(cTotal)}${ultima})`, tiendas.reduce((s, x) => s + x.total, 0));
    ws.getCell(r, cDias).value = f(`SUM(${L(cDias)}${primera}:${L(cDias)}${ultima})`, totDias);
  } else {
    ws.getCell(r, cTotal).value = 0;
    ws.getCell(r, cDias).value = 0;
  }
  ws.getCell(r, cCosto).value = f(costo, c.resumen.costoDiario);
  ws.getCell(r, cMonto).value = f(`${L(cCosto)}${r}*${L(cDias)}${r}`, totDias * (c.resumen.costoMensual / N));
  ws.getCell(r, cCosto).numFmt = CONTABLE;
  ws.getCell(r, cMonto).numFmt = CONTABLE;
  return r;
}

function hojaProporcional(wb: ExcelJS.Workbook, c: CalculoFactura) {
  const N = c.diasMes;
  const ws = wb.addWorksheet(`Proporcional ${nombreMes(c.mesPago)}`);
  ws.getColumn(1).width = 38;
  for (let i = 0; i < N; i++) ws.getColumn(2 + i).width = 4;
  ws.getColumn(2 + N).width = 8;
  ws.getColumn(3 + N).width = 14;
  ws.getColumn(4 + N).width = 14;
  ws.getColumn(5 + N).width = 16;
  const porDia = (a: FilaFactura, b: FilaFactura) => (a.primerDia ?? 99) - (b.primerDia ?? 99);
  const nuevas = c.filas.filter((x) => x.estado === "nueva");
  const fin = bloqueProporcional(ws, 1, "DELIVERY", nuevas.filter((x) => x.tipo === "delivery").sort(porDia), c);
  bloqueProporcional(ws, fin + 3, "MI FLOTILLA", nuevas.filter((x) => x.tipo === "flotilla").sort(porDia), c);
}

/** Excel de la factura con tus 3 hojas: {Mes}, Nuevas {Mes} y Proporcional {Mes}. */
export async function construirExcelFactura(c: CalculoFactura): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel Operativo KFC";
  hojaPrincipal(wb, c);
  hojaNuevas(wb, c);
  hojaProporcional(wb, c);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
