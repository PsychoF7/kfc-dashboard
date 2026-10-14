"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import { useEsConsulta } from "@/components/Sesion";

// ---------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------
interface Opciones {
  fecha_min: string | null;
  fecha_max: string | null;
  proveedores: string[];
  motivos: string[];
  estatus: string[];
  tiendas: { clave: string; nombre: string }[];
}

interface Conteo {
  nombre: string;
  n: number;
  monto: number;
}

interface TiendaR {
  clave: string;
  nombre: string;
  n: number;
  monto: number;
  ultimo: string | null;
  primero: string | null;
  historico: number;
  dias_sin: number | null;
}

interface Panorama {
  sin_datos?: boolean;
  referencia: string;
  periodo: { desde: string; hasta: string };
  total_tiendas: number;
  kpis: {
    reembolsos: number;
    monto: number;
    promedio: number | null;
    tiendas: number;
    pagados: number;
    monto_pagado: number;
    pendientes: number;
    monto_pendiente: number;
    rebotados: number;
  };
  serie: { granularidad: "dia" | "mes"; puntos: { f: string; n: number; monto: number }[] };
  por_proveedor: Conteo[];
  por_motivo: Conteo[];
  por_estatus: Conteo[];
  tiendas: TiendaR[];
}

interface FilaDetalle {
  clave: string;
  fecha_venta: string | null;
  restaurante: string;
  proveedor: string | null;
  monto: number | null;
  folio: string | null;
  estatus: string;
  fecha_pago: string | null;
  id_orden: string | null;
  cant_ordenes: number | null;
  motivo: string | null;
  dictamen: string | null;
}

interface Detalle {
  busqueda: boolean;
  total: number;
  monto: number;
  limite: number;
  filas: FilaDetalle[];
}

const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const pct = (x: number, total: number) => (total > 0 ? `${((x / total) * 100).toFixed(1)}%` : "—");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
};
const etiquetaSerie = (iso: string, gran: "dia" | "mes") => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return gran === "mes" ? `${MESES[m - 1]} ${String(y).slice(2)}` : `${d} ${MESES[m - 1]}`;
};

const COLORES_ESTATUS: Record<string, string> = {
  pagado: "bg-emerald-50 text-emerald-700",
  pendiente: "bg-amber-50 text-amber-700",
  rebotado: "bg-rose-50 text-rose-700",
};

// ---------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("rounded-xl border border-ink-100 bg-white p-5 shadow-card", className)}>{children}</div>;
}

function Esqueleto({ alto = "h-56" }: { alto?: string }) {
  return <div className={clsx(alto, "animate-pulse rounded-lg bg-ink-50")} />;
}

/** Lista de barras horizontales (proveedor, motivo, estatus). */
function Barras({ datos, color = "#891DFF" }: { datos: Conteo[]; color?: string }) {
  const total = datos.reduce((s, d) => s + d.n, 0);
  const max = Math.max(1, ...datos.map((d) => d.n));
  if (datos.length === 0) return <p className="text-sm text-ink-500">Sin reembolsos con estos filtros.</p>;
  return (
    <ul className="space-y-3">
      {datos.map((d) => (
        <li key={d.nombre}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-900" title={d.nombre}>
              {d.nombre}
            </span>
            <span className="flex-shrink-0 tabular-nums text-ink-700">
              <span className="font-semibold">{int(d.n)}</span>
              <span className="ml-2 text-xs text-ink-500">{pct(d.n, total)}</span>
              <span className="ml-2 text-xs text-ink-500">{money(d.monto)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-ink-50">
            <div className="h-2 rounded-full" style={{ width: `${(d.n / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Barras por día o por mes, con el detalle al pasar el mouse. */
function Serie({ serie, medida }: { serie: Panorama["serie"]; medida: "n" | "monto" }) {
  const [hover, setHover] = useState<number | null>(null);
  const datos = serie.puntos;
  if (datos.length === 0) return <p className="text-sm text-ink-500">Sin reembolsos con estos filtros.</p>;
  const W = 760;
  const H = 230;
  const pad = { l: 44, r: 12, t: 14, b: 30 };
  const maxY = Math.max(1, ...datos.map((d) => d[medida])) * 1.1;
  const ancho = (W - pad.l - pad.r) / datos.length;
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const cada = Math.max(1, Math.ceil(datos.length / 12));
  const sel = hover != null ? datos[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Reembolsos en el tiempo" onMouseLeave={() => setHover(null)}>
        {[0, maxY / 2, maxY].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stroke-ink-50" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" className="fill-ink-500">
              {medida === "monto" ? `$${Math.round(t / 1000)}k` : Math.round(t)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => (
          <g key={d.f} onMouseEnter={() => setHover(i)}>
            <rect x={pad.l + i * ancho} y={pad.t} width={ancho} height={H - pad.t - pad.b} className={hover === i ? "fill-ink-50" : "fill-transparent"} />
            <rect
              x={pad.l + i * ancho + ancho * 0.15}
              y={y(d[medida])}
              width={ancho * 0.7}
              height={H - pad.b - y(d[medida])}
              rx="2"
              fill="#891DFF"
              opacity={hover === i ? 1 : 0.8}
            />
            {i % cada === 0 && (
              <text x={pad.l + i * ancho + ancho / 2} y={H - 10} textAnchor="middle" fontSize="10" className="fill-ink-500">
                {etiquetaSerie(d.f, serie.granularidad)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {sel && hover != null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-ink-100 bg-white p-3 text-xs shadow-card"
          style={{ left: `${Math.min(Math.max(((pad.l + hover * ancho) / W) * 100, 8), 72)}%` }}
        >
          <p className="font-semibold text-ink-900">{serie.granularidad === "mes" ? etiquetaSerie(sel.f, "mes") : fechaCorta(sel.f)}</p>
          <p className="mt-1 text-ink-700">{int(sel.n)} reembolsos</p>
          <p className="text-ink-700">{money(sel.monto)}</p>
        </div>
      )}
    </div>
  );
}

function TablaTiendas({ filas, vacio }: { filas: TiendaR[]; vacio: string }) {
  if (filas.length === 0) return <p className="text-sm text-ink-500">{vacio}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
            <th className="py-2 pr-3 font-medium">Sucursal</th>
            <th className="py-2 pr-3 text-right font-medium">Reembolsos</th>
            <th className="py-2 text-right font-medium">Monto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((t) => (
            <tr key={t.clave} className="border-b border-ink-100 last:border-0">
              <td className="py-2 pr-3 text-ink-900">{t.nombre}</td>
              <td className="py-2 pr-3 text-right font-semibold tabular-nums">{int(t.n)}</td>
              <td className="py-2 text-right tabular-nums text-ink-700">{money(t.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function colorDias(d: number) {
  return d >= 60 ? "#D63A3A" : d >= 30 ? "#F07C1B" : "#E0B000";
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function ReembolsosPage() {
  const esConsulta = useEsConsulta();
  const [opciones, setOpciones] = useState<Opciones | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [estatus, setEstatus] = useState<string[]>([]);
  const [tiendasSel, setTiendasSel] = useState<string[]>([]);
  const [buscar, setBuscar] = useState("");
  const [buscarFinal, setBuscarFinal] = useState("");
  const [pagina, setPagina] = useState(0);

  const [data, setData] = useState<Panorama | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(true);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const [medida, setMedida] = useState<"n" | "monto">("n");
  const [umbral, setUmbral] = useState(30);
  const [verTodas, setVerTodas] = useState(false);

  // Nombre -> clave de sucursal (los filtros muestran nombres)
  const nombreAClave = useMemo(() => new Map((opciones?.tiendas ?? []).map((t) => [t.nombre, t.clave])), [opciones]);
  const nombresTiendas = useMemo(() => (opciones?.tiendas ?? []).map((t) => t.nombre), [opciones]);

  const filtrosQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    proveedores.forEach((v) => p.append("proveedor", v));
    motivos.forEach((v) => p.append("motivo", v));
    estatus.forEach((v) => p.append("estatus", v));
    tiendasSel.forEach((n) => {
      const c = nombreAClave.get(n);
      if (c) p.append("tienda", c);
    });
    return p.toString();
  }, [desde, hasta, proveedores, motivos, estatus, tiendasSel, nombreAClave]);

  const detalleQuery = useMemo(() => {
    const p = new URLSearchParams(filtrosQuery);
    if (buscarFinal) p.set("buscar", buscarFinal);
    return p.toString();
  }, [filtrosQuery, buscarFinal]);

  // Opciones de los filtros (una vez)
  useEffect(() => {
    fetch("/api/reembolsos/filtros", { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (!res?.error) setOpciones(res);
      })
      .catch(() => undefined);
  }, []);

  // Búsqueda: espera a que termine de escribir
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscarFinal(buscar.trim());
      setPagina(0);
    }, 400);
    return () => clearTimeout(t);
  }, [buscar]);

  // Volver a la primera página al cambiar filtros
  useEffect(() => {
    setPagina(0);
  }, [filtrosQuery]);

  // Panorama
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCargando(true);
      setError(null);
      fetch(`/api/reembolsos/panorama?${filtrosQuery}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setError(e.message ?? "No se pudieron cargar los reembolsos.");
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setCargando(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [filtrosQuery]);

  // Tabla de detalle
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setCargandoDetalle(true);
      setErrorDetalle(null);
      fetch(`/api/reembolsos/detalle?${detalleQuery}&pagina=${pagina}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setDetalle(res);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setErrorDetalle(e.message ?? "No se pudo cargar la tabla.");
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setCargandoDetalle(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [detalleQuery, pagina]);

  const k = data?.kpis;
  const tiendas = data?.tiendas ?? [];
  const masReportan = [...tiendas].filter((t) => t.n > 0).sort((a, b) => b.n - a.n || b.monto - a.monto).slice(0, 10);
  const menosReportan = [...tiendas].filter((t) => t.n > 0).sort((a, b) => a.n - b.n || a.monto - b.monto).slice(0, 10);
  const sinReportar = tiendas
    .filter((t) => t.dias_sin != null && t.dias_sin >= umbral)
    .sort((a, b) => (b.dias_sin ?? 0) - (a.dias_sin ?? 0));
  const sinReportarVisibles = verTodas ? sinReportar : sinReportar.slice(0, 15);
  const campo =
    "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const hayFiltros = !!(desde || hasta || proveedores.length || motivos.length || estatus.length || tiendasSel.length);
  const paginas = detalle ? Math.max(1, Math.ceil(detalle.total / detalle.limite)) : 1;

  function limpiar() {
    setDesde("");
    setHasta("");
    setProveedores([]);
    setMotivos([]);
    setEstatus([]);
    setTiendasSel([]);
  }

  if (data?.sin_datos) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-semibold text-ink-900">Reembolsos</h1>
        <Card className="mt-6">
          <p className="text-sm text-ink-700">Todavía no hay reembolsos cargados.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Reembolsos</h1>

      {/* Búsqueda */}
      <Card className="mt-6">
        <label htmlFor="buscar-reembolso" className="text-sm font-semibold text-ink-900">
          Buscar por folio
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="buscar-reembolso"
            type="search"
            inputMode="search"
            placeholder="Folio, ID de orden o sucursal"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className={clsx(campo, "w-full sm:w-96")}
          />
          {buscarFinal && (
            <button onClick={() => setBuscar("")} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Quitar búsqueda
            </button>
          )}
        </div>
      </Card>

      {/* Filtros */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Filtros</h2>
          {hayFiltros && (
            <button onClick={limpiar} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500" htmlFor="r-desde">
              Desde
            </label>
            <input id="r-desde" type="date" className={campo} value={desde} min={opciones?.fecha_min ?? undefined} max={opciones?.fecha_max ?? undefined} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-500" htmlFor="r-hasta">
              Hasta
            </label>
            <input id="r-hasta" type="date" className={campo} value={hasta} min={opciones?.fecha_min ?? undefined} max={opciones?.fecha_max ?? undefined} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <MultiSelectFilter label="Proveedor" items={opciones?.proveedores ?? []} selected={proveedores} onChange={setProveedores} />
          <MultiSelectFilter label="Motivo" items={opciones?.motivos ?? []} selected={motivos} onChange={setMotivos} />
          <MultiSelectFilter label="Estatus" items={opciones?.estatus ?? []} selected={estatus} onChange={setEstatus} />
          <MultiSelectFilter label="Sucursal" items={nombresTiendas} selected={tiendasSel} onChange={setTiendasSel} />
        </div>
      </Card>
      {data?.periodo && (
        <p className="mt-2 text-xs text-ink-500">
          Del {fechaCorta(data.periodo.desde)} al {fechaCorta(data.periodo.hasta)}
        </p>
      )}

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Resumen */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Reembolsos" value={cargando ? "…" : int(k?.reembolsos)} sublabel={k ? `${int(k.tiendas)} de ${int(data?.total_tiendas)} sucursales` : undefined} />
        <KpiCard label="Monto total" value={cargando ? "…" : money(k?.monto)} />
        <KpiCard label="Promedio por reembolso" value={cargando ? "…" : money(k?.promedio)} />
        <KpiCard label="Pagados" value={cargando ? "…" : int(k?.pagados)} sublabel={k ? money(k.monto_pagado) : undefined} accent="success" />
        <KpiCard label="Pendientes" value={cargando ? "…" : int(k?.pendientes)} sublabel={k ? money(k.monto_pendiente) : undefined} accent="warning" />
        <KpiCard label="Rebotados" value={cargando ? "…" : int(k?.rebotados)} accent={k && k.rebotados > 0 ? "danger" : "default"} />
      </div>

      {/* Tendencia */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-900">{data?.serie.granularidad === "mes" ? "Reembolsos por mes" : "Reembolsos por día"}</h2>
          <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
            {(
              [
                ["n", "Cantidad"],
                ["monto", "Monto"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setMedida(id)}
                className={clsx("rounded-md px-3 py-1.5 text-xs font-medium", medida === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">{data ? <Serie serie={data.serie} medida={medida} /> : <Esqueleto />}</div>
      </Card>

      {/* Proveedor y motivo */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Por proveedor</h2>
          <div className="mt-4">{data ? <Barras datos={data.por_proveedor} /> : <Esqueleto alto="h-40" />}</div>
          <h2 className="mt-8 text-sm font-semibold text-ink-900">Por estatus</h2>
          <div className="mt-4">{data ? <Barras datos={data.por_estatus} color="#5A6BE0" /> : <Esqueleto alto="h-24" />}</div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-ink-900">Motivos de reembolso</h2>
          <div className="mt-4">{data ? <Barras datos={data.por_motivo} color="#F07C1B" /> : <Esqueleto />}</div>
        </Card>
      </div>

      {/* Sucursales */}
      <h2 className="mt-12 text-lg font-semibold text-ink-900">Sucursales</h2>
      <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-ink-900">Las que más reportan</h3>
          <div className="mt-3">{data ? <TablaTiendas filas={masReportan} vacio="Sin reembolsos con estos filtros." /> : <Esqueleto alto="h-64" />}</div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-ink-900">Las que menos reportan</h3>
          <div className="mt-3">{data ? <TablaTiendas filas={menosReportan} vacio="Sin reembolsos con estos filtros." /> : <Esqueleto alto="h-64" />}</div>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-900">Sucursales que dejaron de reportar</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="umbral" className="text-xs font-medium text-ink-500">
              Sin reembolsos desde hace
            </label>
            <select
              id="umbral"
              value={umbral}
              onChange={(e) => {
                setUmbral(Number(e.target.value));
                setVerTodas(false);
              }}
              className={campo}
            >
              {[7, 15, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} días o más
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          {!data ? (
            <Esqueleto alto="h-40" />
          ) : sinReportar.length === 0 ? (
            <p className="text-sm text-ink-500">Ninguna sucursal con {umbral} días o más sin reembolsos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-3 font-medium">Sucursal</th>
                  <th className="py-2 pr-3 font-medium">Último reembolso</th>
                  <th className="py-2 pr-3 text-right font-medium">Días sin reportar</th>
                  <th className="py-2 text-right font-medium">Reembolsos en total</th>
                </tr>
              </thead>
              <tbody>
                {sinReportarVisibles.map((t) => (
                  <tr key={t.clave} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-3 text-ink-900">{t.nombre}</td>
                    <td className="py-2 pr-3 text-ink-700">{fechaCorta(t.ultimo)}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums" style={{ color: colorDias(t.dias_sin ?? 0) }}>
                      {int(t.dias_sin)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{int(t.historico)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {sinReportar.length > 15 && (
          <button onClick={() => setVerTodas(!verTodas)} className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700">
            {verTodas ? "Ver menos" : `Ver las ${sinReportar.length} sucursales`}
          </button>
        )}
      </Card>

      {/* Detalle */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">{detalle?.busqueda ? "Resultados de la búsqueda" : "Detalle de reembolsos"}</h2>
        {!esConsulta && (
          <a
            href={`/api/reembolsos/excel?${detalleQuery}`}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
          >
            Descargar Excel
          </a>
        )}
      </div>
      {detalle && (
        <p className="mt-1 text-sm text-ink-500">
          {int(detalle.total)} {detalle.total === 1 ? "reembolso" : "reembolsos"} · {money(detalle.monto)}
        </p>
      )}
      {errorDetalle && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorDetalle}</div>}

      <Card className="mt-4 p-0">
        <div className={clsx("overflow-x-auto", cargandoDetalle && "opacity-60")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Estatus</th>
                <th className="px-4 py-3 font-medium">Fecha de pago</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(detalle?.filas ?? []).map((f) => (
                <tr key={f.clave} className="border-b border-ink-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-700">{fechaCorta(f.fecha_venta)}</td>
                  <td className="px-4 py-2 text-ink-900">{f.restaurante}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-700">{f.proveedor ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums">{money(f.monto)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-ink-700">{f.folio ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", COLORES_ESTATUS[f.estatus.toLowerCase()] ?? "bg-ink-50 text-ink-700")}>{f.estatus}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-700">{fechaCorta(f.fecha_pago)}</td>
                  <td className="px-4 py-2 text-ink-700">{f.motivo ?? "—"}</td>
                </tr>
              ))}
              {detalle && detalle.filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-500">
                    {detalle.busqueda ? "No encontré ningún reembolso con esa búsqueda." : "Sin reembolsos con estos filtros."}
                  </td>
                </tr>
              )}
              {!detalle && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-ink-500">
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {detalle && detalle.total > detalle.limite && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
            <span>
              Página {pagina + 1} de {paginas}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="rounded-lg border border-ink-200 px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                disabled={pagina >= paginas - 1}
                className="rounded-lg border border-ink-200 px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
