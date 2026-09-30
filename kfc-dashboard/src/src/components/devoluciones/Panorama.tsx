"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import { META_DICIEMBRE, sumarDias } from "@/lib/devoluciones";
import { colorPct, type ModoMapa, type PuntoMapa, type TiendaMapa } from "./MapaDevoluciones";

// Leaflet solo corre en el navegador
const MapaDevoluciones = dynamic(() => import("./MapaDevoluciones"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-lg bg-ink-50" />,
});

interface Filtros {
  estados: string[];
  tiendas: string[];
  repartidores: string[];
  fecha_min: string | null;
  fecha_max: string | null;
}

interface PanoramaData {
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
  puntos: PuntoMapa[];
  motivos: { motivo: string; ordenes: number }[];
  repartidores: { repartidor: string; ordenes: number; devueltas: number; canceladas: number; pct_dev: number; pct_canc: number }[];
  estados: { estado: string; ordenes: number; devueltas: number; pct_dev: number }[];
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
  "SIN MOTIVO": "Sin motivo registrado",
};

const pct = (x: number | null | undefined, d = 2) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

const inputFecha =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function comparacion(actual: number | null, anterior: number | null, hayAnterior: boolean) {
  if (!hayAnterior || actual == null || anterior == null) return undefined;
  const d = (actual - anterior) * 100;
  return `${d <= 0 ? "▼" : "▲"} ${Math.abs(d).toFixed(2)} pts vs periodo anterior`;
}

// ---------------------------------------------------------------------
// Gráfica por día (líneas de % con la meta y detalle al pasar el mouse)
// ---------------------------------------------------------------------
function GraficaDiaria({ datos }: { datos: PanoramaData["por_dia"] }) {
  const [hover, setHover] = useState<number | null>(null);
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
  const diaSemana = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
  const sel = hover != null ? datos[hover] : null;

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
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9EAF2" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6E6E86">
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
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#CFCEDD" strokeDasharray="3 3" />
        )}
        {datos.map((d, i) => (
          <g key={d.dia}>
            <circle cx={x(i)} cy={y(d.pct_dev ?? 0)} r={hover === i ? 4.5 : 2.5} fill="#891DFF" />
            <circle cx={x(i)} cy={y(d.pct_canc ?? 0)} r={hover === i ? 4 : 2} fill="#7D8FFF" />
            {i % cadaCuanto === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6E6E86">
                {etiqueta(d.dia)}
              </text>
            )}
            <rect
              x={x(i) - paso / 2}
              y={pad.t}
              width={paso}
              height={H - pad.t - pad.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      {sel && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-ink-100 bg-white p-3 text-xs shadow-card"
          style={{
            left: `${Math.min(Math.max((x(hover) / W) * 100, 12), 70)}%`,
          }}
        >
          <p className="font-semibold capitalize text-ink-900">{diaSemana(sel.dia)}</p>
          <p className="mt-1 text-ink-700">
            <span className="font-medium text-brand-600">{pct(sel.pct_dev)}</span> devolución ·{" "}
            {int(sel.devueltas)} órdenes
          </p>
          <p className="text-ink-700">
            <span className="font-medium" style={{ color: "#5A6BE0" }}>{pct(sel.pct_canc)}</span> cancelación ·{" "}
            {int(sel.canceladas)} órdenes
          </p>
          <p className="mt-1 text-ink-500">{int(sel.total)} órdenes en total</p>
        </div>
      )}
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
      </div>
    </div>
  );
}

/** Barra horizontal simple para listas (motivos, estados, repartidor). */
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
export default function Panorama({
  incluirReturning,
  incluirRechazadas,
  onIncluirReturning,
  onIncluirRechazadas,
}: {
  incluirReturning: boolean;
  incluirRechazadas: boolean;
  onIncluirReturning: (v: boolean) => void;
  onIncluirRechazadas: (v: boolean) => void;
}) {
  const [opciones, setOpciones] = useState<Filtros | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estados, setEstados] = useState<string[]>([]);
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [repartidores, setRepartidores] = useState<string[]>([]);
  const [data, setData] = useState<PanoramaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modoMapa, setModoMapa] = useState<ModoMapa>("tiendas");
  const [minOrdenes, setMinOrdenes] = useState(20);

  // Opciones de filtro + periodo por defecto: las últimas 4 semanas con data
  useEffect(() => {
    fetch("/api/devoluciones/filtros", { cache: "no-store" })
      .then((r) => r.json())
      .then((res: Filtros & { error?: string }) => {
        if (res?.error) throw new Error(res.error);
        setOpciones(res);
        if (res.fecha_max) {
          setHasta(res.fecha_max);
          const inicio = sumarDias(res.fecha_max, -27);
          setDesde(res.fecha_min && res.fecha_min > inicio ? res.fecha_min : inicio);
        } else {
          setLoading(false);
        }
      })
      .catch((e) => {
        setError(e.message ?? "No se pudieron cargar los filtros.");
        setLoading(false);
      });
  }, []);

  const query = useMemo(() => {
    if (!desde || !hasta) return "";
    const p = new URLSearchParams({ desde, hasta, returning: incluirReturning ? "1" : "0", rechazadas: incluirRechazadas ? "1" : "0" });
    estados.forEach((v) => p.append("estado", v));
    tiendas.forEach((v) => p.append("tienda", v));
    repartidores.forEach((v) => p.append("repartidor", v));
    return p.toString();
  }, [desde, hasta, estados, tiendas, repartidores, incluirReturning, incluirRechazadas]);

  useEffect(() => {
    if (!query) return;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/devoluciones/panorama?${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res);
        })
        .catch((e) => setError(e.message ?? "No se pudo cargar el panorama."))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function preset(dias: number) {
    if (!opciones?.fecha_max) return;
    setHasta(opciones.fecha_max);
    setDesde(sumarDias(opciones.fecha_max, -(dias - 1)));
  }

  const k = data?.kpis;
  const hayAnterior = !!k && k.ant_total > 0;
  const topTiendas = useMemo(
    () =>
      (data?.tiendas ?? [])
        .filter((t) => t.ordenes >= minOrdenes)
        .sort((a, b) => b.pct_dev - a.pct_dev)
        .slice(0, 10),
    [data, minOrdenes]
  );
  const maxMotivo = Math.max(0, ...(data?.motivos ?? []).map((m) => m.ordenes));
  const maxEstado = Math.max(0, ...(data?.estados ?? []).map((e) => e.devueltas));
  const cargando = (v: string) => (loading ? "…" : v);

  if (opciones && !opciones.fecha_max) {
    return (
      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 text-sm text-ink-700 shadow-card">
        Todavía no hay data de tiempos cargada. Súbela en{" "}
        <a href="/upload" className="font-medium text-brand-600 hover:underline">Cargar datos</a> (tarjeta
        &quot;Data de Tiempos&quot;).
      </div>
    );
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Filtros</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-500">Rápido:</span>
            {[
              ["Última semana", 7],
              ["4 semanas", 28],
              ["3 meses", 91],
            ].map(([l, d]) => (
              <button
                key={l as string}
                onClick={() => preset(d as number)}
                className="rounded-md border border-ink-200 px-2 py-1 font-medium text-ink-700 hover:bg-ink-50"
              >
                {l}
              </button>
            ))}
            <button
              onClick={() => {
                setEstados([]);
                setTiendas([]);
                setRepartidores([]);
              }}
              className="ml-2 font-medium text-brand-600 hover:text-brand-700"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500">Desde</label>
            <input type="date" className={inputFecha} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500">Hasta</label>
            <input type="date" className={inputFecha} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <MultiSelectFilter label="Estado" items={opciones?.estados ?? []} selected={estados} onChange={setEstados} />
          <MultiSelectFilter label="Tienda" items={opciones?.tiendas ?? []} selected={tiendas} onChange={setTiendas} />
          <MultiSelectFilter
            label="Repartido por"
            items={opciones?.repartidores ?? []}
            selected={repartidores}
            onChange={setRepartidores}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-ink-100 pt-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-ink-700">
            <input
              type="checkbox"
              checked={incluirReturning}
              onChange={(e) => onIncluirReturning(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-500"
            />
            Contar RETURNING como devuelta
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-ink-700">
            <input
              type="checkbox"
              checked={incluirRechazadas}
              onChange={(e) => onIncluirRechazadas(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-500"
            />
            Contar rechazadas como canceladas
          </label>
          <span className="text-xs text-ink-500">Aplica a todo: panorama, reporte semanal y Excel.</span>
        </div>
      </div>

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
        <p className="mt-1 text-xs text-ink-500">Pasa el mouse sobre la gráfica para ver el detalle de cada día.</p>
        <div className="mt-3">
          {data ? <GraficaDiaria datos={data.por_dia} /> : <div className="h-60 animate-pulse rounded-lg bg-ink-50" />}
        </div>
      </div>

      {/* Mapa + top tiendas */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">¿Dónde se concentran las devoluciones?</h2>
              <p className="mt-1 text-xs text-ink-500">
                {modoMapa === "tiendas"
                  ? "Cada círculo es una tienda, ubicada en el centro de su zona de entrega. Tamaño = devueltas; color = % de devolución."
                  : "Cada punto es una orden devuelta, en la ubicación del cliente."}
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
              {(
                [
                  ["tiendas", "Por tienda"],
                  ["ordenes", "Órdenes devueltas"],
                ] as [ModoMapa, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setModoMapa(id)}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    modoMapa === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <MapaDevoluciones
              tiendas={data?.tiendas ?? []}
              puntos={data?.puntos ?? []}
              modo={modoMapa}
              minOrdenes={minOrdenes}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
            {modoMapa === "tiendas" ? (
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
            ) : (
              <span>
                {int(data?.puntos.length)} órdenes devueltas en el mapa
                {(data?.puntos.length ?? 0) >= 6000 ? " (se muestran las 6,000 más recientes)" : ""}
              </span>
            )}
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
        </div>

        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Tiendas con mayor % de devolución</h2>
          <p className="mt-1 text-xs text-ink-500">Con {minOrdenes}+ órdenes en el periodo.</p>
          <ol className="mt-4 space-y-3">
            {topTiendas.map((t, i) => (
              <li key={t.tienda}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink-900">
                    <span className="mr-1.5 text-xs text-ink-300">{i + 1}</span>
                    {t.tienda}
                  </span>
                  <span className="flex-shrink-0 font-semibold tabular-nums" style={{ color: colorPct(t.pct_dev) }}>
                    {pct(t.pct_dev, 1)}
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  {int(t.devueltas)} de {int(t.ordenes)} órdenes · {money(t.monto_devuelto)}
                </p>
              </li>
            ))}
            {data && topTiendas.length === 0 && (
              <li className="text-xs text-ink-500">Ninguna tienda cumple el mínimo de órdenes.</li>
            )}
          </ol>
        </div>
      </div>

      {/* Motivos, repartidor, estados */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Motivos de cancelación</h2>
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
          <h2 className="text-sm font-semibold text-ink-900">Devoluciones por estado</h2>
          <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {(data?.estados ?? []).map((e) => (
              <li key={e.estado}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-ink-900">{e.estado}</span>
                  <span className="flex-shrink-0 tabular-nums text-ink-700">
                    {int(e.devueltas)}{" "}
                    <span className="font-semibold" style={{ color: colorPct(e.pct_dev) }}>
                      ({pct(e.pct_dev, 1)})
                    </span>
                  </span>
                </div>
                <Barra valor={e.devueltas} max={maxEstado} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
