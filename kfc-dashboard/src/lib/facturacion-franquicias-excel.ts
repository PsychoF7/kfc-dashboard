import ExcelJS from "exceljs";
import { FRANQUICIA, FilaFranquicia, mesAnterior, nombreMes, nombreMesAnio } from "./facturacion";

// Factura de franquicias (por tienda o por razón social). Paleta del dashboard.
const AZUL = "FF212135";
const PERI = "FF7D8FFF";
const GRIS = "FFE9EAF2";
const MORADO = "FF891DFF";
const MORADO_SUAVE = "FFE6D1FF";
const BLANCO = "FFFFFFFF";
const NEGRO = "FF000000";

const thin = { style: "thin" as const, color: { argb: NEGRO } };
const BORDE = { top: thin, left: thin, bottom: thin, right: thin };
const MONEDA = '"$"#,##0.00';

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fuente = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Calibri", size: 11, ...o });
const f = (formula: string, result?: number): ExcelJS.CellFormulaValue => ({ formula, result });

export interface OpcionesFranquicias {
  mesPago: string;
  /** Razón social de la factura (si todas las tiendas son de la misma) */
  razonSocial: string | null;
  rfc: string | null;
  iva: number;
}

export async function construirExcelFranquicias(filas: FilaFranquicia[], o: OpcionesFranquicias): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel Operativo KFC";
  hojaFactura(wb, filas, o);
  hojaDetalle(wb, filas, o);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

function hojaFactura(wb: ExcelJS.Workbook, filas: FilaFranquicia[], o: OpcionesFranquicias) {
  const ws = wb.addWorksheet(`Franquicias ${nombreMes(o.mesPago)}`);
  [46, 14, 14, 16, 18, 16, 18, 16].forEach((w, i) => (ws.getColumn(1 + i).width = w));

  ws.mergeCells(1, 1, 1, 8);
  const t = ws.getCell(1, 1);
  t.value = `Factura de franquicias · ${nombreMesAnio(o.mesPago)}`;
  t.font = fuente({ bold: true, size: 14, color: { argb: BLANCO } });
  t.fill = fill(AZUL);
  t.alignment = { vertical: "middle", horizontal: "left" };
  ws.getRow(1).height = 26;

  const datos: [string, string][] = [
    ["Razón social", o.razonSocial ?? "Varias"],
    ["RFC", o.rfc ?? ""],
    ["Órdenes de", nombreMesAnio(mesAnterior(o.mesPago))],
    ["Cobro", `$${FRANQUICIA.base} de base + $${FRANQUICIA.porOrden} por orden, tope $${FRANQUICIA.tope.toLocaleString("en-US")} por tienda`],
  ];
  datos.forEach(([a, b], i) => {
    const r = 3 + i;
    ws.getCell(r, 1).value = a;
    ws.getCell(r, 1).font = fuente({ bold: true });
    ws.getCell(r, 1).fill = fill(GRIS);
    ws.mergeCells(r, 2, r, 8);
    ws.getCell(r, 2).value = b;
    ws.getCell(r, 2).font = fuente();
    for (let k = 1; k <= 8; k++) ws.getCell(r, k).border = BORDE;
  });

  const r0 = 8;
  ["Tienda", "Órdenes", "Base", "Por órdenes", "Base + órdenes", "Tope", "A facturar", "¿Aplicó tope?"].forEach((h, i) => {
    const c = ws.getCell(r0, 1 + i);
    c.value = h;
    c.font = fuente({ bold: true });
    c.fill = fill(PERI);
    c.border = BORDE;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(r0).height = 30;

  let r = r0 + 1;
  const primera = r;
  for (const x of filas) {
    ws.getCell(r, 1).value = x.tienda;
    ws.getCell(r, 2).value = x.ordenes;
    ws.getCell(r, 3).value = x.base;
    ws.getCell(r, 4).value = f(`${FRANQUICIA.porOrden}*B${r}`, x.porOrden);
    ws.getCell(r, 5).value = f(`C${r}+D${r}`, x.suma);
    ws.getCell(r, 6).value = FRANQUICIA.tope;
    ws.getCell(r, 7).value = f(`MIN(E${r},F${r})`, x.monto);
    ws.getCell(r, 8).value = { formula: `IF(E${r}>F${r},"SI","NO")`, result: x.tope ? "SI" : "NO" };
    for (let k = 1; k <= 8; k++) {
      const c = ws.getCell(r, k);
      c.border = BORDE;
      c.font = fuente();
      c.fill = fill(GRIS);
      if (k >= 3 && k <= 7) c.numFmt = MONEDA;
      if (k === 2) c.numFmt = "#,##0";
      if (k === 8) c.alignment = { horizontal: "center" };
    }
    r++;
  }
  const ultima = r - 1;
  const sum = (L: string) => f(`SUM(${L}${primera}:${L}${ultima})`);
  ws.getCell(r, 1).value = "Total";
  ws.getCell(r, 2).value = sum("B");
  ws.getCell(r, 7).value = sum("G");
  for (let k = 1; k <= 8; k++) {
    const c = ws.getCell(r, k);
    c.border = BORDE;
    c.font = fuente({ bold: true });
    c.fill = fill(MORADO_SUAVE);
    if (k === 7) c.numFmt = MONEDA;
    if (k === 2) c.numFmt = "#,##0";
  }
  const sub = filas.reduce((s, x) => s + x.monto, 0);
  const iva = Math.round(sub * o.iva * 100) / 100;
  const fin: [string, ExcelJS.CellFormulaValue, boolean][] = [
    ["SUBTOTAL", f(`G${r}`, sub), false],
    ["IVA", f(`G${r + 2}*${o.iva}`, iva), false],
    ["TOTAL", f(`G${r + 2}+G${r + 3}`, Math.round((sub + iva) * 100) / 100), true],
  ];
  fin.forEach(([a, v, total], i) => {
    const rr = r + 2 + i;
    const ca = ws.getCell(rr, 6);
    const cb = ws.getCell(rr, 7);
    ca.value = a;
    cb.value = v;
    cb.numFmt = MONEDA;
    for (const c of [ca, cb]) {
      c.font = fuente({ bold: true, color: { argb: total ? BLANCO : NEGRO } });
      c.alignment = { horizontal: "center" };
      c.border = BORDE;
      if (total) c.fill = fill(MORADO);
    }
  });
}

function hojaDetalle(wb: ExcelJS.Workbook, filas: FilaFranquicia[], o: OpcionesFranquicias) {
  const ws = wb.addWorksheet("Detalle diario", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  const N = filas[0]?.dias.length ?? 30;
  ws.getColumn(1).width = 46;
  for (let i = 0; i < N; i++) ws.getColumn(2 + i).width = 6;
  ws.getColumn(2 + N).width = 10;
  const h = ws.getCell(1, 1);
  h.value = `Órdenes por día · ${nombreMesAnio(mesAnterior(o.mesPago))}`;
  const heads = [h.value as string, ...Array.from({ length: N }, (_, i) => String(i + 1)), "Total"];
  heads.forEach((t, i) => {
    const c = ws.getCell(1, 1 + i);
    c.value = i === 0 || i === N + 1 ? t : Number(t);
    c.font = fuente({ bold: true, color: { argb: BLANCO } });
    c.fill = fill(AZUL);
    c.border = BORDE;
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  filas.forEach((x, i) => {
    const r = 2 + i;
    ws.getCell(r, 1).value = x.tienda;
    x.dias.forEach((n, k) => {
      if (n > 0) ws.getCell(r, 2 + k).value = n;
    });
    ws.getCell(r, 2 + N).value = x.ordenes;
    for (let k = 1; k <= N + 2; k++) {
      const c = ws.getCell(r, k);
      c.border = BORDE;
      c.font = fuente({ bold: k === N + 2 });
      if (k > 1) c.alignment = { horizontal: "center" };
    }
  });
}
