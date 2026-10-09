"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import FiltersBar from "@/components/FiltersBar";
import { DashboardFilters, EMPTY_FILTERS, FilterOptions } from "@/lib/types";
import {
  META_DICIEMBRE,
  ClimaDia,
  Incidencia,
  TIPOS_INCIDENCIA,
  detalleClima,
  nombreCiudad,
  sumarDias,
} from "@/lib/devoluciones";
import DetalleDia, { DetalleDiaVacio, buscarPrevio, type FilaDia } from "@/components/DetalleDia";
import Incidencias from "./Incidencias";
import { colorPct, type MetricaMapa, type TiendaMapa } from "./MapaDevoluciones";

// Leaflet solo corre en el navegador
const MapaDevoluciones = dynamic(() => import("./MapaDevoluciones"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-ink-50" />,
});

interface RangoData {
  fecha_min: string | null;
  fecha_max: string | null;
}

interface PanoramaData {
  periodo: { desde: string; hasta: string };
  kpis: {
    total: number;
    devueltas: number;
    canceladas: number;
    rechazadas: number;
    canceladas_criterio: number;
    pct_dev: number | null;
    pct_canc: number | null;
    monto_devuelto: number;
    dev_efectivo: number;
    tiendas_con_ordenes: number;
    tiendas_sobre_meta: number;
    tiendas_evaluadas: number;
    ant_total: number;
    ant_pct_dev: number | null;
    ant_pct_canc: number | null;
  };
  por_dia: { dia: string; total: number; devueltas: number; canceladas: number; pct_dev: number; pct_canc: number }[];
  tiendas: TiendaMapa[];
  motivos: { motivo: string; ordenes: number }[];
  repartidores: { repartidor: string; ordenes: number; devueltas: number; canceladas: number; pct_dev: number; pct_canc: number }[];
  zonas: { zona: string; ordenes: number; devueltas: number; canceladas: number; pct_dev: number; pct_canc: number }[];
}

const MOTIVOS: Record<string, string> = {
  PROBLEM_IN_RESTAURANT: "Problema en el restaurante",
  EXTERNAL_COURIER_CANCEL: "Cancelación del repartidor externo",
  OTHER: "Otro",
  NO_MOVEMENT_FOR_24H: "Sin movimiento en 24 h",
  CANCEL_BY_USER: "Cancelada por el cliente",
  DRIVER_NOT_FOUND: "No se encontró repartidor",
  NO_CUSTOMER_CONTACT: "Sin contacto con el cliente",
  ERROR_WITH_CUSTOMER_DATA: "Error en datos del cliente",
  CLOSED_STORE: "Tienda cerrada",
  RETURNED_TO_RESTAURANT: "Regresada al restaurante",
  "SIN MOTIVO": "Sin motivo registrado",
};

const pct = (x: number | null | undefined, d = 2) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

const fechaCorta = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

function comparacion(actual: number | null, anterior: number | null, hayAnterior: boolean) {
  if (!hayAnterior || actual == null || anterior == null) return undefined;
  const d = (actual - anterior) * 100;
  return `${d <= 0 ? "▼" : "▲"} ${Math.abs(d).toFixed(2)} pts vs periodo anterior`;
}

// ---------------------------------------------------------------------
// Gráfica por día (líneas de % con la meta y detalle al pasar el mouse)
// ---------------------------------------------------------------------
function GraficaDiaria({
  datos,
  incidencias,
  clima,
}: {
  datos: PanoramaData["por_dia"];
  incidencias: Incidencia[];
  clima: ClimaDia[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [fijo, setFijo] = useState<number | null>(null);
  if (datos.length < 2) {
    return <p className="text-xs text-ink-500">Elige un periodo de al menos 2 días para ver la tendencia.</p>;
  }
  const W = 760;
  const H = 240;
  const pad = { l: 44, r: 16, t: 16, b: 30 };
  const maxY = Math.max(META_DICIEMBRE * 1.5, ...datos.map((d) => Math.max(d.pct_dev ?? 0, d.pct_canc ?? 0))) * 1.1;
  const paso = (W - pad.l - pad.r) / (datos.length - 1);
  const x = (i: number) => pad.l + i * paso;
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const linea = (k: "pct_dev" | "pct_canc") =>
    datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k] ?? 0).toFixed(1)}`).join(" ");
  const area =
    `M${x(0)},${y(0)} ` +
    datos.map((d, i) => `L${x(i).toFixed(1)},${y(d.pct_dev ?? 0).toFixed(1)}`).join(" ") +
    ` L${x(datos.length - 1)},${y(0)} Z`;
  const ticks = [0, maxY / 3, (2 * maxY) / 3, maxY];
  const cadaCuanto = Math.max(1, Math.ceil(datos.length / 14));
  const etiqueta = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d}/${m}`;
  };
  const diaSemana = (iso: string) => {
    const t = new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const activo = hover ?? fijo;
  const sel = activo != null ? datos[activo] : null;
  const previo = sel ? buscarPrevio(datos, sel.dia) : undefined;
  const delDia = (dia: string) => incidencias.filter((x) => x.fecha_inicio <= dia && x.fecha_fin >= dia);
  const climaDelDia = (dia: string) => clima.filter((c) => c.fecha === dia && !c.descartado);
  const incSel = sel ? delDia(sel.dia) : [];
  const climaSel = sel ? climaDelDia(sel.dia) : [];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Porcentaje diario de devoluciones y cancelaciones"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gradDev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#891DFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#891DFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Días con incidencia (van al fondo, detrás de la cuadrícula y las líneas) */}
        {datos.map((d, i) => {
          const inc = delDia(d.dia);
          const cli = climaDelDia(d.dia);
          if (inc.length === 0 && cli.length === 0) return null;
          // Franja amarilla solo para incidencias registradas; el clima automático
          // se marca solo con su ícono (en temporada de lluvias casi siempre llueve en alguna ciudad).
          return (
            <g key={`inc-${d.dia}`}>
              {inc.length > 0 && (
              <rect
                x={Math.max(pad.l, x(i) - paso / 2)}
                y={pad.t}
                width={Math.min(paso, W - pad.r - Math.max(pad.l, x(i) - paso / 2))}
                height={H - pad.t - pad.b}
                className="fill-warning-bg"
              />
              )}
              <text x={x(i)} y={pad.t + 12} textAnchor="middle" fontSize="11">
                {inc.length > 0 ? TIPOS_INCIDENCIA[inc[0].tipo]?.icono ?? "📝" : "🌧️"}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-ink-50" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" className="fill-ink-500">
              {(t * 100).toFixed(1)}%
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(META_DICIEMBRE)} y2={y(META_DICIEMBRE)} stroke="#1F8A54" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={W - pad.r} y={y(META_DICIEMBRE) - 5} textAnchor="end" fontSize="10" fill="#1F8A54">
          Meta dic. 2%
        </text>
        <path d={area} fill="url(#gradDev)" />
        <path d={linea("pct_canc")} fill="none" stroke="#7D8FFF" strokeWidth="2" />
        <path d={linea("pct_dev")} fill="none" stroke="#891DFF" strokeWidth="2.5" />
        {activo != null && (
          <line x1={x(activo)} x2={x(activo)} y1={pad.t} y2={H - pad.b} className="stroke-ink-200" strokeDasharray="3 3" />
        )}
        {datos.map((d, i) => (
          <g key={d.dia}>
            <circle cx={x(i)} cy={y(d.pct_dev ?? 0)} r={activo === i ? 4.5 : 2.5} fill="#891DFF" />
            <circle cx={x(i)} cy={y(d.pct_canc ?? 0)} r={activo === i ? 4 : 2} fill="#7D8FFF" />
            {i % cadaCuanto === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" className="fill-ink-500">
                {etiqueta(d.dia)}
              </text>
            )}
            <rect
              x={x(i) - paso / 2}
              y={pad.t}
              width={paso}
              height={H - pad.t - pad.b}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onClick={() => setFijo((v) => (v === i ? null : i))}
            />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand-500" /> % Devolución
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-peri" /> % Cancelación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-success" /> Meta de diciembre
        </span>
        {incidencias.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm bg-warning-bg ring-1 ring-warning/30" /> Día con incidencia registrada
          </span>
        )}
        {clima.some((c) => !c.descartado) && <span>🌧️ Mal clima en alguna ciudad (automático)</span>}
      </div>
      {sel ? (
        <DetalleDia
          dia={sel.dia}
          hayPrevio={!!previo}
          filas={
            [
              { etiqueta: "Órdenes", actual: sel.total, previo: previo?.total, formato: "n", mejor: null },
              { etiqueta: "Devueltas", actual: sel.devueltas, previo: previo?.devueltas, formato: "n", mejor: "baja" },
              { etiqueta: "% devolución", actual: sel.pct_dev, previo: previo?.pct_dev, formato: "pct", mejor: "baja" },
              { etiqueta: "Canceladas", actual: sel.canceladas, previo: previo?.canceladas, formato: "n", mejor: "baja" },
              { etiqueta: "% cancelación", actual: sel.pct_canc, previo: previo?.pct_canc, formato: "pct", mejor: "baja" },
            ] as FilaDia[]
          }
          extra={
            incSel.length + climaSel.length > 0 ? (
              <div className="mt-2 border-t border-ink-100 pt-2 text-xs text-ink-700">
                {incSel.map((x) => (
                  <p key={x.id} className="mt-1">
                    {TIPOS_INCIDENCIA[x.tipo]?.icono} <span className="font-medium">{TIPOS_INCIDENCIA[x.tipo]?.label}</span>: {x.descripcion}
                  </p>
                ))}
                {climaSel.length > 0 && (
                  <p className="mt-1">
                    🌧️ <span className="font-medium">Mal clima:</span>{" "}
                    {climaSel
                      .slice(0, 4)
                      .map((c) => `${nombreCiudad(c.ciudad)} (${detalleClima(c)})`)
                      .join("; ")}
                    {climaSel.length > 4 ? ` y ${climaSel.length - 4} más` : ""}
                  </p>
                )}
              </div>
            ) : undefined
          }
        />
      ) : (
        <DetalleDiaVacio />
      )}
    </div>
  );
}

/** Barra horizontal simple para listas (motivos, zonas). */
function Barra({ valor, max, color = "bg-brand-500" }: { valor: number; max: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-ink-100">
      <div className={clsx("h-1.5 rounded-full", color)} style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------
// Panorama
// ---------------------------------------------------------------------
export default function Panorama() {
  const [opciones, setOpciones] = useState<FilterOptions | null>(null);
  const [rango, setRango] = useState<RangoData | null>(null);
  // Mismos filtros que el panel principal; sin fechas = toda la data
  const [filtros, setFiltros] = useState<DashboardFilters>(EMPTY_FILTERS);
  // Prendidos = mismo criterio que el panel principal
  const [incluirReturning, setIncluirReturning] = useState(true);
  const [incluirRechazadas, setIncluirRechazadas] = useState(true);
  const [data, setData] = useState<PanoramaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<MetricaMapa>("dev");
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [recargarInc, setRecargarInc] = useState(0);
  const [clima, setClima] = useState<ClimaDia[]>([]);
  const [recargarClima, setRecargarClima] = useState(0);
  const [minOrdenes, setMinOrdenes] = useState(20);

  // Opciones de filtro (las mismas del panel principal) y el rango de fechas con data
  useEffect(() => {
    fetch("/api/filters", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        setOpciones(Array.isArray(res) ? res[0] ?? null : res);
      })
      .catch(() => setError("No se pudieron cargar las opciones de filtro."));
    fetch("/api/devoluciones/filtros", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (!res?.error) setRango({ fecha_min: res.fecha_min ?? null, fecha_max: res.fecha_max ?? null });
      })
      .catch(() => undefined);
  }, []);

  const query = useMemo(() => {
    const f = filtros;
    const p = new URLSearchParams();
    if (f.date_from) p.set("date_from", f.date_from);
    if (f.date_to) p.set("date_to", f.date_to);
    f.ciudad.forEach((v) => p.append("ciudad", v));
    f.restaurant.forEach((v) => p.append("restaurant", v));
    f.zona.forEach((v) => p.append("zona", v));
    f.estatus.forEach((v) => p.append("estatus", v));
    f.repartido_por.forEach((v) => p.append("repartido_por", v));
    if (f.orden_planeada) p.set("orden_planeada", f.orden_planeada);
    if (f.price_min != null) p.set("price_min", String(f.price_min));
    if (f.price_max != null) p.set("price_max", String(f.price_max));
    p.set("returning", incluirReturning ? "1" : "0");
    p.set("rechazadas", incluirRechazadas ? "1" : "0");
    return p.toString();
  }, [filtros, incluirReturning, incluirRechazadas]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/devoluciones/panorama?${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res?.kpis ? res : null);
        })
        .catch((e) => setError(e.message ?? "No se pudo cargar el panorama."))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Incidencias que tocan el periodo que se está mostrando
  const periodoDesde = data?.periodo?.desde;
  const periodoHasta = data?.periodo?.hasta;
  useEffect(() => {
    if (!periodoDesde || !periodoHasta) return;
    fetch(`/api/devoluciones/incidencias?desde=${periodoDesde}&hasta=${periodoHasta}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => setIncidencias(res?.incidencias ?? []))
      .catch(() => setIncidencias([]));
  }, [periodoDesde, periodoHasta, recargarInc]);

  // Mal clima detectado automáticamente en el periodo (si faltan días, se consultan solos)
  useEffect(() => {
    if (!periodoDesde || !periodoHasta) return;
    fetch(`/api/devoluciones/clima?desde=${periodoDesde}&hasta=${periodoHasta}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => setClima(res?.clima ?? []))
      .catch(() => setClima([]));
  }, [periodoDesde, periodoHasta, recargarClima]);

  // Si filtras por ciudad, solo cuenta el clima de esas ciudades
  const climaVisible = useMemo(
    () => (filtros.ciudad.length ? clima.filter((c) => filtros.ciudad.includes(c.ciudad)) : clima),
    [clima, filtros.ciudad]
  );

  function limpiarFiltros() {
    setFiltros(EMPTY_FILTERS);
    setIncluirReturning(true);
    setIncluirRechazadas(true);
  }

  /** Atajos de periodo, contados hacia atrás desde el último día con data. */
  function preset(dias: number) {
    if (!rango?.fecha_max) return;
    setFiltros((f) => ({ ...f, date_from: sumarDias(rango.fecha_max!, -(dias - 1)), date_to: rango.fecha_max! }));
  }

  const k = data?.kpis;
  const hayAnterior = !!k && k.ant_total > 0;
  const topTiendas = useMemo(
    () =>
      (data?.tiendas ?? [])
        .filter((t) => t.ordenes >= minOrdenes)
        .sort((a, b) => (metrica === "dev" ? b.pct_dev - a.pct_dev : b.pct_canc - a.pct_canc))
        .slice(0, 10),
    [data, minOrdenes, metrica]
  );
  const maxMotivo = Math.max(0, ...(data?.motivos ?? []).map((m) => m.ordenes));
  const maxZona = Math.max(0, ...(data?.zonas ?? []).map((z) => z.devueltas + z.canceladas));

  const cargando = (v: string) => (loading ? "…" : v);
  const sinUbicacion = (data?.tiendas ?? []).filter(
    (t) => t.ordenes >= minOrdenes && (t.lat == null || t.lon == null)
  ).length;

  if (rango && !rango.fecha_max) {
    return (
      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 text-sm text-ink-700 shadow-card">
        Todavía no hay data de operaciones cargada. Súbela en{" "}
        <a href="/upload" className="font-medium text-brand-600 hover:underline">Cargar datos</a> (tarjeta
        &quot;Data de Operaciones&quot;).
      </div>
    );
  }

  return (
    <div>
      {/* Filtros: los mismos del panel principal */}
      <div className="mt-6">
        <FiltersBar options={opciones} filters={filtros} onChange={setFiltros} onClear={limpiarFiltros} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl border border-ink-100 bg-white px-4 py-3 text-sm shadow-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-ink-700">
            <input
              type="checkbox"
              checked={incluirReturning}
              onChange={(e) => setIncluirReturning(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-500"
            />
            Contar RETURNING como devuelta (van de regreso a tienda)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-ink-700">
            <input
              type="checkbox"
              checked={incluirRechazadas}
              onChange={(e) => setIncluirRechazadas(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-500"
            />
            Contar rechazadas como canceladas
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-ink-500">Periodo rápido:</span>
          <button
            onClick={() => preset(7)}
            disabled={!rango?.fecha_max}
            title="Los últimos 7 días que tienen data cargada"
            className="rounded-md border border-ink-200 px-2 py-1 font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
          >
            Última semana
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Data de operaciones, mismo criterio que el panel principal
        {data?.periodo
          ? ` · mostrando del ${fechaCorta(data.periodo.desde)} al ${fechaCorta(data.periodo.hasta)}${
              filtros.date_from || filtros.date_to ? "" : " (toda la data)"
            }`
          : ""}
        .
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Órdenes totales" value={cargando(int(k?.total))} />
        <KpiCard
          label="% Devolución"
          value={cargando(pct(k?.pct_dev))}
          sublabel={comparacion(k?.pct_dev ?? null, k?.ant_pct_dev ?? null, hayAnterior) ?? `${int(k?.devueltas)} devueltas`}
          accent={(k?.pct_dev ?? 1) <= META_DICIEMBRE ? "success" : "warning"}
        />
        <KpiCard
          label={incluirRechazadas ? "% Cancelación (incl. rechazadas)" : "% Cancelación"}
          value={cargando(pct(k?.pct_canc))}
          sublabel={comparacion(k?.pct_canc ?? null, k?.ant_pct_canc ?? null, hayAnterior) ?? `${int(k?.canceladas_criterio)} órdenes`}
          accent={(k?.pct_canc ?? 1) <= META_DICIEMBRE ? "success" : "danger"}
        />
        <KpiCard
          label="% Problema total"
          value={cargando(pct(k ? (k.devueltas + k.canceladas_criterio) / (k.total || 1) : null))}
          sublabel={`Meta de diciembre: 2% en cada una`}
        />
        <KpiCard
          label="Órdenes devueltas"
          value={cargando(int(k?.devueltas))}
          sublabel={k ? `${pct(k.devueltas ? k.dev_efectivo / k.devueltas : 0, 0)} pagadas en efectivo` : undefined}
          accent="warning"
        />
        <KpiCard
          label="Canceladas / Rechazadas"
          value={cargando(`${int(k?.canceladas)} / ${int(k?.rechazadas)}`)}
          accent="danger"
        />
        <KpiCard label="Monto devuelto" value={cargando(money(k?.monto_devuelto))} accent="warning" />
        <KpiCard
          label="Tiendas arriba de la meta"
          value={cargando(`${int(k?.tiendas_sobre_meta)} de ${int(k?.tiendas_evaluadas)}`)}
          sublabel="Tiendas con 50+ órdenes y más de 2% de devolución"
          accent="danger"
        />
      </div>

      {/* Tendencia por día */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink-900">Tendencia por día</h2>
        <p className="mt-1 text-xs text-ink-500">Pasa el mouse sobre un día para ver su detalle y compararlo con la semana anterior; da clic para dejarlo fijo.</p>
        <div className="mt-3">
          {data ? (
            <GraficaDiaria datos={data.por_dia} incidencias={incidencias} clima={climaVisible} />
          ) : (
            <div className="h-60 animate-pulse rounded-lg bg-ink-50" />
          )}
        </div>
      </div>

      {/* Incidencias y contexto */}
      <div className="mt-6">
        <Incidencias
          incidencias={incidencias}
          clima={climaVisible}
          opciones={opciones}
          onCambio={() => setRecargarInc((n) => n + 1)}
          onClimaCambio={() => setRecargarClima((n) => n + 1)}
        />
      </div>

      {/* Mapa + top tiendas */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">
                ¿Dónde se concentran las {metrica === "dev" ? "devoluciones" : "cancelaciones"}?
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                Cada círculo es una tienda. Tamaño = número de {metrica === "dev" ? "devueltas" : "canceladas"};
                color = qué tan lejos está de la meta.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
              {(
                [
                  ["dev", "Devoluciones"],
                  ["canc", "Cancelaciones"],
                ] as [MetricaMapa, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setMetrica(id)}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    metrica === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <MapaDevoluciones tiendas={data?.tiendas ?? []} metrica={metrica} minOrdenes={minOrdenes} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
            <div className="flex flex-wrap items-center gap-3">
              {[
                [0.02, "≤ 2% (meta)"],
                [0.05, "2–5%"],
                [0.08, "5–8%"],
                [0.2, "> 8%"],
              ].map(([v, l]) => (
                <span key={l as string} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: colorPct(v as number) }} />
                  {l}
                </span>
              ))}
            </div>
            <label className="flex items-center gap-2">
              Mínimo de órdenes por tienda
              <select
                value={minOrdenes}
                onChange={(e) => setMinOrdenes(Number(e.target.value))}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
              >
                {[1, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sinUbicacion > 0 && (
            <p className="mt-2 text-xs text-ink-500">
              {sinUbicacion} {sinUbicacion === 1 ? "tienda no aparece" : "tiendas no aparecen"} en el mapa
              porque todavía no tienen data de tiempos cargada (de ahí se toma su ubicación).
            </p>
          )}
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">
            Tiendas con mayor % de {metrica === "dev" ? "devolución" : "cancelación"}
          </h2>
          <p className="mt-1 text-xs text-ink-500">Con {minOrdenes}+ órdenes en el periodo.</p>
          <ol className="mt-4 space-y-3">
            {topTiendas.map((t, i) => (
              <li key={t.tienda}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink-900">
                    <span className="mr-1.5 text-xs text-ink-300">{i + 1}</span>
                    {t.tienda}
                  </span>
                  <span
                    className="flex-shrink-0 font-semibold tabular-nums"
                    style={{ color: colorPct(metrica === "dev" ? t.pct_dev : t.pct_canc) }}
                  >
                    {pct(metrica === "dev" ? t.pct_dev : t.pct_canc, 1)}
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  {metrica === "dev"
                    ? `${int(t.devueltas)} de ${int(t.ordenes)} órdenes · ${money(t.monto_devuelto)}`
                    : `${int(t.canceladas)} de ${int(t.ordenes)} órdenes`}
                </p>
              </li>
            ))}
            {data && topTiendas.length === 0 && (
              <li className="text-xs text-ink-500">Ninguna tienda cumple el mínimo de órdenes.</li>
            )}
          </ol>
        </div>
      </div>

      {/* Motivos, repartidor, zonas */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Motivos de cancelación y rechazo</h2>
          <ul className="mt-4 space-y-3">
            {(data?.motivos ?? []).map((m) => (
              <li key={m.motivo}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-ink-900" title={m.motivo}>{MOTIVOS[m.motivo] ?? m.motivo}</span>
                  <span className="font-medium tabular-nums text-ink-700">{int(m.ordenes)}</span>
                </div>
                <Barra valor={m.ordenes} max={maxMotivo} color="bg-peri" />
              </li>
            ))}
            {data && data.motivos.length === 0 && <li className="text-xs text-ink-500">Sin cancelaciones en el periodo.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Por repartidor</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-3 font-medium">Repartidor</th>
                  <th className="py-2 pr-3 text-right font-medium">Órdenes</th>
                  <th className="py-2 pr-3 text-right font-medium">% Dev.</th>
                  <th className="py-2 text-right font-medium">% Canc.</th>
                </tr>
              </thead>
              <tbody>
                {(data?.repartidores ?? []).map((r) => (
                  <tr key={r.repartidor} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-3 text-ink-900">{r.repartidor}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink-700">{int(r.ordenes)}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums" style={{ color: colorPct(r.pct_dev) }}>
                      {pct(r.pct_dev, 1)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{pct(r.pct_canc, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Por zona</h2>
          <p className="mt-1 text-xs text-ink-500">Barra = devueltas + canceladas.</p>
          <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {(data?.zonas ?? []).map((z) => (
              <li key={z.zona}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-ink-900">{z.zona}</span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-ink-700">
                    Dev.{" "}
                    <span className="font-semibold" style={{ color: colorPct(z.pct_dev) }}>
                      {pct(z.pct_dev, 1)}
                    </span>{" "}
                    · Canc.{" "}
                    <span className="font-semibold" style={{ color: colorPct(z.pct_canc) }}>
                      {pct(z.pct_canc, 1)}
                    </span>
                  </span>
                </div>
                <Barra valor={z.devueltas + z.canceladas} max={maxZona} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
