// Factura mensual de KFC.
//
// La factura se nombra con el MES DE PAGO y se arma con las órdenes del
// MES OPERADO (el mes anterior). Ej.: factura "Octubre 2026" = órdenes de
// septiembre 2026.
//
// Reglas (las mismas de tus facturas en Excel):
// · Órdenes = completadas + devueltas, por día de creación.
// · Tiendas a facturar = las de la factura anterior + las nuevas − las bajas.
//   Las que no tuvieron órdenes se siguen cobrando completas mientras no
//   tengan baja.
// · Nueva = no estaba en la factura anterior y tuvo su primera orden en el
//   mes operado. Días a cobrar = de su primera orden al fin de mes.
// · Cobro = tiendas × costo mensual + proporcional (días × costo ÷ días del
//   mes operado), Delivery y Mi Flotilla por separado; + IVA.

export type TipoTienda = "delivery" | "flotilla";
export type EstadoTienda = "continua" | "nueva" | "sin_ordenes" | "alta_manual" | "baja";

export interface OrdenesDia {
  restaurant: string;
  dia: number;
  ordenes: number;
}

export interface TiendaBase {
  tienda: string;
  codigo: string;
  tipo: TipoTienda;
}

export interface AjusteFactura {
  codigo: string;
  tienda: string;
  accion: "baja" | "alta" | null;
  nota: string | null;
}

export interface FilaFactura {
  tienda: string;
  codigo: string;
  tipo: TipoTienda;
  estado: EstadoTienda;
  /** Órdenes por día del mes operado (índice 0 = día 1) */
  dias: number[];
  total: number;
  primerDia: number | null;
  diasCobrar: number | null;
  monto: number | null;
  nota: string | null;
}

export interface ResumenFactura {
  tiendasFacturar: number;
  continuas: number;
  sinOrdenes: number;
  altasManuales: number;
  bajas: number;
  nuevasDelivery: number;
  nuevasFlotilla: number;
  diasDelivery: number;
  diasFlotilla: number;
  costoMensual: number;
  costoDiario: number;
  montoBase: number;
  proporcionalDelivery: number;
  proporcionalFlotilla: number;
  subtotal: number;
  iva: number;
  total: number;
  ordenesMes: number;
}

export interface CalculoFactura {
  mesPago: string; // "2026-10-01"
  mesOperado: string; // "2026-09-01"
  diasMes: number; // días del mes operado
  filas: FilaFactura[];
  resumen: ResumenFactura;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const codigoDe = (nombre: string) => nombre.trim().match(/^\d+/)?.[0] ?? nombre.trim().toUpperCase();
export const tipoDe = (nombre: string): TipoTienda => (/\sMF$/i.test(nombre.trim()) ? "flotilla" : "delivery");

export function partesMes(iso: string) {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return { y, m };
}

/** "2026-10-01" -> "2026-09-01" */
export function mesAnterior(iso: string) {
  const { y, m } = partesMes(iso);
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
}

export function mesSiguiente(iso: string) {
  const { y, m } = partesMes(iso);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function diasDelMes(iso: string) {
  const { y, m } = partesMes(iso);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function ultimoDia(iso: string) {
  return `${iso.slice(0, 8)}${String(diasDelMes(iso)).padStart(2, "0")}`;
}

/** "Octubre" */
export function nombreMes(iso: string) {
  const n = MESES[partesMes(iso).m - 1];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "Octubre 2026" */
export function nombreMesAnio(iso: string) {
  return `${nombreMes(iso)} ${partesMes(iso).y}`;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularFactura(p: {
  mesPago: string;
  ordenes: OrdenesDia[];
  base: TiendaBase[];
  ajustes: AjusteFactura[];
  costoMensual: number;
  iva: number;
}): CalculoFactura {
  const mesOperado = mesAnterior(p.mesPago);
  const diasMes = diasDelMes(mesOperado);
  const costoDiario = p.costoMensual / diasMes;

  // Órdenes del mes por tienda (por código, para que no importe si cambió el nombre)
  const porCodigo = new Map<string, { tienda: string; dias: number[] }>();
  for (const o of p.ordenes) {
    if (!o.restaurant || o.dia < 1 || o.dia > diasMes) continue;
    const cod = codigoDe(o.restaurant);
    const reg = porCodigo.get(cod) ?? { tienda: o.restaurant.trim(), dias: Array(diasMes).fill(0) };
    reg.dias[o.dia - 1] += o.ordenes;
    porCodigo.set(cod, reg);
  }

  const ajustes = new Map(p.ajustes.map((a) => [a.codigo, a]));
  const base = new Map(p.base.map((b) => [b.codigo, b]));
  const filas: FilaFactura[] = [];
  const vistos = new Set<string>();

  const crear = (codigo: string, tienda: string, tipoBase: TipoTienda | null, enBase: boolean) => {
    const datos = porCodigo.get(codigo);
    const dias = datos?.dias ?? Array(diasMes).fill(0);
    const total = dias.reduce((s, n) => s + n, 0);
    const idx = dias.findIndex((n) => n > 0);
    const primerDia = idx >= 0 ? idx + 1 : null;
    const aj = ajustes.get(codigo);
    const nombre = datos?.tienda ?? tienda;
    const tipo = tipoBase ?? tipoDe(nombre);

    let estado: EstadoTienda;
    if (aj?.accion === "baja") estado = "baja";
    else if (enBase) estado = total > 0 ? "continua" : "sin_ordenes";
    else if (total > 0) estado = "nueva";
    else estado = "alta_manual";

    const diasCobrar = estado === "nueva" && primerDia ? diasMes - primerDia + 1 : null;
    filas.push({
      tienda: nombre,
      codigo,
      tipo,
      estado,
      dias,
      total,
      primerDia,
      diasCobrar,
      monto: diasCobrar != null ? redondear(diasCobrar * costoDiario) : null,
      nota: aj?.nota ?? null,
    });
    vistos.add(codigo);
  };

  for (const b of p.base) crear(b.codigo, b.tienda, tipoDe(porCodigo.get(b.codigo)?.tienda ?? b.tienda), true);
  for (const [cod, d] of porCodigo) if (!vistos.has(cod)) crear(cod, d.tienda, null, base.has(cod));
  for (const a of p.ajustes) if (!vistos.has(a.codigo) && a.accion === "alta") crear(a.codigo, a.tienda, null, false);

  // Orden de la hoja: más órdenes primero; las que no tuvieron órdenes, al final
  filas.sort((a, b) => b.total - a.total || a.tienda.localeCompare(b.tienda));

  const facturables = filas.filter((f) => f.estado !== "baja");
  const nuevasD = filas.filter((f) => f.estado === "nueva" && f.tipo === "delivery");
  const nuevasF = filas.filter((f) => f.estado === "nueva" && f.tipo === "flotilla");
  const diasDelivery = nuevasD.reduce((s, f) => s + (f.diasCobrar ?? 0), 0);
  const diasFlotilla = nuevasF.reduce((s, f) => s + (f.diasCobrar ?? 0), 0);
  const montoBase = facturables.length * p.costoMensual;
  const proporcionalDelivery = diasDelivery * costoDiario;
  const proporcionalFlotilla = diasFlotilla * costoDiario;
  const subtotal = montoBase + proporcionalDelivery + proporcionalFlotilla;
  const iva = subtotal * p.iva;

  return {
    mesPago: p.mesPago,
    mesOperado,
    diasMes,
    filas,
    resumen: {
      tiendasFacturar: facturables.length,
      continuas: filas.filter((f) => f.estado === "continua").length,
      sinOrdenes: filas.filter((f) => f.estado === "sin_ordenes").length,
      altasManuales: filas.filter((f) => f.estado === "alta_manual").length,
      bajas: filas.filter((f) => f.estado === "baja").length,
      nuevasDelivery: nuevasD.length,
      nuevasFlotilla: nuevasF.length,
      diasDelivery,
      diasFlotilla,
      costoMensual: p.costoMensual,
      costoDiario: redondear(costoDiario),
      montoBase: redondear(montoBase),
      proporcionalDelivery: redondear(proporcionalDelivery),
      proporcionalFlotilla: redondear(proporcionalFlotilla),
      subtotal: redondear(subtotal),
      iva: redondear(iva),
      total: redondear(subtotal + iva),
      ordenesMes: filas.reduce((s, f) => s + f.total, 0),
    },
  };
}

export const ESTADOS: Record<EstadoTienda, { label: string; clase: string }> = {
  continua: { label: "Continúa", clase: "bg-ink-100 text-ink-700" },
  nueva: { label: "Nueva", clase: "bg-success-bg text-success" },
  sin_ordenes: { label: "Sin órdenes", clase: "bg-warning-bg text-warning" },
  alta_manual: { label: "Alta sin órdenes", clase: "bg-brand-50 text-brand-700" },
  baja: { label: "Baja", clase: "bg-danger-bg text-danger" },
};
