import ExcelJS from "exceljs";
import type { RappiTurbo, TurboResumen } from "./rappi";

// Mismo estilo que tu "KFC 59 Rappi Turbo - comparativa"
const OSCURO = "FF212135";
const MORADO = "FF891DFF";
const PERI = "FF7D8FFF";
const GRIS = "FFD9D9E3";
const TEXTO = "FF222222";
const SUTIL = "FF5B5B66";
const ESTATUS: [string, string, string, string][] = [
  // [etiqueta, valor en Datos, fondo, color de texto]
  ["Completas", "COMPLETE", "FFE5F5EE", "FF1E8E5A"],
  ["Devueltas", "RETURNED", "FFFFF4E5", "FFB26B00"],
  ["Canceladas", "CANCELLED", "FFFDECEC", "FFC0392B"],
  ["Returning", "RETURNING", "FFF1EAFE", "FF6B2BD9"],
  ["Rechazadas", "REJECTED", "FFF2F2F5", "FF5B5B66"],
];
const ETAPAS: [string, string][] = [
  ["Aceptación de restaurante", "G"],
  ["Aceptación de repartidor", "H"],
  ["Llegar a tienda", "I"],
  ["Recoger pedido", "J"],
  ["Entregar", "K"],
  ["Completar", "L"],
  ["Ciclo total: Aceptada → Completada", "U"],
];
const FRANJAS: [string, string][] = [
  ["Tiempo total < 45 min", "M"],
  ["Tiempo total < 60 min (acumulado)", "N"],
  ["Tiempo total > 60 min", "O"],
  ["Sin cooking time < 45 min", "P"],
  ["Sin cooking time < 60 min (acumulado)", "Q"],
  ["Sin cooking time > 60 min", "R"],
];
const PTS = '\\+0.0" pts";\\-0.0" pts";0.0" pts"';
const PCT_DELTA = "\\+0.0%;\\-0.0%;0.0%";

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fuente = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Calibri", size: 10.5, color: { argb: TEXTO }, ...o });
const f = (formula: string, result?: number | string): ExcelJS.CellFormulaValue => ({ formula, result } as ExcelJS.CellFormulaValue);

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const dm = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES[m - 1]}`;
};
const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Lunes de la semana de una fecha "YYYY-MM-DD..." */
const lunes = (iso: string) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
};
const etiquetaSemana = (ini: string) => `${dm(ini)} - ${dm(sumarDias(ini, 6))}`;
const textoAFecha = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z") : null);

function titulo(ws: ExcelJS.Worksheet, texto: string, sub: string, cols: number) {
  ws.getCell("A1").value = texto;
  ws.getCell("A1").font = fuente({ size: 17, bold: true, color: { argb: OSCURO } });
  ws.mergeCells(2, 1, 2, cols);
  ws.getCell("A2").value = sub;
  ws.getCell("A2").font = fuente({ color: { argb: SUTIL } });
  ws.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(2).height = 32;
}

function barra(ws: ExcelJS.Worksheet, fila: number, texto: string, cols: number) {
  ws.mergeCells(fila, 1, fila, cols);
  const c = ws.getCell(fila, 1);
  c.value = texto;
  c.font = fuente({ size: 13, bold: true, color: { argb: "FFFFFFFF" } });
  c.fill = fill(OSCURO);
  c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(fila).height = 22;
}

function encabezados(ws: ExcelJS.Worksheet, fila: number, textos: string[], color = MORADO) {
  textos.forEach((t, i) => {
    const c = ws.getCell(fila, i + 1);
    c.value = t;
    c.font = fuente({ bold: true, color: { argb: "FFFFFFFF" } });
    c.fill = fill(color);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(fila).height = 30;
}

// ---------------------------------------------------------------------
// Hoja Datos (una fila por orden; las demás hojas la leen con fórmulas)
// ---------------------------------------------------------------------
function hojaDatos(wb: ExcelJS.Workbook, t: RappiTurbo) {
  const ws = wb.addWorksheet("Datos", { views: [{ state: "frozen", ySplit: 1 }] });
  const cab = [
    "Order ID", "Restaurante", "Creada en", "Semana", "Fase Turbo", "Estatus de orden",
    "Tiempo aceptación restaurante (min)", "Tiempo aceptación repartidor (min)", "Tiempo llegar a tienda (min)",
    "Tiempo para recoger (min)", "Tiempo para entregar (min)", "Tiempo para completar (min)",
    "Total <45", "Total <60", "Total >60", "Sin cooking <45", "Sin cooking <60", "Sin cooking >60",
    "Aceptada en", "Completada en", "Ciclo total: Aceptada→Completada (min)",
  ];
  cab.forEach((h, i) => {
    const c = ws.getCell(1, i + 1);
    c.value = h;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = fill(MORADO);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(1).height = 45;
  [38, 30, 18, 20, 13, 15, 14, 14, 14, 14, 14, 14, 9, 9, 9, 10, 10, 10, 18, 18, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  t.datos.forEach((d, i) => {
    const r = i + 2;
    const [id, tienda, creada, estatus, tRest, tRep, tLlegar, tRecoger, tEntregar, tCompletar, total, sinCook, acep, comp, act] = d;
    const fecha = textoAFecha(creada);
    const activ = act ?? t.activacion;
    const [ay, am, ad] = activ.split("-").map(Number);
    const fila = ws.getRow(r);
    fila.getCell(1).value = id;
    fila.getCell(2).value = tienda;
    fila.getCell(3).value = fecha;
    fila.getCell(3).numFmt = "m/d/yy h:mm";
    fila.getCell(4).value = etiquetaSemana(lunes(creada));
    fila.getCell(5).value = f(`IF(C${r}<DATE(${ay},${am},${ad}),"Pre-Turbo","Post-Turbo")`, creada.slice(0, 10) < activ ? "Pre-Turbo" : "Post-Turbo");
    fila.getCell(6).value = estatus;
    [tRest, tRep, tLlegar, tRecoger, tEntregar, tCompletar].forEach((v, k) => {
      fila.getCell(7 + k).value = v;
      fila.getCell(7 + k).numFmt = "0.00";
    });
    const marca = (cond: boolean) => (cond ? 1 : null);
    fila.getCell(13).value = marca(total != null && total < 45);
    fila.getCell(14).value = marca(total != null && total < 60);
    fila.getCell(15).value = marca(total != null && total > 60);
    fila.getCell(16).value = marca(sinCook != null && sinCook < 45);
    fila.getCell(17).value = marca(sinCook != null && sinCook < 60);
    fila.getCell(18).value = marca(sinCook != null && sinCook > 60);
    for (let k = 13; k <= 18; k++) fila.getCell(k).alignment = { horizontal: "center" };
    fila.getCell(19).value = textoAFecha(acep);
    fila.getCell(20).value = textoAFecha(comp);
    fila.getCell(19).numFmt = "m/d/yy h:mm";
    fila.getCell(20).numFmt = "m/d/yy h:mm";
    const ciclo = acep && comp ? (Date.parse(comp.replace(" ", "T")) - Date.parse(acep.replace(" ", "T"))) / 60000 : "";
    fila.getCell(21).value = f(`IF(OR(S${r}="",T${r}=""),"",(T${r}-S${r})*1440)`, ciclo);
    fila.getCell(21).numFmt = "0.00";
  });
  ws.autoFilter = { from: "A1", to: `U${Math.max(2, t.datos.length + 1)}` };
  return t.datos.length + 1;
}

// ---------------------------------------------------------------------
// Hoja Comparativa Turbo (antes vs después) + control sin Turbo
// ---------------------------------------------------------------------
function hojaComparativa(wb: ExcelJS.Workbook, t: RappiTurbo, ult: number, nTiendas: number) {
  const ws = wb.addWorksheet("Comparativa Turbo");
  [34, 15, 13, 15, 13, 15].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const R = (col: string) => `Datos!$${col}$2:$${col}$${ult}`;
  const fase = R("E");
  const antes = sumarDias(t.activacion, -1);
  titulo(
    ws,
    "Comparativa: Antes vs. Después de Rappi Turbo",
    `Rappi Turbo se activó el ${dm(t.activacion)} ${t.activacion.slice(0, 4)} (fecha de cada tienda en la hoja Datos). Pre-Turbo: del ${dm(t.periodo.desde)} al ${dm(antes)}; Post-Turbo: del ${dm(t.activacion)} al ${dm(t.periodo.hasta)}. Solo órdenes entregadas por Rappi en las ${nTiendas} tiendas Turbo.`,
    6
  );

  // 1. Volumen y estatus
  let fila = 4;
  barra(ws, fila, "1. Volumen y estatus de las órdenes", 6);
  encabezados(ws, ++fila, ["Estatus", "Pre-Turbo\n(n)", "Pre-Turbo\n(%)", "Post-Turbo\n(n)", "Post-Turbo\n(%)", "Δ puntos %"]);
  const filaTotal = fila + ESTATUS.length + 1;
  for (const [nombre, valor, fondo, color] of ESTATUS) {
    const r = ++fila;
    ws.getCell(r, 1).value = nombre;
    ws.getCell(r, 2).value = f(`COUNTIFS(${fase},"Pre-Turbo",${R("F")},"${valor}")`);
    ws.getCell(r, 3).value = f(`B${r}/$B$${filaTotal}`);
    ws.getCell(r, 4).value = f(`COUNTIFS(${fase},"Post-Turbo",${R("F")},"${valor}")`);
    ws.getCell(r, 5).value = f(`D${r}/$D$${filaTotal}`);
    ws.getCell(r, 6).value = f(`(E${r}-C${r})*100`);
    for (let k = 1; k <= 6; k++) {
      const c = ws.getCell(r, k);
      c.fill = fill(fondo);
      c.font = k === 1 ? fuente({ bold: true, color: { argb: color } }) : fuente();
      c.alignment = { horizontal: k === 1 ? "left" : "center" };
    }
    ws.getCell(r, 2).numFmt = "0";
    ws.getCell(r, 4).numFmt = "0";
    ws.getCell(r, 3).numFmt = "0.0%";
    ws.getCell(r, 5).numFmt = "0.0%";
    ws.getCell(r, 6).numFmt = PTS;
  }
  fila = filaTotal;
  ws.getCell(fila, 1).value = "TOTAL";
  ws.getCell(fila, 2).value = f(`COUNTIF(${fase},"Pre-Turbo")`);
  ws.getCell(fila, 3).value = 1;
  ws.getCell(fila, 4).value = f(`COUNTIF(${fase},"Post-Turbo")`);
  ws.getCell(fila, 5).value = 1;
  for (let k = 1; k <= 6; k++) {
    const c = ws.getCell(fila, k);
    c.fill = fill(GRIS);
    c.font = fuente({ bold: true, color: { argb: k === 1 ? OSCURO : TEXTO } });
    c.alignment = { horizontal: k === 1 ? "left" : "center" };
  }
  ws.getCell(fila, 3).numFmt = "0.0%";
  ws.getCell(fila, 5).numFmt = "0.0%";

  // 2 y 3. Tiempos por etapa
  const bloqueTiempos = (tituloTxt: string, soloCompletas: boolean) => {
    fila += 2;
    barra(ws, fila, tituloTxt, 6);
    encabezados(ws, ++fila, ["Etapa", "Pre-Turbo\n(min)", "Post-Turbo\n(min)", "Δ (min)", "Δ (%)", "¿Mejoró?"]);
    for (const [nombre, col] of ETAPAS) {
      const r = ++fila;
      const extra = soloCompletas ? `,${R("F")},"COMPLETE"` : "";
      ws.getCell(r, 1).value = nombre;
      ws.getCell(r, 2).value = f(`IFERROR(AVERAGEIFS(${R(col)},${fase},"Pre-Turbo"${extra}),"")`);
      ws.getCell(r, 3).value = f(`IFERROR(AVERAGEIFS(${R(col)},${fase},"Post-Turbo"${extra}),"")`);
      ws.getCell(r, 4).value = f(`IF(OR(B${r}="",C${r}=""),"",C${r}-B${r})`);
      ws.getCell(r, 5).value = f(`IF(OR(B${r}="",B${r}=0,C${r}=""),"",D${r}/B${r})`);
      ws.getCell(r, 6).value = f(`IF(D${r}="","",IF(D${r}<=0,"Sí — bajó","No — subió"))`);
      ws.getCell(r, 1).font = fuente({ bold: true, color: { argb: OSCURO } });
      for (let k = 2; k <= 6; k++) {
        ws.getCell(r, k).font = fuente();
        ws.getCell(r, k).alignment = { horizontal: "center" };
      }
      [2, 3, 4].forEach((k) => (ws.getCell(r, k).numFmt = "0.00"));
      ws.getCell(r, 5).numFmt = PCT_DELTA;
    }
  };
  bloqueTiempos("2. Tiempos promedio por etapa — todos los estatus", false);
  bloqueTiempos("3. Tiempos promedio por etapa — sólo órdenes Completas", true);

  // 4. Distribución del tiempo total
  fila += 2;
  barra(ws, fila, "4. Distribución del tiempo total de la orden (todos los estatus)", 6);
  encabezados(ws, ++fila, ["Franja", "Pre-Turbo\n(n)", "Pre-Turbo\n(%)", "Post-Turbo\n(n)", "Post-Turbo\n(%)", "Δ puntos %"]);
  FRANJAS.forEach(([nombre, col], i) => {
    if (i === 3) {
      fila++;
      encabezados(ws, ++fila, ["Franja", "Pre-Turbo\n(n)", "Pre-Turbo\n(%)", "Post-Turbo\n(n)", "Post-Turbo\n(%)", "Δ puntos %"]);
    }
    const r = ++fila;
    ws.getCell(r, 1).value = nombre;
    ws.getCell(r, 2).value = f(`COUNTIFS(${fase},"Pre-Turbo",${R(col)},1)`);
    ws.getCell(r, 3).value = f(`IFERROR(B${r}/$B$${filaTotal},0)`);
    ws.getCell(r, 4).value = f(`COUNTIFS(${fase},"Post-Turbo",${R(col)},1)`);
    ws.getCell(r, 5).value = f(`IFERROR(D${r}/$D$${filaTotal},0)`);
    ws.getCell(r, 6).value = f(`(E${r}-C${r})*100`);
    ws.getCell(r, 1).font = fuente({ bold: true, color: { argb: OSCURO } });
    for (let k = 2; k <= 6; k++) {
      ws.getCell(r, k).font = fuente();
      ws.getCell(r, k).alignment = { horizontal: "center" };
    }
    ws.getCell(r, 3).numFmt = "0.0%";
    ws.getCell(r, 5).numFmt = "0.0%";
    ws.getCell(r, 6).numFmt = PTS;
  });

  // 5. Control: tiendas SIN Turbo en las mismas fechas (valores)
  const get = (turbo: boolean, post: boolean) => t.resumen.find((x) => x.turbo === turbo && x.post === post);
  const ctrlPre = get(false, false);
  const ctrlPost = get(false, true);
  const tPre = get(true, false);
  const tPost = get(true, true);
  fila += 2;
  barra(ws, fila, "5. ¿Es por Turbo? Mismas fechas en las tiendas SIN Turbo (Rappi)", 6);
  encabezados(ws, ++fila, ["Indicador", "Turbo\nPre", "Turbo\nPost", "Sin Turbo\nPre", "Sin Turbo\nPost", "Diferencia\nde mejora"]);
  const filasCtrl: [string, (x?: TurboResumen) => number | null, string, boolean][] = [
    ["% Completas", (x) => (x && x.n ? x.completas / x.n : null), "0.0%", false],
    ["% Devueltas", (x) => (x && x.n ? x.devueltas / x.n : null), "0.0%", true],
    ["% Canceladas", (x) => (x && x.n ? x.canceladas / x.n : null), "0.0%", true],
    ["Aceptación de repartidor (min)", (x) => x?.t_rep ?? null, "0.00", true],
    ["Llegar a tienda (min)", (x) => x?.t_llegar ?? null, "0.00", true],
    ["Recoger pedido (min)", (x) => x?.t_recoger ?? null, "0.00", true],
    ["Entregar (min)", (x) => x?.t_entregar ?? null, "0.00", true],
    ["Ciclo total (min)", (x) => x?.ciclo ?? null, "0.00", true],
    ["% Tiempo total > 60 min", (x) => (x && x.n ? x.gt60 / x.n : null), "0.0%", true],
  ];
  for (const [nombre, val, fmt] of filasCtrl) {
    const r = ++fila;
    ws.getCell(r, 1).value = nombre;
    ws.getCell(r, 2).value = val(tPre);
    ws.getCell(r, 3).value = val(tPost);
    ws.getCell(r, 4).value = val(ctrlPre);
    ws.getCell(r, 5).value = val(ctrlPost);
    // (cambio Turbo) − (cambio sin Turbo): negativo = Turbo mejoró más (en tiempos y % malos)
    ws.getCell(r, 6).value = f(`IF(COUNT(B${r}:E${r})<4,"",(C${r}-B${r})-(E${r}-D${r}))`);
    ws.getCell(r, 1).font = fuente({ bold: true, color: { argb: OSCURO } });
    for (let k = 2; k <= 6; k++) {
      ws.getCell(r, k).numFmt = fmt;
      ws.getCell(r, k).font = fuente();
      ws.getCell(r, k).alignment = { horizontal: "center" };
    }
  }
  fila += 1;
  ws.mergeCells(fila + 1, 1, fila + 1, 6);
  ws.getCell(fila + 1, 1).value =
    "Diferencia de mejora = (cambio en tiendas Turbo) − (cambio en tiendas sin Turbo). En tiempos, devueltas y canceladas, un número negativo indica que Turbo mejoró más que el resto; en % Completas, uno positivo.";
  ws.getCell(fila + 1, 1).font = fuente({ size: 9.5, color: { argb: SUTIL } });
  ws.getCell(fila + 1, 1).alignment = { wrapText: true };
  ws.getRow(fila + 1).height = 30;
}

// ---------------------------------------------------------------------
// Hoja Comparativa Semanal
// ---------------------------------------------------------------------
function hojaSemanal(wb: ExcelJS.Workbook, t: RappiTurbo, ult: number) {
  const ws = wb.addWorksheet("Comparativa Semanal");
  const semanas = Array.from(new Set(t.datos.map((d) => lunes(d[2]))))
    .sort()
    .map(etiquetaSemana);
  const R = (col: string) => `Datos!$${col}$2:$${col}$${ult}`;
  const nCols = 1 + semanas.length * 2 + 1;
  ws.getColumn(1).width = 34;
  for (let i = 2; i <= nCols; i++) ws.getColumn(i).width = 13;
  titulo(
    ws,
    `Tendencia semanal: ${dm(t.periodo.desde)} - ${dm(t.periodo.hasta)} (desde antes de Rappi Turbo hasta hoy)`,
    "Solo tiendas Turbo, órdenes entregadas por Rappi.",
    Math.min(nCols, 8)
  );
  const colN = (i: number) => 2 + i * 2;
  const L = (n: number) => ws.getColumn(n).letter;

  // 1. Volumen y estatus
  let fila = 3;
  barra(ws, fila, "1. Volumen y estatus de las órdenes", nCols);
  encabezados(ws, ++fila, [
    "Estatus",
    ...semanas.flatMap((s) => [`${s}\n(n)`, `${s}\n(%)`]),
    "Δ puntos %\n(última - primera)",
  ]);
  const filaTot = fila + ESTATUS.length + 1;
  for (const [nombre, valor, fondo, color] of ESTATUS) {
    const r = ++fila;
    ws.getCell(r, 1).value = nombre;
    semanas.forEach((s, i) => {
      ws.getCell(r, colN(i)).value = f(`COUNTIFS(${R("D")},"${s}",${R("F")},"${valor}")`);
      ws.getCell(r, colN(i) + 1).value = f(`IFERROR(${L(colN(i))}${r}/${L(colN(i))}$${filaTot},0)`);
      ws.getCell(r, colN(i) + 1).numFmt = "0.0%";
    });
    if (semanas.length) {
      ws.getCell(r, nCols).value = f(`(${L(colN(semanas.length - 1) + 1)}${r}-C${r})*100`);
      ws.getCell(r, nCols).numFmt = PTS;
    }
    for (let k = 1; k <= nCols; k++) {
      ws.getCell(r, k).fill = fill(fondo);
      ws.getCell(r, k).font = k === 1 ? fuente({ bold: true, color: { argb: color } }) : fuente();
      ws.getCell(r, k).alignment = { horizontal: k === 1 ? "left" : "center" };
    }
  }
  fila = filaTot;
  ws.getCell(fila, 1).value = "TOTAL";
  semanas.forEach((s, i) => {
    ws.getCell(fila, colN(i)).value = f(`COUNTIF(${R("D")},"${s}")`);
    ws.getCell(fila, colN(i) + 1).value = 1;
    ws.getCell(fila, colN(i) + 1).numFmt = "0.0%";
  });
  for (let k = 1; k <= nCols; k++) {
    ws.getCell(fila, k).fill = fill(GRIS);
    ws.getCell(fila, k).font = fuente({ bold: true });
    ws.getCell(fila, k).alignment = { horizontal: k === 1 ? "left" : "center" };
  }

  // 2 y 3. Tiempos por etapa
  const bloque = (tituloTxt: string, soloCompletas: boolean) => {
    fila += 2;
    barra(ws, fila, tituloTxt, semanas.length + 3);
    encabezados(ws, ++fila, ["Etapa", ...semanas.map((s) => `${s}\n(min)`), "Δ (min)\núlt.-1a.", "Δ (%)"]);
    for (const [nombre, col] of ETAPAS) {
      const r = ++fila;
      const extra = soloCompletas ? `,${R("F")},"COMPLETE"` : "";
      ws.getCell(r, 1).value = nombre;
      ws.getCell(r, 1).font = fuente({ bold: true, color: { argb: OSCURO } });
      semanas.forEach((s, i) => {
        const c = ws.getCell(r, 2 + i);
        c.value = f(`IFERROR(AVERAGEIFS(${R(col)},${R("D")},"${s}"${extra}),"")`);
        c.numFmt = "0.00";
        c.alignment = { horizontal: "center" };
        c.font = fuente();
      });
      const ultima = L(1 + semanas.length);
      const dCol = 2 + semanas.length;
      ws.getCell(r, dCol).value = f(`IF(OR(B${r}="",${ultima}${r}=""),"",${ultima}${r}-B${r})`);
      ws.getCell(r, dCol + 1).value = f(`IF(OR(B${r}="",B${r}=0,${ultima}${r}=""),"",(${ultima}${r}-B${r})/B${r})`);
      ws.getCell(r, dCol).numFmt = "0.00";
      ws.getCell(r, dCol + 1).numFmt = PCT_DELTA;
      [dCol, dCol + 1].forEach((k) => {
        ws.getCell(r, k).alignment = { horizontal: "center" };
        ws.getCell(r, k).font = fuente();
      });
    }
  };
  bloque("2. Tiempos promedio por etapa — todos los estatus", false);
  bloque("3. Tiempos promedio por etapa — sólo órdenes Completas", true);

  // 4. Distribución
  fila += 2;
  barra(ws, fila, "4. Distribución del tiempo total de la orden (todos los estatus)", nCols);
  encabezados(ws, ++fila, ["Franja", ...semanas.flatMap((s) => [`${s}\n(n)`, `${s}\n(%)`])]);
  for (const [nombre, col] of FRANJAS) {
    const r = ++fila;
    ws.getCell(r, 1).value = nombre;
    ws.getCell(r, 1).font = fuente({ bold: true, color: { argb: OSCURO } });
    semanas.forEach((s, i) => {
      ws.getCell(r, colN(i)).value = f(`COUNTIFS(${R("D")},"${s}",${R(col)},1)`);
      ws.getCell(r, colN(i) + 1).value = f(`IFERROR(${L(colN(i))}${r}/${L(colN(i))}$${filaTot},0)`);
      ws.getCell(r, colN(i) + 1).numFmt = "0.0%";
      ws.getCell(r, colN(i)).alignment = { horizontal: "center" };
      ws.getCell(r, colN(i) + 1).alignment = { horizontal: "center" };
    });
  }

  // Tabla para gráficas (como en tu archivo)
  fila += 3;
  ws.getCell(fila, 1).value = "Tendencia (para gráficas)";
  ws.getCell(fila, 1).font = fuente({ size: 11, bold: true, color: { argb: OSCURO } });
  encabezados(ws, ++fila, ["Semana", "% Completas", "% Devueltas", "% Canceladas", "Ciclo total (min)"], PERI);
  semanas.forEach((s, i) => {
    const r = ++fila;
    const pc = L(colN(i) + 1);
    ws.getCell(r, 1).value = s;
    ws.getCell(r, 2).value = f(`${pc}5`);
    ws.getCell(r, 3).value = f(`${pc}6`);
    ws.getCell(r, 4).value = f(`${pc}7`);
    ws.getCell(r, 5).value = f(`IFERROR(AVERAGEIFS(${R("U")},${R("D")},"${s}"),"")`);
    [2, 3, 4].forEach((k) => (ws.getCell(r, k).numFmt = "0.0%"));
    ws.getCell(r, 5).numFmt = "0.00";
  });
}

/** Excel de Rappi Turbo: Comparativa Turbo, Comparativa Semanal y Datos. */
export async function construirExcelTurbo(t: RappiTurbo): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Panel Operativo KFC";
  wb.calcProperties.fullCalcOnLoad = true; // que Excel calcule todas las fórmulas al abrir
  const nTiendas = t.tiendas.filter((x) => x.activa).length;
  // Las hojas de resumen van primero, pero dependen del número de filas de Datos
  const ult = Math.max(2, t.datos.length + 1);
  hojaComparativa(wb, t, ult, nTiendas);
  hojaSemanal(wb, t, ult);
  hojaDatos(wb, t);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
