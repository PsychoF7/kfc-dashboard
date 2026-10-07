"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import FiltersBar from "@/components/FiltersBar";
import KpiCard from "@/components/KpiCard";
import DetalleDia, { DetalleDiaVacio, buscarPrevio, type FilaDia } from "@/components/DetalleDia";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import { DashboardFilters, EMPTY_FILTERS, FilterOptions } from "@/lib/types";
import {
  META_MINUTOS,
  AlcanceZonaRoja,
  TiemposPanorama,
  TiemposTienda,
  ZonaRoja,
  colorMinutos,
  colorVelocidad,
  filtrosAQuery,
  minutos,
  pctTxt,
  zonasRojasDe,
} from "@/lib/tiempos";

const MapaTiempos = dynamic(() => import("@/components/tiempos/MapaTiempos"), {
  ssr: false,
  loading: () => <div className="h-[440px] w-full animate-pulse rounded-lg bg-ink-50" />,
});

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const fechaCorta = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const hora12 = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "am" : "pm"}`;
/** Color de la barra por hora según el tiempo total promedio. */
const colorTotal = (v: number) => (v <= 35 ? "#1F8A54" : v <= 40 ? "#E0B000" : v <= 45 ? "#F07C1B" : "#D63A3A");

// ---------------------------------------------------------------------
// Piezas reutilizables
// ---------------------------------------------------------------------
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-ink-100 bg-white p-5 shadow-card", className)}>{children}</div>
  );
}

/** Tarjeta que se abre y se cierra (las secciones de detalle). */
function Seccion({
  titulo,
  descripcion,
  resumen,
  abiertaInicial = false,
  children,
}: {
  titulo: string;
  descripcion?: string;
  resumen?: React.ReactNode;
  abiertaInicial?: boolean;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  return (
    <div className="rounded-xl border border-ink-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="flex w-full items-start justify-between gap-4 p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span className="flex items-start gap-3">
          <span
            aria-hidden
            className={clsx(
              "mt-1 inline-block text-[10px] text-ink-500 transition-transform motion-reduce:transition-none",
              abierta && "rotate-90"
            )}
          >
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

function VerMas({ total, mostrando, onClick, inicial }: { total: number; mostrando: number; onClick: () => void; inicial: number }) {
  if (total <= inicial) return null;
  return (
    <button onClick={onClick} className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700">
      {mostrando < total ? `Ver las ${total} tiendas` : `Mostrar solo ${inicial}`}
    </button>
  );
}

// ---------------------------------------------------------------------
// Gráfica por día (líneas en minutos, con la meta de 45 min)
// ---------------------------------------------------------------------
function GraficaDia({ datos }: { datos: TiemposPanorama["por_dia"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [fijo, setFijo] = useState<number | null>(null);
  if (datos.length < 2) return <p className="text-xs text-ink-500">Elige un periodo de al menos 2 días para ver la tendencia.</p>;
  const W = 760;
  const H = 240;
  const pad = { l: 44, r: 16, t: 16, b: 30 };
  const maxY = Math.max(META_MINUTOS * 1.15, ...datos.map((d) => Math.max(d.total_prom ?? 0, d.recol_prom ?? 0))) * 1.08;
  const paso = (W - pad.l - pad.r) / (datos.length - 1);
  const x = (i: number) => pad.l + i * paso;
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const linea = (k: "total_prom" | "recol_prom") =>
    datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[k] ?? 0).toFixed(1)}`).join(" ");
  const ticks = [0, maxY / 3, (2 * maxY) / 3, maxY];
  const cada = Math.max(1, Math.ceil(datos.length / 14));
  const etiqueta = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d}/${m}`;
  };
  const activo = hover ?? fijo;
  const sel = activo != null ? datos[activo] : null;
  const previo = sel ? buscarPrevio(datos, sel.dia) : undefined;
  const nombreDia = (iso: string) => {
    const t = new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tiempos promedio por día" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9EAF2" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6E6E86">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={y(META_MINUTOS)} y2={y(META_MINUTOS)} stroke="#D63A3A" strokeWidth="1.5" strokeDasharray="5 4" />
        <text x={W - pad.r} y={y(META_MINUTOS) - 5} textAnchor="end" fontSize="10" fill="#D63A3A">
          45 min
        </text>
        <path d={linea("recol_prom")} fill="none" stroke="#7D8FFF" strokeWidth="2" />
        <path d={linea("total_prom")} fill="none" stroke="#891DFF" strokeWidth="2.5" />
        {activo != null && <line x1={x(activo)} x2={x(activo)} y1={pad.t} y2={H - pad.b} stroke="#CFCEDD" strokeDasharray="3 3" />}
        {datos.map((d, i) => (
          <g key={d.dia}>
            <circle cx={x(i)} cy={y(d.total_prom ?? 0)} r={activo === i ? 4.5 : 2.5} fill="#891DFF" />
            <circle cx={x(i)} cy={y(d.recol_prom ?? 0)} r={activo === i ? 4 : 2} fill="#7D8FFF" />
            {i % cada === 0 && (
              <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#6E6E86">
                {etiqueta(d.dia)}
              </text>
            )}
            <rect x={x(i) - paso / 2} y={pad.t} width={paso} height={H - pad.t - pad.b} fill="transparent" style={{ cursor: "pointer" }} onMouseEnter={() => setHover(i)} onClick={() => setFijo((v) => (v === i ? null : i))} />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-brand-500" /> Tiempo total promedio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-peri" /> Hasta que sale el repartidor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-danger" /> Meta 45 min
        </span>
      </div>
      {sel ? (
        <DetalleDia
          dia={sel.dia}
          hayPrevio={!!previo}
          filas={
            [
              { etiqueta: "Órdenes completadas", actual: sel.ordenes, previo: previo?.ordenes, formato: "n", mejor: null },
              { etiqueta: "Tiempo total promedio", actual: sel.total_prom, previo: previo?.total_prom, formato: "min", mejor: "baja" },
              { etiqueta: "Hasta que sale el repartidor", actual: sel.recol_prom, previo: previo?.recol_prom, formato: "min", mejor: "baja" },
              { etiqueta: "% en menos de 45 min", actual: sel.pct_45, previo: previo?.pct_45, formato: "pct", mejor: "sube" },
            ] as FilaDia[]
          }
        />
      ) : (
        <DetalleDiaVacio />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Gráfica por hora (barras de tiempo total + % en menos de 45 min)
// ---------------------------------------------------------------------
function GraficaHora({ datos }: { datos: TiemposPanorama["por_hora"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const filas = datos.filter((d) => d.ordenes >= 20);
  if (filas.length === 0) return <p className="text-xs text-ink-500">Sin datos suficientes por hora.</p>;
  const W = 760;
  const H = 240;
  const pad = { l: 44, r: 16, t: 16, b: 30 };
  const maxY = Math.max(META_MINUTOS * 1.15, ...filas.map((d) => d.total_prom ?? 0)) * 1.08;
  const ancho = (W - pad.l - pad.r) / filas.length;
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const sel = hover != null ? filas[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Tiempo total promedio por hora" onMouseLeave={() => setHover(null)}>
        {[0, maxY / 2, maxY].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E9EAF2" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6E6E86">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {filas.map((d, i) => {
          const x0 = pad.l + i * ancho + ancho * 0.15;
          const v = d.total_prom ?? 0;
          return (
            <g key={d.hora} onMouseEnter={() => setHover(i)}>
              <rect x={pad.l + i * ancho} y={pad.t} width={ancho} height={H - pad.t - pad.b} fill={hover === i ? "#F5F4FA" : "transparent"} />
              <rect x={x0} y={y(v)} width={ancho * 0.7} height={H - pad.b - y(v)} rx="3" fill={colorTotal(v)} opacity="0.85" />
              <text x={x0 + ancho * 0.35} y={H - 10} textAnchor="middle" fontSize="10" fill="#6E6E86">
                {d.hora}
              </text>
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={y(META_MINUTOS)} y2={y(META_MINUTOS)} stroke="#D63A3A" strokeWidth="1.5" strokeDasharray="5 4" />
      </svg>
      {sel && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-56 rounded-lg border border-ink-100 bg-white p-3 text-xs shadow-card"
          style={{ left: `${Math.min(Math.max(((pad.l + hover * ancho) / W) * 100, 8), 70)}%` }}
        >
          <p className="font-semibold text-ink-900">
            {hora12(sel.hora)} a {hora12((sel.hora + 1) % 24)}
          </p>
          <p className="mt-1 text-ink-700">Tiempo total: <span className="font-medium">{minutos(sel.total_prom)}</span></p>
          <p className="text-ink-700">Hasta que sale el repartidor: {minutos(sel.recol_prom)}</p>
          <p className="text-ink-700">{pctTxt(sel.pct_45)} en menos de 45 min</p>
          <p className="text-ink-700">Velocidad aprox.: {sel.kmh == null ? "—" : `${sel.kmh.toFixed(1)} km/h`}</p>
          <p className="mt-1 text-ink-500">{int(sel.ordenes)} órdenes completadas</p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">
        Barras = tiempo total promedio por hora en que se creó la orden (0 a 23 h). La línea roja es la meta de 45 min.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Barra de etapas ("¿dónde se pierde el tiempo?")
// ---------------------------------------------------------------------
function BarraEtapas({ etapas }: { etapas: { nombre: string; min: number | null; color: string }[] }) {
  const total = etapas.reduce((s, e) => s + (e.min ?? 0), 0);
  if (!total) return <p className="text-xs text-ink-500">Sin datos.</p>;
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-lg">
        {etapas.map((e) => (
          <div
            key={e.nombre}
            className="flex items-center justify-center text-xs font-semibold text-white"
            style={{ width: `${((e.min ?? 0) / total) * 100}%`, background: e.color }}
            title={`${e.nombre}: ${minutos(e.min)}`}
          >
            {(e.min ?? 0) / total > 0.12 ? minutos(e.min, 0) : ""}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-700">
        {etapas.map((e) => (
          <span key={e.nombre} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: e.color }} />
            {e.nombre}: <span className="font-semibold">{minutos(e.min)}</span>
            <span className="text-ink-500">({Math.round(((e.min ?? 0) / total) * 100)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Zonas rojas
// ---------------------------------------------------------------------
function ZonasRojas({
  zonas,
  opciones,
  onCambio,
}: {
  zonas: ZonaRoja[];
  opciones: FilterOptions | null;
  onCambio: () => void;
}) {
  const vacia = { alcance: "zona" as AlcanceZonaRoja, valores: [] as string[], horario: "", nota: "" };
  const [borrador, setBorrador] = useState<(typeof vacia & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const campo =
    "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const items = (a: AlcanceZonaRoja) =>
    a === "zona" ? opciones?.zonas ?? [] : a === "ciudad" ? opciones?.ciudades ?? [] : opciones?.restaurantes ?? [];

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/tiempos/zonas-rojas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(borrador),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "No se pudo guardar.");
      setBorrador(null);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    const res = await fetch(`/api/tiempos/zonas-rojas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setBorrando(null);
      onCambio();
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-500">
          Marca zonas, ciudades o tiendas conflictivas (inseguridad, accesos difíciles, bloqueos frecuentes). Salen con
          borde rojo punteado en el mapa y marcadas en el ranking.
        </p>
        {!borrador && (
          <button
            onClick={() => {
              setError(null);
              setBorrador({ ...vacia });
            }}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            + Marcar zona roja
          </button>
        )}
      </div>

      {borrador && (
        <div className="mt-4 rounded-lg border border-brand-500 bg-brand-50 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">¿Qué quieres marcar?</label>
              <select
                className={campo}
                value={borrador.alcance}
                onChange={(e) => setBorrador({ ...borrador, alcance: e.target.value as AlcanceZonaRoja, valores: [] })}
              >
                <option value="zona">Zona</option>
                <option value="ciudad">Ciudad</option>
                <option value="tienda">Tienda</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <MultiSelectFilter
                label={borrador.alcance === "zona" ? "Zonas" : borrador.alcance === "ciudad" ? "Ciudades" : "Tiendas"}
                items={items(borrador.alcance)}
                selected={borrador.valores}
                onChange={(v) => setBorrador({ ...borrador, valores: v })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">Horario (opcional)</label>
              <input
                className={campo}
                placeholder="Ej. después de las 10 pm"
                value={borrador.horario}
                onChange={(e) => setBorrador({ ...borrador, horario: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-xs font-medium text-ink-500">¿Por qué es zona roja?</label>
              <input
                className={campo}
                placeholder="Ej. repartidores reportan inseguridad; no entran después de las 10 pm."
                value={borrador.nota}
                onChange={(e) => setBorrador({ ...borrador, nota: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setBorrador(null)}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {zonas.length === 0 ? (
        <p className="mt-4 text-xs text-ink-500">Todavía no hay zonas rojas marcadas.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-100">
          {zonas.map((z) => (
            <li key={z.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-ink-900">
                  <span className="mr-1.5 rounded bg-danger-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase text-danger">
                    {z.alcance}
                  </span>
                  <span className="font-medium">{z.valores.join(", ")}</span>
                  {z.horario && <span className="text-ink-500"> · {z.horario}</span>}
                </p>
                <p className="mt-0.5 text-sm text-ink-700">{z.nota}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2 text-xs">
                {borrando === z.id ? (
                  <>
                    <span className="text-ink-500">¿Borrar?</span>
                    <button onClick={() => borrar(z.id)} className="font-semibold text-danger hover:underline">
                      Sí, borrar
                    </button>
                    <button onClick={() => setBorrando(null)} className="font-medium text-ink-500 hover:underline">
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setBorrador({ id: z.id, alcance: z.alcance, valores: z.valores, horario: z.horario ?? "", nota: z.nota })}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button onClick={() => setBorrando(z.id)} className="font-medium text-ink-500 hover:underline">
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function TiemposPage() {
  const [opciones, setOpciones] = useState<FilterOptions | null>(null);
  const [filtros, setFiltros] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<TiemposPanorama | null>(null);
  const [zonasRojas, setZonasRojas] = useState<ZonaRoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [minOrdenes, setMinOrdenes] = useState(30);
  const [orden, setOrden] = useState<"lentas" | "rapidas">("lentas");
  const [todas, setTodas] = useState(false);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    fetch("/api/filters", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => setOpciones(Array.isArray(res) ? res[0] ?? null : res))
      .catch(() => undefined);
  }, []);

  const query = useMemo(() => filtrosAQuery(filtros), [filtros]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/tiempos/panorama?${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res.panorama?.kpis ? res.panorama : null);
          setZonasRojas(res.zonasRojas ?? []);
        })
        .catch((e) => setError(e.message ?? "No se pudo cargar el análisis."))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query, recargar]);

  const esZonaRoja = useCallback((t: TiemposTienda) => zonasRojasDe(t, zonasRojas).length > 0, [zonasRojas]);

  async function descargarExcel() {
    setDescargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/tiempos/excel?${query}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? "No se pudo generar el Excel.");
      }
      const blob = await res.blob();
      const nombre = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "Tiempos_KFC.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel.");
    } finally {
      setDescargando(false);
    }
  }

  const k = data?.kpis;
  const hayAnterior = !!k && k.ant_completadas > 0;
  const cargando = (v: string) => (loading ? "…" : v);
  const conMinimo = (data?.tiendas ?? []).filter((t) => t.completadas >= minOrdenes && t.recol_med != null);
  const ranking = [...conMinimo].sort((a, b) =>
    orden === "lentas" ? (b.recol_med ?? 0) - (a.recol_med ?? 0) : (a.recol_med ?? 0) - (b.recol_med ?? 0)
  );
  const lentas = [...conMinimo].sort((a, b) => (b.recol_med ?? 0) - (a.recol_med ?? 0)).slice(0, 5);
  const rapidas = [...conMinimo].sort((a, b) => (a.recol_med ?? 0) - (b.recol_med ?? 0)).slice(0, 5);
  const esperaExacta = (data?.tiendas ?? [])
    .filter((t) => t.n_espera >= 10 && t.espera_prom != null)
    .sort((a, b) => (b.espera_prom ?? 0) - (a.espera_prom ?? 0))
    .slice(0, 10);
  const asignacion = (data?.tiendas ?? [])
    .filter((t) => t.n_espera >= 10 && t.asignacion_prom != null)
    .sort((a, b) => (b.asignacion_prom ?? 0) - (a.asignacion_prom ?? 0))
    .slice(0, 10);

  // Tráfico: zonas (filas) × horas (columnas)
  const trafico = data?.trafico ?? [];
  const horas = Array.from(new Set(trafico.map((t) => t.hora))).sort((a, b) => a - b);
  const zonasTrafico = Array.from(
    trafico.reduce((m, t) => m.set(t.zona, (m.get(t.zona) ?? 0) + t.ordenes), new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .map(([z]) => z)
    .slice(0, 20);
  const celda = (zona: string, hora: number) => trafico.find((t) => t.zona === zona && t.hora === hora);
  const horasLentas = [...(data?.por_hora ?? [])]
    .filter((h) => h.kmh != null && h.ordenes >= 50)
    .sort((a, b) => (a.kmh ?? 0) - (b.kmh ?? 0))
    .slice(0, 3)
    .sort((a, b) => a.hora - b.hora);

  const maxRel = Math.max(0.01, ...(data?.relacion_devoluciones ?? []).map((r) => r.pct_dev ?? 0));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Análisis de tiempos</h1>
          <p className="mt-1 text-sm text-ink-500">
            Resumen visual arriba y el detalle abajo. Data de operaciones, solo órdenes completadas de KFC.
          </p>
        </div>
        <button
          onClick={descargarExcel}
          disabled={!data || descargando || loading}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {descargando ? "Generando Excel…" : "Descargar Excel"}
        </button>
      </div>

      <div className="mt-6">
        <FiltersBar options={opciones} filters={filtros} onChange={setFiltros} onClear={() => setFiltros(EMPTY_FILTERS)} />
      </div>
      {data?.periodo && (
        <p className="mt-2 text-xs text-ink-500">
          Mostrando del {fechaCorta(data.periodo.desde)} al {fechaCorta(data.periodo.hasta)}
          {filtros.date_from || filtros.date_to ? "" : " (toda la data)"}.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {/* ====================== RESUMEN VISUAL ====================== */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Tiempo total promedio"
          value={cargando(minutos(k?.total_prom))}
          sublabel={
            hayAnterior && k?.total_prom != null && k.ant_total_prom != null
              ? `${k.total_prom <= k.ant_total_prom ? "▼" : "▲"} ${Math.abs(k.total_prom - k.ant_total_prom).toFixed(1)} min vs periodo anterior`
              : `${int(k?.completadas)} órdenes completadas`
          }
          accent={(k?.total_prom ?? 99) <= META_MINUTOS ? "success" : "danger"}
        />
        <KpiCard
          label="Entregadas en menos de 45 min"
          value={cargando(pctTxt(k?.pct_45))}
          sublabel={
            hayAnterior && k?.pct_45 != null && k.ant_pct_45 != null
              ? `${k.pct_45 >= k.ant_pct_45 ? "▲" : "▼"} ${Math.abs((k.pct_45 - k.ant_pct_45) * 100).toFixed(1)} pts vs periodo anterior`
              : undefined
          }
          accent={(k?.pct_45 ?? 0) >= 0.8 ? "success" : "warning"}
        />
        <KpiCard label="Entregadas en menos de 60 min" value={cargando(pctTxt(k?.pct_60))} />
        <KpiCard
          label="Hasta que sale el repartidor"
          value={cargando(minutos(k?.recol_prom))}
          sublabel={`Mediana ${minutos(k?.recol_med)} · de la creación a la recolección`}
          accent="warning"
        />
        <KpiCard label="Entrega al cliente" value={cargando(minutos(k?.entrega_prom))} sublabel="De la tienda al cliente" />
        <KpiCard
          label="Espera exacta en tienda"
          value={cargando(minutos(k?.espera_prom))}
          sublabel={`Solo Rappi y flotilla (${int(k?.n_espera)} órdenes)`}
        />
        <KpiCard
          label="Velocidad aprox. del repartidor"
          value={cargando(k?.kmh_med == null ? "—" : `${k.kmh_med.toFixed(1)} km/h`)}
          sublabel="Más lento = más tráfico"
        />
        <KpiCard
          label="Tiendas lentas (+5 min vs su zona)"
          value={cargando(`${conMinimo.filter((t) => (t.vs_zona ?? 0) >= 5).length} de ${conMinimo.length}`)}
          sublabel={`Tiendas con ${minOrdenes}+ órdenes`}
          accent="danger"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Tendencia por día</h2>
          <p className="mt-1 text-xs text-ink-500">Pasa el mouse para ver el detalle de cada día.</p>
          <div className="mt-3">{data ? <GraficaDia datos={data.por_dia} /> : <div className="h-60 animate-pulse rounded-lg bg-ink-50" />}</div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Tendencia por hora</h2>
          <p className="mt-1 text-xs text-ink-500">Para ubicar los horarios críticos.</p>
          <div className="mt-3">{data ? <GraficaHora datos={data.por_hora} /> : <div className="h-60 animate-pulse rounded-lg bg-ink-50" />}</div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Mapa de tiendas</h2>
              <p className="mt-1 text-xs text-ink-500">
                Color = minutos hasta que el repartidor sale con la orden. Tamaño = órdenes. Borde rojo punteado = zona roja.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-500">
              Mínimo de órdenes
              <select
                value={minOrdenes}
                onChange={(e) => setMinOrdenes(Number(e.target.value))}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
              >
                {[1, 10, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3">
            <MapaTiempos tiendas={data?.tiendas ?? []} minOrdenes={minOrdenes} esZonaRoja={esZonaRoja} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
            {[
              [20, "≤ 25 min"],
              [30, "25–35 min"],
              [40, "35–45 min"],
              [50, "> 45 min"],
            ].map(([v, l]) => (
              <span key={l as string} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: colorMinutos(v as number) }} />
                {l}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Más lentas en entregar al repartidor</h2>
          <ol className="mt-3 space-y-2.5">
            {lentas.map((t, i) => (
              <li key={t.tienda}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink-900">
                    <span className="mr-1.5 text-xs text-ink-300">{i + 1}</span>
                    {t.tienda}
                    {esZonaRoja(t) && <span className="ml-1 text-[10px] font-semibold text-danger">ZR</span>}
                  </span>
                  <span className="flex-shrink-0 font-semibold tabular-nums" style={{ color: colorMinutos(t.recol_med) }}>
                    {minutos(t.recol_med)}
                  </span>
                </div>
                <p className="text-xs text-ink-500">
                  {t.vs_zona != null && `${t.vs_zona >= 0 ? "+" : ""}${t.vs_zona.toFixed(1)} min vs su zona · `}
                  {pctTxt(t.pct_45, 0)} en menos de 45
                </p>
              </li>
            ))}
          </ol>
          <h2 className="mt-5 text-sm font-semibold text-ink-900">Más rápidas</h2>
          <ol className="mt-3 space-y-2.5">
            {rapidas.map((t, i) => (
              <li key={t.tienda} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-ink-900">
                  <span className="mr-1.5 text-xs text-ink-300">{i + 1}</span>
                  {t.tienda}
                </span>
                <span className="flex-shrink-0 font-semibold tabular-nums" style={{ color: colorMinutos(t.recol_med) }}>
                  {minutos(t.recol_med)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* ====================== DETALLE (DESPLEGABLE) ====================== */}
      <h2 className="mt-12 text-lg font-semibold text-ink-900">Detalle</h2>
      <p className="mt-1 text-sm text-ink-500">Abre cada sección para ver el análisis completo.</p>

      <div className="mt-4 space-y-4">
        <Seccion
          titulo="¿Dónde se pierde el tiempo?"
          descripcion="Cuánto pesa cada etapa de la orden y qué tiendas se tardan más en asignar y en entregar al repartidor."
          resumen={k ? <span>{minutos(data?.etapas.recol, 0)} hasta que sale · {minutos(data?.etapas.entrega, 0)} de entrega</span> : null}
          abiertaInicial
        >
          <p className="text-sm font-medium text-ink-900">Todas las órdenes</p>
          <div className="mt-2">
            <BarraEtapas
              etapas={[
                { nombre: "Hasta que el repartidor sale con la orden", min: data?.etapas.recol ?? null, color: "#891DFF" },
                { nombre: "Entrega al cliente", min: data?.etapas.entrega ?? null, color: "#7D8FFF" },
              ]}
            />
          </div>
          {data?.etapas.detalle && data.etapas.detalle.ordenes > 0 && (
            <>
              <p className="mt-6 text-sm font-medium text-ink-900">
                Detalle por etapa (Rappi y flotilla, {int(data.etapas.detalle.ordenes)} órdenes)
              </p>
              <p className="text-xs text-ink-500">
                En Uber la plataforma no separa asignación, llegada y espera; por eso este detalle solo sale donde sí viene.
              </p>
              <div className="mt-2">
                <BarraEtapas
                  etapas={[
                    { nombre: "Asignación", min: data.etapas.detalle.asignacion, color: "#5A6BE0" },
                    { nombre: "Llegada a tienda", min: data.etapas.detalle.llegada, color: "#9AA6FF" },
                    { nombre: "Espera en tienda", min: data.etapas.detalle.espera, color: "#F07C1B" },
                    { nombre: "Entrega al cliente", min: data.etapas.detalle.entrega, color: "#7D8FFF" },
                  ]}
                />
              </div>
            </>
          )}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-ink-900">Más tardan en entregar la orden al repartidor</p>
              <p className="text-xs text-ink-500">Espera exacta en tienda (mínimo 10 órdenes con el dato).</p>
              <TablaSimple filas={esperaExacta} valor={(t) => t.espera_prom} n={(t) => t.n_espera} esZonaRoja={esZonaRoja} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Más tardan en asignar repartidor</p>
              <p className="text-xs text-ink-500">Tiempo de asignación (Rappi y flotilla, mínimo 10 órdenes).</p>
              <TablaSimple filas={asignacion} valor={(t) => t.asignacion_prom} n={(t) => t.n_espera} esZonaRoja={esZonaRoja} />
            </div>
          </div>
        </Seccion>

        <Seccion
          titulo="Ranking de tiendas"
          descripcion="Lentas = las que más tardan hasta que el repartidor sale con la orden; se comparan contra su misma zona."
          resumen={<span>{conMinimo.length} tiendas</span>}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
              {(
                [
                  ["lentas", "Más lentas"],
                  ["rapidas", "Más rápidas"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setOrden(id)}
                  className={clsx(
                    "rounded-md px-3 py-1.5 text-xs font-medium",
                    orden === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-ink-500">Tiendas con {minOrdenes}+ órdenes completadas (cámbialo arriba en el mapa).</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4 font-medium">Tienda</th>
                  <th className="py-2 pr-4 font-medium">Zona</th>
                  <th className="py-2 pr-4 text-right font-medium">Órdenes</th>
                  <th className="py-2 pr-4 text-right font-medium">Hasta que sale</th>
                  <th className="py-2 pr-4 text-right font-medium">vs su zona</th>
                  <th className="py-2 pr-4 text-right font-medium">Espera exacta</th>
                  <th className="py-2 pr-4 text-right font-medium">Entrega</th>
                  <th className="py-2 pr-4 text-right font-medium">Total</th>
                  <th className="py-2 pr-4 text-right font-medium">&lt; 45 min</th>
                  <th className="py-2 text-right font-medium">% Dev.</th>
                </tr>
              </thead>
              <tbody>
                {(todas ? ranking : ranking.slice(0, 20)).map((t) => (
                  <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-4 text-ink-900">
                      {t.tienda}
                      {esZonaRoja(t) && (
                        <span className="ml-1.5 rounded bg-danger-bg px-1 py-0.5 text-[10px] font-semibold text-danger">zona roja</span>
                      )}
                    </td>
                    <td className="max-w-[160px] truncate py-2 pr-4 text-xs text-ink-500">{t.zona}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{int(t.completadas)}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums" style={{ color: colorMinutos(t.recol_med) }}>
                      {minutos(t.recol_med)}
                    </td>
                    <td
                      className={clsx(
                        "py-2 pr-4 text-right tabular-nums",
                        (t.vs_zona ?? 0) >= 5 ? "font-semibold text-danger" : (t.vs_zona ?? 0) <= -5 ? "text-success" : "text-ink-700"
                      )}
                    >
                      {t.vs_zona == null ? "—" : `${t.vs_zona >= 0 ? "+" : ""}${t.vs_zona.toFixed(1)}`}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">
                      {t.n_espera >= 5 ? minutos(t.espera_prom) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{minutos(t.entrega_prom)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{minutos(t.total_prom)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-700">{pctTxt(t.pct_45, 0)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{pctTxt(t.pct_dev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <VerMas total={ranking.length} mostrando={todas ? ranking.length : Math.min(20, ranking.length)} onClick={() => setTodas(!todas)} inicial={20} />
        </Seccion>

        <Seccion
          titulo="Tráfico por zona y hora"
          descripcion="Velocidad aproximada de los repartidores (distancia entre tiempo de manejo). Más lento = más tráfico."
          resumen={
            horasLentas.length > 0 ? (
              <span>Horas más lentas: {horasLentas.map((h) => hora12(h.hora)).join(", ")}</span>
            ) : null
          }
        >
          {zonasTrafico.length === 0 ? (
            <p className="text-xs text-ink-500">No hay datos suficientes para este filtro.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-white py-1 pr-3 text-left font-medium text-ink-500">Zona</th>
                      {horas.map((h) => (
                        <th key={h} className="px-0.5 py-1 text-center font-medium text-ink-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zonasTrafico.map((z) => (
                      <tr key={z}>
                        <td className="sticky left-0 max-w-[220px] truncate bg-white py-0.5 pr-3 text-ink-900">{z}</td>
                        {horas.map((h) => {
                          const c = celda(z, h);
                          return (
                            <td key={h} className="px-0.5 py-0.5">
                              <div
                                className="flex h-7 w-9 items-center justify-center rounded text-[10px] font-medium text-ink-900"
                                style={{ background: colorVelocidad(c?.kmh) }}
                                title={c ? `${z}, ${hora12(h)}: ${c.kmh.toFixed(1)} km/h (${c.ordenes} órdenes)` : "Sin datos suficientes"}
                              >
                                {c ? Math.round(c.kmh) : ""}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                <span>km/h:</span>
                {[
                  [8, "menos de 9 (mucho tráfico)"],
                  [10, "9–11"],
                  [12, "11–13"],
                  [14, "13–16"],
                  [17, "16 o más (fluido)"],
                ].map(([v, l]) => (
                  <span key={l as string} className="flex items-center gap-1.5">
                    <span className="h-3 w-4 rounded-sm" style={{ background: colorVelocidad(v as number) }} />
                    {l}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Columnas = hora del día (0 a 23 h). Zonas con al menos 150 órdenes; celdas con al menos 10. La velocidad es
                aproximada: se calcula con la distancia en línea entre cliente y tienda, así que sirve para comparar
                zonas y horas entre sí, no como velocidad real.
              </p>
            </>
          )}
        </Seccion>

        <Seccion
          titulo="Zonas rojas"
          descripcion="Zonas, ciudades o tiendas conflictivas que marcas tú."
          resumen={<span>{zonasRojas.length} marcadas</span>}
        >
          <ZonasRojas zonas={zonasRojas} opciones={opciones} onCambio={() => setRecargar((n) => n + 1)} />
        </Seccion>

        <Seccion
          titulo="Relación con devoluciones"
          descripcion="Qué tanto sube la devolución cuando el repartidor tarda más en salir con la orden."
          resumen={
            data?.relacion_devoluciones?.length ? (
              <span>
                Más de 45 min:{" "}
                {pctTxt(
                  (() => {
                    const r = data.relacion_devoluciones.filter((x) => x.orden >= 5);
                    const n = r.reduce((s, x) => s + x.ordenes, 0);
                    return n ? r.reduce((s, x) => s + x.devueltas, 0) / n : null;
                  })()
                )}{" "}
                de devolución
              </span>
            ) : null
          }
        >
          <div className="space-y-3">
            {(data?.relacion_devoluciones ?? []).map((r) => (
              <div key={r.rango}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-ink-900">{r.rango} hasta que sale el repartidor</span>
                  <span className="tabular-nums text-ink-700">
                    <span className="font-semibold text-ink-900">{pctTxt(r.pct_dev)}</span> devueltas · {int(r.ordenes)} órdenes
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-ink-100">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.max(1, ((r.pct_dev ?? 0) / maxRel) * 100)}%`, background: colorMinutos(r.orden * 9) }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Incluye órdenes completadas y devueltas. Entre más tarda la orden en salir de la tienda, más probable es que el
            cliente ya no la reciba.
          </p>
        </Seccion>
      </div>
    </div>
  );
}

function TablaSimple({
  filas,
  valor,
  n,
  esZonaRoja,
}: {
  filas: TiemposTienda[];
  valor: (t: TiemposTienda) => number | null;
  n: (t: TiemposTienda) => number;
  esZonaRoja: (t: TiemposTienda) => boolean;
}) {
  if (filas.length === 0) return <p className="mt-2 text-xs text-ink-500">Sin tiendas con datos suficientes en este filtro.</p>;
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {filas.map((t, i) => (
          <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
            <td className="py-1.5 pr-3 text-ink-900">
              <span className="mr-1.5 text-xs text-ink-300">{i + 1}</span>
              {t.tienda}
              {esZonaRoja(t) && <span className="ml-1 text-[10px] font-semibold text-danger">ZR</span>}
            </td>
            <td className="py-1.5 pr-3 text-right text-xs text-ink-500">{int(n(t))} órdenes</td>
            <td className="py-1.5 text-right font-semibold tabular-nums text-ink-900">{minutos(valor(t))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
