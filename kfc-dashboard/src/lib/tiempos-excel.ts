import ExcelJS from "exceljs";
import { META_MINUTOS, type TiemposPanorama, type ZonaRoja, zonasRojasDe } from "./tiempos";

// Mismo estilo que el reporte de devoluciones
const C = { oscuro: "FF212135", morado: "FF891DFF", gris: "FFE9EAF2", blanco: "FFFFFFFF", texto: "FF212135", sutil: "FF6B6B7B" };
const FONT = "Arial";
const thin = { style: "thin" as const, color: { argb: "FFCFCEDD" } };
const BORDE = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function hoja(wb: ExcelJS.Workbook, nombre: string, anchos: number[]) {
  const ws = wb.addWorksheet(nombre, {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 3;
  anchos.forEach((w, i) => (ws.getColumn(i + 2).width = w));
  return ws;
}

function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string, cols: number, color = C.oscuro) {
  ws.mergeCells(fila, 2, fila, cols + 1);
  const c = ws.getCell(fila, 2);
  c.value = texto;
  c.font = { name: FONT, size: 13, bold: true, color: { argb: C.blanco } };
  c.fill = fill(color);
  c.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(fila).height = 24;
}

function nota(ws: ExcelJS.Worksheet, fila: number, texto: string, cols: number) {
  ws.mergeCells(fila, 2, fila, cols + 1);
  const c = ws.getCell(fila, 2);
  c.value = texto;
  c.font = { name: FONT, size: 9, color: { argb: C.sutil } };
  c.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(fila).height = 30;
}

function encabezado(ws: ExcelJS.Worksheet, fila: number, textos: string[]) {
  textos.forEach((t, i) => {
    const c = ws.getCell(fila, i + 2);
    c.value = t;
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.blanco } };
    c.fill = fill(C.morado);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDE;
  });
  ws.getRow(fila).height = 32;
}

type Fmt = "txt" | "int" | "min" | "pct" | "dif";
function filaDatos(ws: ExcelJS.Worksheet, fila: number, valores: [ExcelJS.CellValue, Fmt][], i: number) {
  valores.forEach(([v, f], k) => {
    const c = ws.getCell(fila, k + 2);
    c.value = v ?? null;
    c.fill = fill(i % 2 === 0 ? C.gris : C.blanco);
    c.border = BORDE;
    c.font = { name: FONT, size: 10, color: { argb: C.texto } };
    c.alignment = { vertical: "middle", horizontal: f === "txt" ? "left" : "center" };
    if (f === "int") c.numFmt = "#,##0";
    if (f === "min") c.numFmt = "0.0";
    if (f === "pct") c.numFmt = "0.0%";
    if (f === "dif") c.numFmt = "+0.0;-0.0;0.0";
  });
}

function escala(ws: ExcelJS.Worksheet, ref: string, invertida = false) {
  const colores = [{ argb: "FF63BE7B" }, { argb: "FFFFEB84" }, { argb: "FFF8696B" }];
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
        color: invertida ? [...colores].reverse() : colores,
      },
    ],
  });
}

const fecha = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");

/** Excel de Análisis de tiempos con el mismo periodo y filtros de la pantalla. */
export async function construirExcelTiempos(p: TiemposPanorama, zonas: ZonaRoja[], filtrosTexto: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel Operativo KFC";
  const k = p.kpis;

  // ---------------- Resumen
  const r = hoja(wb, "Resumen", [52, 14, 16, 16, 14, 14]);
  r.mergeCells("B2:G3");
  const t = r.getCell("B2");
  t.value = `ANÁLISIS DE TIEMPOS — DEL ${fecha(p.periodo.desde).toUpperCase()} AL ${fecha(p.periodo.hasta).toUpperCase()}`;
  t.font = { name: FONT, size: 14, bold: true, color: { argb: C.blanco } };
  t.fill = fill(C.oscuro);
  t.alignment = { vertical: "middle", indent: 1 };
  nota(r, 4, filtrosTexto, 6);
  let f = 6;
  encabezado(r, f, ["Indicador", "Valor"]);
  const ind: [string, ExcelJS.CellValue, Fmt][] = [
    ["Órdenes completadas", k.completadas, "int"],
    ["Tiempo total promedio (min)", k.total_prom, "min"],
    [`Entregadas en menos de ${META_MINUTOS} min`, k.pct_45, "pct"],
    ["Entregadas en menos de 60 min", k.pct_60, "pct"],
    ["Hasta que el repartidor sale con la orden (min, promedio)", k.recol_prom, "min"],
    ["Hasta que el repartidor sale con la orden (min, mediana)", k.recol_med, "min"],
    ["Entrega al cliente (min)", k.entrega_prom, "min"],
    ["Espera exacta en tienda (min, solo Rappi y flotilla)", k.espera_prom, "min"],
    ["Velocidad aprox. del repartidor (km/h)", k.kmh_med, "min"],
  ];
  ind.forEach(([n, v, fm], i) => filaDatos(r, ++f, [[n, "txt"], [v, fm]], i));

  f += 3;
  titulo(r, f, "Tendencia por día", 6);
  encabezado(r, ++f, ["Día", "Órdenes", "Tiempo total (min)", "Hasta que sale (min)", `< ${META_MINUTOS} min`]);
  const iniDia = f + 1;
  p.por_dia.forEach((d, i) =>
    filaDatos(r, ++f, [[d.dia, "txt"], [d.ordenes, "int"], [d.total_prom, "min"], [d.recol_prom, "min"], [d.pct_45, "pct"]], i)
  );
  if (f >= iniDia) escala(r, `D${iniDia}:D${f}`);

  f += 3;
  titulo(r, f, "Tendencia por hora", 6);
  encabezado(r, ++f, ["Hora", "Órdenes", "Tiempo total (min)", "Hasta que sale (min)", `< ${META_MINUTOS} min`, "Velocidad (km/h)"]);
  const iniHora = f + 1;
  p.por_hora
    .filter((h) => h.ordenes >= 20)
    .forEach((h, i) =>
      filaDatos(
        r,
        ++f,
        [[`${h.hora}:00`, "txt"], [h.ordenes, "int"], [h.total_prom, "min"], [h.recol_prom, "min"], [h.pct_45, "pct"], [h.kmh, "min"]],
        i
      )
    );
  if (f >= iniHora) {
    escala(r, `D${iniHora}:D${f}`);
    escala(r, `G${iniHora}:G${f}`, true);
  }

  // ---------------- Tiendas
  const ts = hoja(wb, "Tiendas", [38, 30, 11, 14, 12, 14, 12, 12, 11, 11, 12]);
  titulo(ts, 2, "TIENDAS: TIEMPO HASTA QUE EL REPARTIDOR SALE CON LA ORDEN", 11);
  nota(
    ts,
    3,
    "Ordenadas de la más lenta a la más rápida. 'vs su zona' = minutos arriba (+) o abajo (-) de la mediana de su zona. Espera exacta solo existe en Rappi y flotilla. Mínimo 10 órdenes completadas.",
    11
  );
  encabezado(ts, 5, [
    "Tienda",
    "Zona",
    "Órdenes",
    "Hasta que sale (min)",
    "vs su zona (min)",
    "Espera exacta (min)",
    "Entrega (min)",
    "Total (min)",
    `< ${META_MINUTOS} min`,
    "% Devolución",
    "Zona roja",
  ]);
  let ft = 5;
  p.tiendas
    .filter((x) => x.completadas >= 10 && x.recol_med != null)
    .sort((a, b) => (b.recol_med ?? 0) - (a.recol_med ?? 0))
    .forEach((x, i) =>
      filaDatos(
        ts,
        ++ft,
        [
          [x.tienda, "txt"],
          [x.zona, "txt"],
          [x.completadas, "int"],
          [x.recol_med, "min"],
          [x.vs_zona, "dif"],
          [x.n_espera >= 5 ? x.espera_prom : null, "min"],
          [x.entrega_prom, "min"],
          [x.total_prom, "min"],
          [x.pct_45, "pct"],
          [x.pct_dev, "pct"],
          [zonasRojasDe(x, zonas).length ? "Sí" : "", "txt"],
        ],
        i
      )
    );
  if (ft > 5) {
    escala(ts, `E6:E${ft}`);
    escala(ts, `F6:F${ft}`);
  }

  // ---------------- Tráfico
  const horas = Array.from(new Set(p.trafico.map((x) => x.hora))).sort((a, b) => a - b);
  const zonasT = Array.from(
    p.trafico.reduce((m, x) => m.set(x.zona, (m.get(x.zona) ?? 0) + x.ordenes), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([z]) => z);
  const tr = hoja(wb, "Tráfico", [34, ...horas.map(() => 6)]);
  titulo(tr, 2, "TRÁFICO: VELOCIDAD APROX. DEL REPARTIDOR (KM/H) POR ZONA Y HORA", Math.max(horas.length + 1, 6));
  nota(tr, 3, "Más lento (rojo) = más tráfico. Aproximado: distancia cliente-tienda entre tiempo de manejo. Sirve para comparar zonas y horas entre sí.", Math.max(horas.length + 1, 6));
  encabezado(tr, 5, ["Zona", ...horas.map((h) => `${h}h`)]);
  let fr = 5;
  zonasT.forEach((z, i) => {
    fr++;
    filaDatos(
      tr,
      fr,
      [[z, "txt"], ...horas.map((h) => [p.trafico.find((x) => x.zona === z && x.hora === h)?.kmh ?? null, "min"] as [ExcelJS.CellValue, Fmt])],
      i
    );
  });
  if (fr > 5 && horas.length) {
    const ultima = tr.getColumn(horas.length + 2).letter;
    escala(tr, `C6:${ultima}${fr}`, true);
  }

  // ---------------- Relación con devoluciones
  const rd = hoja(wb, "Relación devoluciones", [34, 14, 14, 14]);
  titulo(rd, 2, "DEVOLUCIÓN SEGÚN EL TIEMPO HASTA QUE SALE EL REPARTIDOR", 4);
  encabezado(rd, 4, ["Tiempo hasta que sale", "Órdenes", "Devueltas", "% Devolución"]);
  let fd = 4;
  p.relacion_devoluciones.forEach((x, i) =>
    filaDatos(rd, ++fd, [[x.rango, "txt"], [x.ordenes, "int"], [x.devueltas, "int"], [x.pct_dev, "pct"]], i)
  );
  if (fd > 4) escala(rd, `E5:E${fd}`);

  // ---------------- Zonas rojas
  if (zonas.length) {
    const zr = hoja(wb, "Zonas rojas", [12, 50, 22, 60]);
    titulo(zr, 2, "ZONAS ROJAS", 4, "FFC0392B");
    encabezado(zr, 4, ["Tipo", "Zonas / ciudades / tiendas", "Horario", "Motivo"]);
    zonas.forEach((z, i) =>
      filaDatos(zr, 5 + i, [[z.alcance, "txt"], [z.valores.join(", "), "txt"], [z.horario ?? "", "txt"], [z.nota, "txt"]], i)
    );
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
