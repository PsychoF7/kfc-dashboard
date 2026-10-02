"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import MultiSelectFilter from "@/components/MultiSelectFilter";

// ---------------------------------------------------------------------
// Tipos (lo que regresa get_flotilla_panorama)
// ---------------------------------------------------------------------
interface Comparable {
  total_prom: number | null;
  recol: number | null;
  entrega: number | null;
  pct_45: number | null;
  pct_dev: number | null;
  pct_canc: number | null;
}

interface TiendaMF {
  tienda: string;
  ordenes: number;
  completadas: number;
  devueltas: number;
  canceladas: number;
  pct_dev: number | null;
  pct_canc: number | null;
  total_prom: number | null;
  pct_45: number | null;
  asignacion: number | null;
  llegada: number | null;
  espera: number | null;
  entrega: number | null;
  primer_dia: string;
  ultimo_dia: string;
}

interface Flotilla {
  sin_datos?: boolean;
  periodo: { desde: string; hasta: string };
  tiendas_mf: string[];
  kpis: {
    ordenes: number;
    completadas: number;
    devueltas: number;
    canceladas: number;
    pct_dev: number | null;
    pct_canc: number | null;
    total_prom: number | null;
    pct_45: number | null;
    pct_60: number | null;
    asignacion: number | null;
    llegada: number | null;
    espera: number | null;
    entrega: number | null;
    tiendas_activas: number;
    ant_ordenes: number;
    ant_pct_dev: number | null;
    ant_total_prom: number | null;
  };
  comparativa: { flotilla: Comparable; delivery: Comparable };
  por_dia: { dia: string; ordenes: number; devueltas: number; total_prom: number | null; pct_45: number | null; pct_dev: number | null }[];
  por_hora: { hora: number; ordenes: number; total_prom: number | null; pct_45: number | null }[];
  tiendas: TiendaMF[];
}

const META = 45;
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const min = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${n.toFixed(d)} min`);
const pct = (x: number | null | undefined, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const fechaCorta = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const hora12 = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "am" : "pm"}`;
const colorTotal = (v: number | null) =>
  v == null ? "#B9B8C8" : v <= 25 ? "#1F8A54" : v <= 35 ? "#E0B000" : v <= 45 ? "#F07C1B" : "#D63A3A";

const ETAPAS = [
  { k: "asignacion", nombre: "Asignación", color: "#5A6BE0" },
  { k: "llegada", nombre: "Llegada a tienda", color: "#9AA6FF" },
  { k: "espera", nombre: "Espera en tienda", color: "#F07C1B" },
  { k: "entrega", nombre: "Entrega al cliente", color: "#891DFF" },
] as const;

// ---------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("rounded-xl border border-ink-100 bg-white p-5 shadow-card", className)}>{children}</div>;
}

function Seccion({
  titulo,
  descripcion,
  resumen,
  abierta: inicial = false,
  children,
}: {
  titulo: string;
  descripcion?: string;
  resumen?: React.ReactNode;
  abierta?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(inicial);
  return (
    <div className="rounded-xl border border-ink-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="flex w-full items-start justify-between gap-4 p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex items-start gap-3">
          <span aria-hidden className={clsx("mt-1 inline-block text-[10px] text-ink-500 transition-transform", abierta && "rotate-90")}>
            ▶
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink-900">{titulo}</span>
            {descripcion && <span className="mt-0.5 block text-xs text-ink-500">{descripcion}</span>}
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-3 text-xs text-ink-500">
          {resumen}
          <span className="font-medium text-brand-600">{abierta ? "Ocultar" : "Ver"}</span>
        </span>
      </button>
      {abierta && <div className="border-t border-ink-100 p-5">{children}</div>}
    </div>
  );
}

/** Barra de etapas: asignación → llegada → espera → entrega. */
function BarraEtapas({ v, compacta = false }: { v: Partial<Record<(typeof ETAPAS)[number]["k"], number | null>>; compacta?: boolean }) {
  const total = ETAPAS.reduce((s, e) => s + (v[e.k] ?? 0), 0);
  if (!total) return <span className="text-xs text-ink-300">Sin datos</span>;
  return (
    <div>
      <div className={clsx("flex w-full overflow-hidden rounded-md", compacta ? "h-4" : "h-9")}>
        {ETAPAS.map((e) => {
          const val = v[e.k] ?? 0;
          return (
            <div
              key={e.k}
              className="flex items-center justify-center text-xs font-semibold text-white"
              style={{ width: `${(val / total) * 100}%`, background: e.color }}
              title={`${e.nombre}: ${min(val)}`}
            >
              {!compacta && val / total > 0.12 ? min(val, 0) : ""}
            </div>
          );
        })}
      </div>
      {!compacta && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-700">
          {ETAPAS.map((e) => (
            <span key={e.k} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: e.color }} />
              {e.nombre}: <span className="font-semibold">{min(v[e.k])}</span>
              <span className="text-ink-500">({Math.round(((v[e.k] ?? 0) / total) * 100)}%)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Gráfica por día: barras de órdenes + línea de tiempo total. */
function GraficaDia({ datos }: { datos: Flotilla["por_dia"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (datos.length === 0) return <p className="text-xs text-ink-500">Sin órdenes en el periodo.</p>;
  const W = 760;
  const H = 230;
  const pad = { l: 40, r: 40, t: 16, b: 30 };
  const maxO = Math.max(1, ...datos.map((d) => d.ordenes)) * 1.15;
  const maxT = Math.max(META * 1.1, ...datos.map((d) => d.total_prom ?? 0)) * 1.1;
  const ancho = (W - pad.l - pad.r) / datos.length;
  const yO = (v: number) => pad.t + (1 - v / maxO) * (H - pad.t - pad.b);
  const yT = (v: number) => pad.t + (1 - v / maxT) * (H - pad.t - pad.b);
  const xc = (i: number) => pad.l + i * ancho + ancho / 2;
  const linea = datos
    .map((d, i) => (d.total_prom == null ? null : `${xc(i).toFixed(1)},${yT(d.total_prom).toFixed(1)}`))
    .filter(Boolean)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
    .join(" ");
  const cada = Math.max(1, Math.ceil(datos.length / 14));
  const sel = hover != null ? datos[hover] : null;
  const etiqueta = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d}/${m}`;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Órdenes y tiempo por día" onMouseLeave={() => setHover(null)}>
        <line x1={pad.l} x2={W - pad.r} y1={yT(META)} y2={yT(META)} stroke="#D63A3A" strokeDasharray="5 4" strokeWidth="1.2" />
        <text x={W - pad.r + 4} y={yT(META) + 4} fontSize="10" fill="#D63A3A">
          45
        </text>
        {datos.map((d, i) => (
          <g key={d.dia} onMouseEnter={() => setHover(i)}>
            <rect x={pad.l + i * ancho} y={pad.t} width={ancho} height={H - pad.t - pad.b} fill={hover === i ? "#F5F4FA" : "transparent"} />
            <rect x={pad.l + i * ancho + ancho * 0.18} y={yO(d.ordenes)} width={ancho * 0.64} height={H - pad.b - yO(d.ordenes)} rx="2" fill="#D9D4FF" />
            {i % cada === 0 && (
              <text x={xc(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6E6E86">
                {etiqueta(d.dia)}
              </text>
            )}
          </g>
        ))}
        <path d={linea} fill="none" stroke="#891DFF" strokeWidth="2.5" pointerEvents="none" />
        {datos.map((d, i) =>
          d.total_prom == null ? null : <circle key={d.dia} cx={xc(i)} cy={yT(d.total_prom)} r={hover === i ? 4.5 : 2.5} fill="#891DFF" pointerEvents="none" />
        )}
      </svg>
      {sel && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-ink-100 bg-white p-3 text-xs shadow-card"
          style={{ left: `${Math.min(Math.max((xc(hover) / W) * 100, 10), 70)}%` }}
        >
          <p className="font-semibold text-ink-900">{fechaCorta(sel.dia)}</p>
          <p className="mt-1 text-ink-700">{int(sel.ordenes)} órdenes</p>
          <p className="text-ink-700">Tiempo total: <span className="font-medium text-brand-600">{min(sel.total_prom)}</span></p>
          <p className="text-ink-700">{pct(sel.pct_45)} en menos de 45 min</p>
          <p className="text-ink-700">{int(sel.devueltas)} devueltas ({pct(sel.pct_dev)})</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#D9D4FF]" /> Órdenes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand-500" /> Tiempo total promedio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-danger" /> 45 min
        </span>
      </div>
    </div>
  );
}

/** Barras por hora (tiempo total), con el detalle al pasar el mouse. */
function GraficaHora({ datos }: { datos: Flotilla["por_hora"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const filas = datos.filter((d) => d.ordenes >= 5);
  if (filas.length === 0) return <p className="text-xs text-ink-500">Sin datos suficientes por hora.</p>;
  const W = 1100;
  const H = 230;
  const pad = { l: 36, r: 12, t: 16, b: 30 };
  const maxY = Math.max(META * 1.1, ...filas.map((d) => d.total_prom ?? 0)) * 1.08;
  const ancho = (W - pad.l - pad.r) / filas.length;
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const sel = hover != null ? filas[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tiempo total por hora" onMouseLeave={() => setHover(null)}>
        {[0, maxY / 2, maxY].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9EAF2" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6E6E86">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {filas.map((d, i) => {
          const v = d.total_prom ?? 0;
          return (
            <g key={d.hora} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * ancho} y={pad.t} width={ancho} height={H - pad.t - pad.b} fill={hover === i ? "#F5F4FA" : "transparent"} />
              <rect x={pad.l + i * ancho + ancho * 0.15} y={y(v)} width={ancho * 0.7} height={H - pad.b - y(v)} rx="3" fill={colorTotal(v)} opacity="0.85" />
              <text x={pad.l + i * ancho + ancho / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="#6E6E86">
                {d.hora}
              </text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(META)} y2={y(META)} stroke="#D63A3A" strokeWidth="1.2" strokeDasharray="5 4" />
      </svg>
      {sel && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg border border-ink-100 bg-white p-3 text-xs shadow-card"
          style={{ left: `${Math.min(Math.max(((pad.l + hover * ancho) / W) * 100, 8), 72)}%` }}
        >
          <p className="font-semibold text-ink-900">
            {hora12(sel.hora)} a {hora12((sel.hora + 1) % 24)}
          </p>
          <p className="mt-1 text-ink-700">Tiempo total: {min(sel.total_prom)}</p>
          <p className="text-ink-700">{pct(sel.pct_45)} en menos de 45 min</p>
          <p className="text-ink-500">{int(sel.ordenes)} órdenes</p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">Hora en que se creó la orden (0 a 23 h). Línea roja = 45 min.</p>
    </div>
  );
}

/** Fila de la comparación Mi Flotilla vs Delivery. */
function FilaComparacion({
  etiqueta,
  mf,
  dl,
  formato,
  menorEsMejor = true,
}: {
  etiqueta: string;
  mf: number | null;
  dl: number | null;
  formato: (n: number | null) => string;
  menorEsMejor?: boolean;
}) {
  const max = Math.max(mf ?? 0, dl ?? 0) || 1;
  const mejor = mf != null && dl != null && (menorEsMejor ? mf <= dl : mf >= dl);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-900">{etiqueta}</span>
        {mf != null && dl != null && (
          <span className={clsx("text-xs font-semibold", mejor ? "text-success" : "text-danger")}>
            {mejor ? "Mi Flotilla mejor" : "Delivery mejor"}
          </span>
        )}
      </div>
      <div className="mt-1.5 space-y-1">
        {(
          [
            ["Mi Flotilla", mf, "#891DFF"],
            ["Delivery", dl, "#B9B8C8"],
          ] as const
        ).map(([n, v, c]) => (
          <div key={n} className="flex items-center gap-2 text-xs">
            <span className="w-20 flex-shrink-0 text-ink-500">{n}</span>
            <div className="h-2.5 flex-1 rounded-full bg-ink-100">
              <div className="h-2.5 rounded-full" style={{ width: `${((v ?? 0) / max) * 100}%`, background: c }} />
            </div>
            <span className="w-16 flex-shrink-0 text-right font-medium tabular-nums text-ink-900">{formato(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function FlotillaPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [data, setData] = useState<Flotilla | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<"ordenes" | "total" | "dev">("ordenes");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    tiendas.forEach((t) => p.append("tienda", t));
    return p.toString();
  }, [desde, hasta, tiendas]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/flotilla/panorama?${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res);
        })
        .catch((e) => setError(e.message ?? "No se pudo cargar Mi Flotilla."))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const k = data?.kpis;
  const cmp = data?.comparativa;
  const hayAnterior = !!k && k.ant_ordenes > 0;
  const cargando = (v: string) => (loading ? "…" : v);
  const lista = [...(data?.tiendas ?? [])].sort((a, b) =>
    orden === "ordenes" ? b.ordenes - a.ordenes : orden === "total" ? (b.total_prom ?? 0) - (a.total_prom ?? 0) : (b.pct_dev ?? 0) - (a.pct_dev ?? 0)
  );
  const campo =
    "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  if (data?.sin_datos) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-semibold text-ink-900">Mi Flotilla</h1>
        <Card className="mt-6">
          <p className="text-sm text-ink-700">Todavía no hay órdenes de tiendas Mi Flotilla (MF) en la data de operaciones.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Mi Flotilla</h1>
      <p className="mt-1 text-sm text-ink-500">
        Tiendas con repartidores propios (terminan en &quot;MF&quot;). Data de operaciones; resumen arriba y detalle abajo.
      </p>

      {/* Filtros */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Filtros</h2>
          <button
            onClick={() => {
              setDesde("");
              setHasta("");
              setTiendas([]);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Limpiar filtros
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500">Desde</label>
            <input type="date" className={campo} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500">Hasta</label>
            <input type="date" className={campo} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <MultiSelectFilter label="Tienda MF" items={data?.tiendas_mf ?? []} selected={tiendas} onChange={setTiendas} />
        </div>
      </Card>
      {data?.periodo && (
        <p className="mt-2 text-xs text-ink-500">
          Mostrando del {fechaCorta(data.periodo.desde)} al {fechaCorta(data.periodo.hasta)}
          {desde || hasta ? "" : " (toda la data)"}.
        </p>
      )}

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* ====================== RESUMEN ====================== */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Órdenes"
          value={cargando(int(k?.ordenes))}
          sublabel={k ? `${int(k.tiendas_activas)} ${k.tiendas_activas === 1 ? "tienda MF" : "tiendas MF"} con órdenes` : undefined}
        />
        <KpiCard
          label="Tiempo total promedio"
          value={cargando(min(k?.total_prom))}
          sublabel={
            hayAnterior && k?.total_prom != null && k.ant_total_prom != null
              ? `${k.total_prom <= k.ant_total_prom ? "▼" : "▲"} ${Math.abs(k.total_prom - k.ant_total_prom).toFixed(1)} min vs periodo anterior`
              : undefined
          }
          accent={(k?.total_prom ?? 99) <= META ? "success" : "danger"}
        />
        <KpiCard label="Entregadas en menos de 45 min" value={cargando(pct(k?.pct_45))} sublabel={`${pct(k?.pct_60)} en menos de 60`} accent="success" />
        <KpiCard
          label="% Devolución"
          value={cargando(pct(k?.pct_dev, 2))}
          sublabel={
            hayAnterior && k?.pct_dev != null && k.ant_pct_dev != null
              ? `${k.pct_dev <= k.ant_pct_dev ? "▼" : "▲"} ${Math.abs((k.pct_dev - k.ant_pct_dev) * 100).toFixed(2)} pts vs periodo anterior`
              : `${int(k?.devueltas)} devueltas`
          }
          accent={(k?.pct_dev ?? 1) <= 0.02 ? "success" : "warning"}
        />
        <KpiCard label="% Cancelación" value={cargando(pct(k?.pct_canc, 2))} sublabel={`${int(k?.canceladas)} canceladas o rechazadas`} accent={(k?.pct_canc ?? 1) <= 0.02 ? "success" : "danger"} />
        <KpiCard label="Asignación" value={cargando(min(k?.asignacion))} sublabel="Hasta que un repartidor la toma" />
        <KpiCard label="Espera en tienda" value={cargando(min(k?.espera))} sublabel="Repartidor esperando la orden" accent="warning" />
        <KpiCard label="Entrega al cliente" value={cargando(min(k?.entrega))} sublabel="De la tienda al cliente" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="text-sm font-semibold text-ink-900">Tendencia por día</h2>
          <p className="mt-1 text-xs text-ink-500">Pasa el mouse para ver el detalle de cada día.</p>
          <div className="mt-3">{data?.por_dia ? <GraficaDia datos={data.por_dia} /> : <div className="h-56 animate-pulse rounded-lg bg-ink-50" />}</div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Mi Flotilla vs Delivery</h2>
          <p className="mt-1 text-xs text-ink-500">Mismo periodo. Delivery = Uber y Rappi.</p>
          {cmp ? (
            <div className="mt-4 space-y-4">
              <FilaComparacion etiqueta="Tiempo total" mf={cmp.flotilla.total_prom} dl={cmp.delivery.total_prom} formato={(n) => min(n)} />
              <FilaComparacion etiqueta="Hasta que sale el repartidor" mf={cmp.flotilla.recol} dl={cmp.delivery.recol} formato={(n) => min(n)} />
              <FilaComparacion etiqueta="Entrega al cliente" mf={cmp.flotilla.entrega} dl={cmp.delivery.entrega} formato={(n) => min(n)} />
              <FilaComparacion etiqueta="En menos de 45 min" mf={cmp.flotilla.pct_45} dl={cmp.delivery.pct_45} formato={(n) => pct(n, 0)} menorEsMejor={false} />
              <FilaComparacion etiqueta="% Devolución" mf={cmp.flotilla.pct_dev} dl={cmp.delivery.pct_dev} formato={(n) => pct(n)} />
              <FilaComparacion etiqueta="% Cancelación" mf={cmp.flotilla.pct_canc} dl={cmp.delivery.pct_canc} formato={(n) => pct(n)} />
            </div>
          ) : (
            <div className="mt-4 h-56 animate-pulse rounded-lg bg-ink-50" />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-ink-900">Tendencia por hora</h2>
        <div className="mt-3">{data?.por_hora ? <GraficaHora datos={data.por_hora} /> : <div className="h-56 animate-pulse rounded-lg bg-ink-50" />}</div>
      </Card>

      {/* ====================== DETALLE ====================== */}
      <h2 className="mt-12 text-lg font-semibold text-ink-900">Detalle</h2>
      <p className="mt-1 text-sm text-ink-500">Abre cada sección para ver el análisis completo.</p>

      <div className="mt-4 space-y-4">
        <Seccion
          titulo="¿Dónde se pierde el tiempo?"
          descripcion="En Mi Flotilla cada orden trae las 4 etapas por separado. Así ves en qué etapa se va el tiempo, en general y por tienda."
          resumen={k ? <span>Espera en tienda: {min(k.espera)}</span> : null}
          abierta
        >
          <p className="text-sm font-medium text-ink-900">Todas las tiendas MF</p>
          <div className="mt-2">{k && <BarraEtapas v={k} />}</div>
          <p className="mt-6 text-sm font-medium text-ink-900">Por tienda</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4 font-medium">Tienda</th>
                  <th className="w-1/2 py-2 pr-4 font-medium">Etapas</th>
                  <th className="py-2 pr-4 text-right font-medium">Espera en tienda</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...(data?.tiendas ?? [])]
                  .sort((a, b) => (b.espera ?? 0) - (a.espera ?? 0))
                  .map((t) => (
                    <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
                      <td className="py-2 pr-4 text-ink-900">{t.tienda}</td>
                      <td className="py-2 pr-4">
                        <BarraEtapas v={t} compacta />
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">{min(t.espera)}</td>
                      <td className="py-2 text-right tabular-nums text-ink-700">{min(t.total_prom)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Seccion>

        <Seccion titulo="Tiendas MF" descripcion="Órdenes, tiempos y devoluciones de cada tienda en el periodo." resumen={<span>{lista.length} tiendas</span>}>
          <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
            {(
              [
                ["ordenes", "Más órdenes"],
                ["total", "Más lentas"],
                ["dev", "Más devoluciones"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setOrden(id)}
                className={clsx("rounded-md px-3 py-1.5 text-xs font-medium", orden === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4 font-medium">Tienda</th>
                  <th className="py-2 pr-4 text-right font-medium">Órdenes</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 pr-4 text-right font-medium">&lt; 45 min</th>
                  <th className="py-2 pr-4 text-right font-medium">Asignación</th>
                  <th className="py-2 pr-4 text-right font-medium">Llegada</th>
                  <th className="py-2 pr-4 text-right font-medium">Espera</th>
                  <th className="py-2 pr-4 text-right font-medium">Entrega</th>
                  <th className="py-2 pr-4 text-right font-medium">% Dev.</th>
                  <th className="py-2 text-right font-medium">% Canc.</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((t) => (
                  <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-4 text-ink-900">
                      {t.tienda}
                      <span className="block text-[11px] text-ink-500">
                        Primera orden del periodo: {fechaCorta(t.primer_dia)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(t.ordenes)}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums" style={{ color: colorTotal(t.total_prom) }}>
                      {min(t.total_prom)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(t.pct_45, 0)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{min(t.asignacion)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{min(t.llegada)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{min(t.espera)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{min(t.entrega)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{pct(t.pct_dev)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(t.pct_canc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      </div>
    </div>
  );
}
