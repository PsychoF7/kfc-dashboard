// Tipos y textos de la sección Devoluciones y cancelaciones.
// Se usan tanto en el dashboard como en el Excel descargable, para que
// ambos digan exactamente lo mismo.

export const META_DICIEMBRE = 0.02;

export interface DevResumen {
  total: number;
  devueltas: number;
  canceladas: number;
  pct_dev: number | null;
  pct_canc: number | null;
  prev_total: number;
  prev_devueltas: number;
  prev_canceladas: number;
  prev_pct_dev: number | null;
  prev_pct_canc: number | null;
  prev_dup_gps: number;
  prev_dup_telefonos: number;
  prev_dup_direcciones: number;
}

export interface DevRangoEspera {
  etiqueta: string;
  ordenes: number;
  devueltas: number;
}

export interface DevTiendaEspera {
  tienda: string;
  ordenes: number;
  con_dato: number;
  devueltas: number;
  espera_prom: number;
  mas_15: number;
}

export interface DevTiendaCalidad {
  tienda: string;
  ordenes: number;
  devueltas: number;
  cp_faltante: number;
  calle_sin_numero: number;
  colonia_vacia: number;
  problema: number;
}

export interface DevCaso {
  order_id: string;
  id_corto: string;
  fecha: string;
  tienda: string;
  telefono: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  espera: number;
  problema_direccion: boolean;
  nota: string | null;
}

export interface DevGrupo {
  clave: string;
  latitud: number | null;
  longitud: number | null;
  tiendas: string | null;
  ordenes: number;
  devueltas: number;
  dev_efectivo: number;
  dev_tarjeta: number;
  pct_dev: number;
  monto_efectivo: number;
  monto_tarjeta: number;
  pct_efectivo: number;
  n_telefonos: number;
  n_direcciones: number;
  n_direcciones_completas: number;
  n_dias: number;
  telefonos: string | null;
  direcciones: string | null;
  fechas_ids: string | null;
  nota: string | null;
}

export interface DevRankingFila {
  tienda: string;
  ordenes: number;
  devueltas: number;
  canceladas: number;
  pct_problema: number;
}

export interface DevPersisteTienda {
  tienda: string;
  pct_mes: number;
  pct_semana: number | null;
  ordenes_semana: number;
}

export interface DevPersisteGrupo {
  clave: string;
  latitud: number | null;
  longitud: number | null;
  tiendas: string | null;
  ordenes_mes: number;
  pct_mes: number;
  ordenes_semana: number;
  dev_efectivo: number;
  dev_tarjeta: number;
  pct_semana: number;
  monto_devuelto: number;
  telefonos?: string | null;
  direcciones?: string | null;
  fechas_ids: string | null;
}

export interface DevReporte {
  semana: { inicio: string; fin: string };
  linea_base: { inicio: string; fin: string };
  meses_con_data: number;
  resumen: DevResumen;
  espera_rangos: DevRangoEspera[];
  espera_tiendas: DevTiendaEspera[];
  calidad_tiendas: DevTiendaCalidad[];
  casos: DevCaso[];
  duplicados_gps: DevGrupo[];
  duplicados_telefono: DevGrupo[];
  duplicados_direccion: DevGrupo[];
  ranking_peores: DevRankingFila[];
  ranking_mejores: DevRankingFila[];
  persiste: {
    tiendas: DevPersisteTienda[];
    total_gps: number;
    total_telefonos: number;
    total_direcciones: number;
    gps: DevPersisteGrupo[];
    telefonos: DevPersisteGrupo[];
    direcciones: DevPersisteGrupo[];
  };
}

export interface DevSemanaTendencia {
  semana_inicio: string;
  total: number;
  devueltas: number;
  canceladas: number;
  pct_dev: number;
  pct_canc: number;
}

export interface DevOpciones {
  incluirReturning: boolean;
  incluirRechazadas: boolean;
}

export type TipoDuplicado = "gps" | "telefono" | "direccion";

// ---------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partes(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m: m - 1, d };
}

/** "del 21 al 27 de septiembre" / "del 31 de agosto al 6 de septiembre" */
export function rangoLargo(inicio: string, fin: string) {
  const a = partes(inicio);
  const b = partes(fin);
  if (a.m === b.m) return `del ${a.d} al ${b.d} de ${MESES[b.m]}`;
  return `del ${a.d} de ${MESES[a.m]} al ${b.d} de ${MESES[b.m]}`;
}

/** "21-27 sep" / "31 ago - 6 sep" */
export function rangoCorto(inicio: string, fin: string) {
  const a = partes(inicio);
  const b = partes(fin);
  if (a.m === b.m) return `${a.d}-${b.d} ${MESES_CORTOS[b.m]}`;
  return `${a.d} ${MESES_CORTOS[a.m]} - ${b.d} ${MESES_CORTOS[b.m]}`;
}

/** "21 AL 27 DE SEPTIEMBRE 2026" */
export function rangoTitulo(inicio: string, fin: string) {
  const a = partes(inicio);
  const b = partes(fin);
  const txt =
    a.m === b.m
      ? `${a.d} al ${b.d} de ${MESES[b.m]} ${b.y}`
      : `${a.d} de ${MESES[a.m]} al ${b.d} de ${MESES[b.m]} ${b.y}`;
  return txt.toUpperCase();
}

export function nombreMes(iso: string) {
  return MESES[partes(iso).m];
}

export function sumarDias(iso: string, dias: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function mapsUrl(lat: number | null, lon: number | null) {
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

// ---------------------------------------------------------------------
// Notas automáticas de duplicados (mismo texto que tu reporte)
// ---------------------------------------------------------------------
function colaNota(g: DevGrupo) {
  let s = "";
  if (g.pct_efectivo >= 0.75) s += ` ${Math.round(g.pct_efectivo * 100)}% pago en efectivo;`;
  s += g.n_dias === 1 ? " todas el mismo dia." : ` repartidas en ${g.n_dias} dias distintos.`;
  return s;
}

export function esAlerta(tipo: TipoDuplicado, g: DevGrupo) {
  if (tipo === "gps") return g.n_telefonos > 1 || g.n_direcciones > 1;
  if (tipo === "telefono") return g.n_direcciones_completas > 1;
  return g.n_telefonos > 1;
}

export function notaDuplicado(tipo: TipoDuplicado, g: DevGrupo) {
  const pct = `${Math.round(g.pct_dev * 100)}%`;
  const alerta = esAlerta(tipo, g);
  let base: string;
  if (tipo === "gps") {
    base = alerta
      ? `ALERTA: mismo punto GPS exacto usado por ${g.n_telefonos} teléfono(s) y ${g.n_direcciones} Dirección(es) escritas distintas, con ${pct} de Devolución.`
      : `Mismo cliente/Dirección repitiendo en el mismo punto exacto, ${pct} de Devolución.`;
  } else if (tipo === "telefono") {
    base = alerta
      ? `ALERTA: el mismo teléfono ordeno a ${g.n_direcciones_completas} Direcciones distintas, con ${pct} de Devolución.`
      : `Mismo teléfono y misma Dirección repitiendo, ${pct} de Devolución.`;
  } else {
    base = alerta
      ? `ALERTA: la misma Dirección escrita fue usada por ${g.n_telefonos} teléfonos distintos, con ${pct} de Devolución.`
      : `Mismo teléfono repitiendo esta Dirección, ${pct} de Devolución.`;
  }
  return base + colaNota(g);
}

// ---------------------------------------------------------------------
// Textos del Resumen
// ---------------------------------------------------------------------
const ORDINALES = ["", "primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "septima", "octava"];
const pct2 = (x: number) => `${(x * 100).toFixed(2)}%`;

export interface TitularResumen {
  texto: string;
  tono: "mejora" | "alerta" | "neutral";
}

/** "MEJORA: la Devolución bajo de 6.72% (semana pasada) a 6.26% esta semana
 * -segunda semana seguida a la baja-." La racha se calcula con la tendencia. */
export function titularResumen(
  reporte: DevReporte,
  tendencia: DevSemanaTendencia[]
): TitularResumen | null {
  const r = reporte.resumen;
  if (!r.prev_total || r.prev_pct_dev == null || r.pct_dev == null) return null;

  const diff = r.pct_dev - r.prev_pct_dev;
  if (Math.abs(diff) < 0.00005) {
    return { texto: `SIN CAMBIO: la Devolución se mantuvo en ${pct2(r.pct_dev)}.`, tono: "neutral" };
  }
  const baja = diff < 0;
  const ligero = Math.abs(diff) < 0.0025;

  // Direcciones semana contra semana, solo mientras las semanas sean consecutivas.
  const serie = tendencia
    .filter((t) => t.semana_inicio <= reporte.semana.inicio)
    .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
  const dirs: number[] = [];
  for (let i = serie.length - 1; i > 0; i--) {
    if (sumarDias(serie[i - 1].semana_inicio, 7) !== serie[i].semana_inicio) break;
    dirs.unshift(Math.sign(serie[i].pct_dev - serie[i - 1].pct_dev));
  }
  let racha = 0;
  for (let i = dirs.length - 1; i >= 0 && dirs[i] === (baja ? -1 : 1); i--) racha++;
  let rachaAnterior = 0;
  for (let i = dirs.length - 1 - racha; i >= 0 && dirs[i] === (baja ? 1 : -1); i--) rachaAnterior++;

  let cola = "";
  if (racha >= 2) {
    cola = ` -${ORDINALES[racha] ?? `${racha}a`} semana seguida ${baja ? "a la baja" : "al alza"}-.`;
  } else if (rachaAnterior >= 2) {
    cola = ` -se corta la racha de ${rachaAnterior} semanas ${baja ? "al alza" : "a la baja"}.`;
  } else {
    cola = ".";
  }

  const etiqueta = baja ? (ligero ? "MEJORA LIGERA" : "MEJORA") : ligero ? "AUMENTO LIGERO" : "ALERTA";
  const verbo = baja ? "bajo" : "subio";
  return {
    texto: `${etiqueta}: la Devolución ${verbo} de ${pct2(r.prev_pct_dev)} (semana pasada) a ${pct2(r.pct_dev)} esta semana${cola}`,
    tono: baja ? "mejora" : "alerta",
  };
}

export function puntosResumen(reporte: DevReporte): string[] {
  const r = reporte.resumen;
  const mes = nombreMes(reporte.linea_base.inicio);
  const hojaPersiste = `Persiste desde ${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
  const p = reporte.persiste;
  const n = (x: number) => x.toLocaleString("es-MX");

  const lineas = [
    `1. ${n(r.devueltas)} ordenes devueltas, la semana completa ${rangoLargo(reporte.semana.inicio, reporte.semana.fin)}.`,
  ];

  if (reporte.meses_con_data > 0) {
    lineas.push(
      `2. Cruzamos contra las Direcciones/teléfonos/coordenadas marcadas en ${mes} (mes completo): ${p.gps.length} coordenadas, ${p.telefonos.length} teléfonos y ${p.direcciones.length} Direcciones volvieron a aparecer esta semana -ver hoja '${hojaPersiste}'-.`
    );
  } else {
    lineas.push(
      `2. Todavia no hay data cargada de ${mes} (mes completo), asi que aun no se puede cruzar contra lo marcado ese mes -ver hoja '${hojaPersiste}'-.`
    );
  }

  const gps = reporte.duplicados_gps.length;
  const tel = reporte.duplicados_telefono.length;
  const dir = reporte.duplicados_direccion.length;
  let comparacion = "";
  if (r.prev_total > 0) {
    const antes = r.prev_dup_gps + r.prev_dup_telefonos + r.prev_dup_direcciones;
    const ahora = gps + tel + dir;
    const palabra = ahora < antes ? "menos que" : ahora > antes ? "mas que" : "igual que";
    comparacion = ` -${palabra} la semana pasada (${r.prev_dup_gps}/${r.prev_dup_telefonos}/${r.prev_dup_direcciones})-`;
  }
  lineas.push(
    `3. Esta semana se identificaron ademas ${gps} puntos GPS, ${tel} teléfonos y ${dir} Direcciones nuevas con 3+ ordenes y 50%+ de Devolución${
      comparacion ? `${comparacion} ver hoja 'Duplicados'-.` : ` -ver hoja 'Duplicados'-.`
    }`
  );
  return lineas;
}

export function criterioTexto(op: DevOpciones) {
  const dev = op.incluirReturning ? "RETURNED + RETURNING" : "RETURNED";
  const canc = op.incluirRechazadas ? "CANCELLED + REJECTED" : "CANCELLED";
  return `Criterio: devoluciones = ${dev}; cancelaciones = ${canc}; % sobre el total de ordenes de la semana.`;
}

// ---------------------------------------------------------------------
// Incidencias y contexto (mal clima, tráfico, intermitencias, bugs...)
// ---------------------------------------------------------------------
export type TipoIncidencia = "clima" | "trafico" | "intermitencia" | "bug" | "evento" | "otro";
export type AlcanceIncidencia = "general" | "zona" | "ciudad" | "tienda";

export interface Incidencia {
  id: string;
  tipo: TipoIncidencia;
  fecha_inicio: string;
  fecha_fin: string;
  alcance: AlcanceIncidencia;
  alcance_valores: string[];
  descripcion: string;
}

export const TIPOS_INCIDENCIA: Record<TipoIncidencia, { label: string; icono: string }> = {
  clima: { label: "Mal clima", icono: "🌧️" },
  trafico: { label: "Tráfico", icono: "🚦" },
  intermitencia: { label: "Intermitencia / falla de sistema", icono: "⚡" },
  bug: { label: "Bug", icono: "🐞" },
  evento: { label: "Evento local (marchas, partidos, bloqueos)", icono: "📍" },
  otro: { label: "Otro", icono: "📝" },
};

export const ALCANCES_INCIDENCIA: Record<AlcanceIncidencia, string> = {
  general: "Todas las tiendas",
  zona: "Zona",
  ciudad: "Ciudad",
  tienda: "Tienda",
};

/** "22 sep" o "22-24 sep" o "30 sep - 2 oct" */
export function fechasIncidencia(i: Incidencia) {
  if (i.fecha_inicio === i.fecha_fin) {
    const { m, d } = partes(i.fecha_inicio);
    return `${d} ${MESES_CORTOS[m]}`;
  }
  return rangoCorto(i.fecha_inicio, i.fecha_fin);
}

/** "Todas las tiendas" / "Acapulco" / "3 tiendas: A, B, C" */
export function alcanceIncidencia(i: Incidencia) {
  if (i.alcance === "general" || i.alcance_valores.length === 0) return ALCANCES_INCIDENCIA.general;
  const v = i.alcance_valores;
  if (v.length <= 3) return v.join(", ");
  return `${v.length} ${i.alcance === "tienda" ? "tiendas" : i.alcance === "zona" ? "zonas" : "ciudades"}: ${v
    .slice(0, 3)
    .join(", ")}…`;
}

/** Una línea para el resumen y el Excel:
 * "22-24 sep · 🌧️ Mal clima · Acapulco: Tormenta tropical, varias tiendas cerradas." */
export function lineaIncidencia(i: Incidencia) {
  const t = TIPOS_INCIDENCIA[i.tipo] ?? TIPOS_INCIDENCIA.otro;
  return `${fechasIncidencia(i)} · ${t.icono} ${t.label} · ${alcanceIncidencia(i)}: ${i.descripcion}`;
}

/** ¿La incidencia cae (aunque sea un día) dentro del rango? */
export function incidenciaEnRango(i: Incidencia, desde: string, hasta: string) {
  return i.fecha_inicio <= hasta && i.fecha_fin >= desde;
}

// ---------------------------------------------------------------------
// Clima detectado automáticamente (Open-Meteo)
// ---------------------------------------------------------------------
export interface ClimaDia {
  ciudad: string;
  fecha: string;
  lluvia_mm: number | null;
  codigo: number | null;
  rafaga_kmh: number | null;
  nota: string | null;
  descartado: boolean;
}

/** Criterio de "mal clima" (el mismo en el servidor y en pantalla):
 *  lluvia fuerte (15 mm o más), tormenta eléctrica con 10 mm o más,
 *  o ráfagas de viento de 60 km/h o más. */
export const UMBRALES_CLIMA = { lluvia_mm: 15, tormenta_lluvia_mm: 10, rafaga_kmh: 60 };

export function esMalClima(lluvia: number | null, codigo: number | null, rafaga: number | null) {
  const l = lluvia ?? 0;
  const tormenta = (codigo ?? 0) >= 95;
  return (
    l >= UMBRALES_CLIMA.lluvia_mm ||
    (tormenta && l >= UMBRALES_CLIMA.tormenta_lluvia_mm) ||
    (rafaga ?? 0) >= UMBRALES_CLIMA.rafaga_kmh
  );
}

/** "44 mm de lluvia, tormenta eléctrica, ráfagas de 63 km/h" */
export function detalleClima(c: ClimaDia) {
  const partesTxt: string[] = [];
  if (c.lluvia_mm != null && c.lluvia_mm >= 1) {
    const mm = Math.round(c.lluvia_mm);
    partesTxt.push(`${mm} mm de lluvia${mm >= 30 ? " (muy fuerte)" : ""}`);
  }
  if ((c.codigo ?? 0) >= 95) partesTxt.push("tormenta eléctrica");
  if ((c.rafaga_kmh ?? 0) >= 50) partesTxt.push(`ráfagas de ${Math.round(c.rafaga_kmh!)} km/h`);
  return partesTxt.join(", ") || "mal clima";
}

const titulo = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());

export function nombreCiudad(c: string) {
  return titulo(c);
}

/** Agrupa por día los registros de mal clima que no se descartaron. */
export function climaPorDia(clima: ClimaDia[]) {
  const mapa = new Map<string, ClimaDia[]>();
  clima
    .filter((c) => !c.descartado)
    .forEach((c) => {
      const l = mapa.get(c.fecha) ?? [];
      l.push(c);
      mapa.set(c.fecha, l);
    });
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, ciudades]) => ({
      fecha,
      ciudades: ciudades.sort((a, b) => (b.lluvia_mm ?? 0) - (a.lluvia_mm ?? 0)),
    }));
}

/** Una línea por día para el resumen y el Excel:
 * "23 sep · 🌧️ Mal clima (detectado automáticamente) · Acapulco: 44 mm de lluvia, tormenta eléctrica (nota: …)" */
export function lineaClimaDia(fecha: string, ciudades: ClimaDia[]) {
  const { m, d } = partes(fecha);
  const detalle = ciudades
    .map((c) => `${nombreCiudad(c.ciudad)}: ${detalleClima(c)}${c.nota ? ` (nota: ${c.nota})` : ""}`)
    .join("; ");
  return `${d} ${MESES_CORTOS[m]} · 🌧️ Mal clima (detectado automáticamente) · ${detalle}`;
}
