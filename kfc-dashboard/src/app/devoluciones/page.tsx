"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { getWeekRange } from "@/lib/week";
import Panorama from "@/components/devoluciones/Panorama";
import {
  META_DICIEMBRE,
  DevGrupo,
  DevReporte,
  ClimaDia,
  DevSemanaTendencia,
  Incidencia,
  climaPorDia,
  detalleClima,
  nombreCiudad,
  TIPOS_INCIDENCIA,
  TipoDuplicado,
  alcanceIncidencia,
  fechasIncidencia,
  esAlerta,
  mapsUrl,
  nombreMes,
  notaDuplicado,
  puntosResumen,
  titularResumen,
} from "@/lib/devoluciones";

const pct = (x: number | null | undefined, d = 2) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
const div = (a: number, b: number) => (b ? a / b : 0);

const TABS = [
  { id: "persiste", label: "Persiste" },
  { id: "duplicados", label: "Duplicados" },
  { id: "casos", label: "Casos detallados" },
  { id: "espera", label: "Tiempo de espera" },
  { id: "calidad", label: "Calidad de dirección" },
  { id: "ranking", label: "Ranking nacional" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const FILAS_INICIALES = 20;

function semanaPasada() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Piezas chicas reutilizables
// ---------------------------------------------------------------------
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-ink-100 bg-white p-5 shadow-card", className)}>
      {children}
    </div>
  );
}

function Comentario({
  valorInicial,
  onGuardar,
}: {
  valorInicial: string | null;
  onGuardar: (texto: string) => Promise<void>;
}) {
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | "error">("idle");
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        defaultValue={valorInicial ?? ""}
        placeholder="Agregar comentario"
        onBlur={async (e) => {
          if (e.target.value === (valorInicial ?? "")) return;
          setEstado("guardando");
          try {
            await onGuardar(e.target.value);
            setEstado("ok");
          } catch {
            setEstado("error");
          }
        }}
        className="w-full min-w-[160px] rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <span className="w-3 text-xs" aria-live="polite">
        {estado === "ok" && <span className="text-success">✓</span>}
        {estado === "error" && <span className="text-danger" title="No se guardó, intenta de nuevo">!</span>}
      </span>
    </div>
  );
}

function MapsLink({ lat, lon }: { lat: number | null; lon: number | null }) {
  const url = mapsUrl(lat, lon);
  if (!url) return <span className="text-ink-300">—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap text-xs font-medium text-brand-600 hover:underline"
    >
      Ver mapa
    </a>
  );
}

function VerMas({ total, mostrando, onClick }: { total: number; mostrando: number; onClick: () => void }) {
  if (total <= FILAS_INICIALES) return null;
  return (
    <button
      onClick={onClick}
      className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
    >
      {mostrando < total ? `Ver las ${total} filas` : `Mostrar solo las primeras ${FILAS_INICIALES}`}
    </button>
  );
}

const th = "py-2 pr-4 text-xs font-medium text-ink-500";
const td = "py-2 pr-4 text-ink-700";

// ---------------------------------------------------------------------
// Tabla de duplicados (GPS / teléfono / dirección) con detalle desplegable
// ---------------------------------------------------------------------
function TablaDuplicados({
  tipo,
  grupos,
  onComentario,
}: {
  tipo: TipoDuplicado;
  grupos: DevGrupo[];
  onComentario: (seccion: TipoDuplicado, clave: string, texto: string) => Promise<void>;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [todas, setTodas] = useState(false);
  const visibles = todas ? grupos : grupos.slice(0, FILAS_INICIALES);
  const toggle = (k: string) =>
    setAbiertos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  if (grupos.length === 0) {
    return <p className="text-xs text-ink-500">No hay casos con 3+ órdenes y 50%+ de devolución esta semana.</p>;
  }
  const tituloClave = tipo === "gps" ? "Punto GPS" : tipo === "telefono" ? "Teléfono" : "Dirección escrita";

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left">
              <th className={th}>{tituloClave}</th>
              <th className={th}>Tienda</th>
              <th className={clsx(th, "text-right")}>Órdenes</th>
              <th className={clsx(th, "text-right")}>% Dev.</th>
              <th className={clsx(th, "text-right")}>Monto dev.</th>
              <th className={th}>Nota</th>
              <th className={th}>Comentario</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((g) => {
              const abierto = abiertos.has(g.clave);
              const alerta = esAlerta(tipo, g);
              const clave =
                tipo === "gps" && g.latitud != null && g.longitud != null
                  ? `${g.latitud.toFixed(4)}, ${g.longitud.toFixed(4)}`
                  : g.clave;
              return (
                <Fragment key={g.clave}>
                  <tr
                    onClick={() => toggle(g.clave)}
                    className={clsx(
                      "cursor-pointer border-b border-ink-100 align-top hover:bg-ink-50",
                      abierto && "bg-ink-50"
                    )}
                  >
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        aria-expanded={abierto}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(g.clave);
                        }}
                        className="flex items-start gap-2 text-left font-medium text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <span
                          aria-hidden
                          className={clsx(
                            "mt-0.5 inline-block text-[10px] text-ink-500 transition-transform motion-reduce:transition-none",
                            abierto && "rotate-90"
                          )}
                        >
                          ▶
                        </span>
                        <span className={tipo === "direccion" ? "max-w-[260px]" : "whitespace-nowrap"}>{clave}</span>
                      </button>
                    </td>
                    <td className={clsx(td, "max-w-[200px]")}>{g.tiendas}</td>
                    <td className={clsx(td, "text-right tabular-nums")}>
                      {g.devueltas}/{g.ordenes}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">{pct(g.pct_dev, 0)}</td>
                    <td className={clsx(td, "text-right tabular-nums")}>{money(g.monto_efectivo + g.monto_tarjeta)}</td>
                    <td
                      className={clsx(
                        "max-w-[320px] py-2 pr-4 text-xs",
                        alerta ? "font-semibold text-danger" : "text-ink-700"
                      )}
                    >
                      {notaDuplicado(tipo, g)}
                    </td>
                    <td className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                      <Comentario valorInicial={g.nota} onGuardar={(t) => onComentario(tipo, g.clave, t)} />
                    </td>
                    <td className="py-2 pr-2">
                      <MapsLink lat={g.latitud} lon={g.longitud} />
                    </td>
                  </tr>
                  {abierto && (
                    <tr className="border-b border-ink-100 bg-ink-50/60">
                      <td colSpan={8} className="px-6 py-3">
                        <dl className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                          {tipo !== "telefono" && (
                            <div>
                              <dt className="font-medium text-ink-500">Teléfonos</dt>
                              <dd className="mt-0.5 break-words text-ink-900">{g.telefonos ?? "—"}</dd>
                            </div>
                          )}
                          {tipo !== "direccion" && (
                            <div>
                              <dt className="font-medium text-ink-500">Direcciones</dt>
                              <dd className="mt-0.5 break-words text-ink-900">{g.direcciones ?? "—"}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="font-medium text-ink-500">Fecha e ID de cada orden</dt>
                            <dd className="mt-0.5 break-words text-ink-900">{g.fechas_ids}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-ink-500">Devueltas por método de pago</dt>
                            <dd className="mt-0.5 text-ink-900">
                              {g.dev_efectivo} en efectivo ({money(g.monto_efectivo)}) · {g.dev_tarjeta} con
                              tarjeta ({money(g.monto_tarjeta)})
                            </dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <VerMas total={grupos.length} mostrando={visibles.length} onClick={() => setTodas(!todas)} />
    </>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
export default function DevolucionesPage() {
  const [anchorDate, setAnchorDate] = useState(semanaPasada);
  const [reporte, setReporte] = useState<DevReporte | null>(null);
  const [tendencia, setTendencia] = useState<DevSemanaTendencia[]>([]);
  const [incidenciasSemana, setIncidenciasSemana] = useState<Incidencia[]>([]);
  const [climaSemana, setClimaSemana] = useState<ClimaDia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [tab, setTab] = useState<TabId>("persiste");
  const [subDup, setSubDup] = useState<TipoDuplicado>("gps");
  const [todas, setTodas] = useState<Record<string, boolean>>({});

  const week = useMemo(() => (anchorDate ? getWeekRange(anchorDate) : null), [anchorDate]);
  // El reporte semanal usa siempre el mismo criterio que tu reporte para KFC
  // (data de tiempos): devueltas = RETURNED; canceladas = CANCELLED + REJECTED.
  const query = week ? `week_start=${week.start}&week_end=${week.end}` : "";

  useEffect(() => {
    if (!week) return;
    let vigente = true; // si cambian de semana a medio camino, se ignora la respuesta vieja
    setLoading(true);
    setError(null);
    setTendencia([]);
    setClimaSemana([]);
    // 1) Lo indispensable: el reporte aparece en cuanto está listo.
    fetch(`/api/devoluciones/reporte?${query}&parte=base`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        if (!vigente) return;
        setReporte(res.reporte);
        setIncidenciasSemana(res.incidencias ?? []);
        setLoading(false);
        // 2) Tendencia y clima llegan después; si fallan, el reporte sigue ahí.
        return fetch(`/api/devoluciones/reporte?${query}&parte=extra`, { cache: "no-store" })
          .then((r) => r.json())
          .then((ex) => {
            if (!vigente || ex?.error) return;
            setTendencia(ex.tendencia ?? []);
            setClimaSemana(ex.clima ?? []);
          })
          .catch(() => {});
      })
      .catch((e) => {
        if (!vigente) return;
        setError(e.message ?? "No se pudo cargar el análisis.");
        setLoading(false);
      });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function descargarExcel() {
    setDescargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/devoluciones/excel?${query}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo generar el Excel.");
      }
      const blob = await res.blob();
      const nombre =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "Reporte_KFC.xlsx";
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

  async function guardarComentario(seccion: string, clave: string, nota: string) {
    if (!week) return;
    const res = await fetch("/api/devoluciones/notas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: week.start, seccion, clave, nota }),
    });
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error ?? "No se guardó");
  }

  const r = reporte?.resumen;
  const hayData = !!r && r.total > 0;
  const titular = reporte && hayData ? titularResumen(reporte, tendencia) : null;
  const mes = reporte ? nombreMes(reporte.linea_base.inicio) : "";
  const verTodas = (k: string) => setTodas((p) => ({ ...p, [k]: !p[k] }));
  const recortar = <T,>(k: string, filas: T[]) => (todas[k] ? filas : filas.slice(0, FILAS_INICIALES));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Devoluciones y cancelaciones</h1>
      <p className="mt-1 text-sm text-ink-500">
        Panorama general de devueltas y canceladas, y abajo el reporte semanal que compartes con
        KFC. Meta de diciembre: 2%.
      </p>

      <Panorama />

      {/* Reporte semanal */}
      <div className="mt-12 border-t border-ink-100 pt-8">
        <h2 className="text-lg font-semibold text-ink-900">Reporte semanal para KFC</h2>
        <p className="mt-1 text-sm text-ink-500">
          Se calcula solo con la data de tiempos (la que trae teléfonos, coordenadas y direcciones):
          duplicados, casos, calidad de dirección y ranking de una semana, con el Excel listo para
          compartir.
        </p>
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="text-xs font-medium text-ink-500" htmlFor="semana">
              Elige cualquier día de la semana a revisar
            </label>
            <input
              id="semana"
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              className="mt-1 block rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {week && <p className="mt-2 text-sm text-ink-700">{week.fullLabel}</p>}
          </div>
          <button
            onClick={descargarExcel}
            disabled={!hayData || descargando || loading}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {descargando ? "Generando Excel…" : "Descargar reporte Excel"}
          </button>
        </div>
      </Card>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-ink-500">Calculando la semana…</p>}

      {!loading && reporte && !hayData && (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            No hay data de tiempos para esta semana. Súbela en <a href="/upload" className="font-medium text-brand-600 hover:underline">Cargar datos</a>{" "}
            (tarjeta &quot;Data de Tiempos&quot;) y vuelve aquí.
          </p>
        </Card>
      )}

      {!loading && reporte && r && hayData && (
        <>
          {/* Resumen + tendencia */}
          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-5">
              <h2 className="text-sm font-semibold text-ink-900">Resumen de la semana</h2>
              {titular && (
                <p
                  className={clsx(
                    "mt-3 text-sm font-semibold",
                    titular.tono === "mejora" ? "text-success" : titular.tono === "alerta" ? "text-danger" : "text-ink-900"
                  )}
                >
                  {titular.texto}
                </p>
              )}
              <ul className="mt-3 space-y-2 text-sm text-ink-700">
                {puntosResumen(reporte).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {(incidenciasSemana.length > 0 || climaPorDia(climaSemana).length > 0) && (
                <div className="mt-4 rounded-lg bg-warning-bg p-3">
                  <p className="text-xs font-semibold text-ink-900">Contexto de la semana</p>
                  <ul className="mt-1.5 space-y-1.5 text-xs text-ink-700">
                    {incidenciasSemana.map((x) => (
                      <li key={x.id}>
                        {TIPOS_INCIDENCIA[x.tipo]?.icono}{" "}
                        <span className="font-medium">
                          {TIPOS_INCIDENCIA[x.tipo]?.label} · {fechasIncidencia(x)} · {alcanceIncidencia(x)}:
                        </span>{" "}
                        {x.descripcion}
                      </li>
                    ))}
                    {climaPorDia(climaSemana).map((g) => (
                      <li key={g.fecha}>
                        🌧️{" "}
                        <span className="font-medium">
                          Mal clima (automático) ·{" "}
                          {new Date(g.fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}:
                        </span>{" "}
                        {g.ciudades
                          .map((c) => `${nombreCiudad(c.ciudad)} (${detalleClima(c)}${c.nota ? `; nota: ${c.nota}` : ""})`)
                          .join("; ")}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-ink-500">También sale en la hoja Resumen del Excel.</p>
                </div>
              )}
            </Card>
          </div>

          {/* Pestañas de análisis */}
          <Card className="mt-6">
            <div className="-mx-5 -mt-5 mb-4 flex gap-1 overflow-x-auto border-b border-ink-100 px-5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={clsx(
                    "-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "border-brand-500 text-brand-700"
                      : "border-transparent text-ink-500 hover:text-ink-900"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "persiste" && (
              <div className="space-y-8">
                {reporte.meses_con_data === 0 ? (
                  <p className="text-sm text-ink-700">
                    Para comparar contra lo marcado en {mes} necesitas cargar la data de tiempos de todo{" "}
                    {mes}. En cuanto la subas, aquí aparecen las tiendas, puntos GPS, teléfonos y
                    direcciones que siguen repitiéndose.
                  </p>
                ) : (
                  <>
                    <section>
                      <h3 className="text-sm font-semibold text-ink-900">
                        Top 20 tiendas con problemas de dirección en {mes}, cómo están esta semana
                      </h3>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-ink-100 text-left">
                              <th className={th}>Tienda</th>
                              <th className={clsx(th, "text-right")}>% en {mes}</th>
                              <th className={clsx(th, "text-right")}>% esta semana</th>
                              <th className={clsx(th, "text-right")}>Órdenes semana</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reporte.persiste.tiendas.map((t) => (
                              <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
                                <td className="py-2 pr-4 text-ink-900">{t.tienda}</td>
                                <td className={clsx(td, "text-right tabular-nums")}>{pct(t.pct_mes, 1)}</td>
                                <td
                                  className={clsx(
                                    "py-2 pr-4 text-right font-medium tabular-nums",
                                    t.pct_semana == null
                                      ? "text-ink-300"
                                      : t.pct_semana < t.pct_mes
                                        ? "text-success"
                                        : "text-danger"
                                  )}
                                >
                                  {pct(t.pct_semana, 1)}
                                </td>
                                <td className={clsx(td, "text-right tabular-nums")}>{int(t.ordenes_semana)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {(
                      [
                        ["gps", "Puntos GPS", reporte.persiste.gps, reporte.persiste.total_gps],
                        ["telefonos", "Teléfonos", reporte.persiste.telefonos, reporte.persiste.total_telefonos],
                        ["direcciones", "Direcciones", reporte.persiste.direcciones, reporte.persiste.total_direcciones],
                      ] as const
                    ).map(([k, titulo, filas, total]) => (
                      <section key={k}>
                        <h3 className="text-sm font-semibold text-ink-900">
                          {titulo} de {mes} que volvieron a aparecer
                        </h3>
                        <p className="mt-1 text-xs text-ink-500">
                          {filas.length} de {total} marcados en {mes} tuvieron órdenes esta semana.
                        </p>
                        {filas.length > 0 && (
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-ink-100 text-left">
                                  <th className={th}>{titulo.slice(0, -1)}</th>
                                  <th className={th}>Tienda</th>
                                  <th className={clsx(th, "text-right")}>% dev. {mes}</th>
                                  <th className={clsx(th, "text-right")}>Órdenes semana</th>
                                  <th className={clsx(th, "text-right")}>% dev. semana</th>
                                  <th className={clsx(th, "text-right")}>Monto dev.</th>
                                  <th className={th}>Fecha e ID</th>
                                  <th className={th}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {recortar(`p-${k}`, [...filas]).map((g) => (
                                  <tr key={g.clave} className="border-b border-ink-100 align-top last:border-0">
                                    <td className="max-w-[240px] py-2 pr-4 text-ink-900">
                                      {k === "gps" && g.latitud != null && g.longitud != null
                                        ? `${g.latitud.toFixed(4)}, ${g.longitud.toFixed(4)}`
                                        : g.clave}
                                    </td>
                                    <td className={clsx(td, "max-w-[180px]")}>{g.tiendas}</td>
                                    <td className={clsx(td, "text-right tabular-nums")}>{pct(g.pct_mes, 0)}</td>
                                    <td className={clsx(td, "text-right tabular-nums")}>{g.ordenes_semana}</td>
                                    <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">
                                      {pct(g.pct_semana, 0)}
                                    </td>
                                    <td className={clsx(td, "text-right tabular-nums")}>{money(g.monto_devuelto)}</td>
                                    <td className="max-w-[260px] py-2 pr-4 text-xs text-ink-700">{g.fechas_ids}</td>
                                    <td className="py-2 pr-2">
                                      <MapsLink lat={g.latitud} lon={g.longitud} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <VerMas
                              total={filas.length}
                              mostrando={recortar(`p-${k}`, [...filas]).length}
                              onClick={() => verTodas(`p-${k}`)}
                            />
                          </div>
                        )}
                      </section>
                    ))}
                  </>
                )}
              </div>
            )}

            {tab === "duplicados" && (
              <div>
                <p className="text-xs text-ink-500">
                  Casos nuevos de esta semana con 3+ órdenes y 50%+ de devolución. Haz clic en una
                  fila para ver teléfonos, direcciones y el ID de cada orden.
                </p>
                <div className="mt-3 inline-flex rounded-lg border border-ink-200 p-0.5">
                  {(
                    [
                      ["gps", `GPS (${reporte.duplicados_gps.length})`],
                      ["telefono", `Teléfono (${reporte.duplicados_telefono.length})`],
                      ["direccion", `Dirección (${reporte.duplicados_direccion.length})`],
                    ] as [TipoDuplicado, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setSubDup(id)}
                      className={clsx(
                        "rounded-md px-3 py-1.5 text-xs font-medium",
                        subDup === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <TablaDuplicados
                    key={`${subDup}-${reporte.semana.inicio}-${query}`}
                    tipo={subDup}
                    grupos={
                      subDup === "gps"
                        ? reporte.duplicados_gps
                        : subDup === "telefono"
                          ? reporte.duplicados_telefono
                          : reporte.duplicados_direccion
                    }
                    onComentario={guardarComentario}
                  />
                </div>
              </div>
            )}

            {tab === "casos" && (
              <div>
                <p className="text-xs text-ink-500">
                  Devoluciones con dato de espera en tienda, de mayor a menor espera.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 text-left">
                        <th className={th}>Fecha</th>
                        <th className={th}>Tienda</th>
                        <th className={th}>Teléfono</th>
                        <th className={th}>Dirección</th>
                        <th className={clsx(th, "text-right")}>Espera</th>
                        <th className={th}>ID</th>
                        <th className={th}>Comentario</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recortar("casos", reporte.casos).map((c) => (
                        <tr key={c.order_id} className="border-b border-ink-100 align-top last:border-0">
                          <td className="whitespace-nowrap py-2 pr-4 text-xs text-ink-700">{c.fecha.slice(0, 16)}</td>
                          <td className={clsx(td, "max-w-[180px]")}>{c.tienda}</td>
                          <td className={clsx(td, "whitespace-nowrap text-xs")}>{c.telefono}</td>
                          <td className="max-w-[280px] py-2 pr-4 text-xs text-ink-700">
                            {c.direccion}
                            {c.problema_direccion && (
                              <span className="ml-1.5 rounded bg-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                problema de dirección
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">
                            {c.espera.toFixed(1)} min
                          </td>
                          <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-ink-700">{c.id_corto}</td>
                          <td className="py-2 pr-4">
                            <Comentario
                              valorInicial={c.nota}
                              onGuardar={(t) => guardarComentario("caso", c.order_id, t)}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <MapsLink lat={c.latitud} lon={c.longitud} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <VerMas
                  total={reporte.casos.length}
                  mostrando={recortar("casos", reporte.casos).length}
                  onClick={() => verTodas("casos")}
                />
              </div>
            )}

            {tab === "espera" && (
              <div className="space-y-8">
                <section>
                  <h3 className="text-sm font-semibold text-ink-900">
                    Devolución según la espera del repartidor en tienda
                  </h3>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full max-w-xl text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-left">
                          <th className={th}>Espera</th>
                          <th className={clsx(th, "text-right")}>Órdenes con dato</th>
                          <th className={clsx(th, "text-right")}>Devueltas</th>
                          <th className={clsx(th, "text-right")}>% Devolución</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reporte.espera_rangos.map((x) => (
                          <tr key={x.etiqueta} className="border-b border-ink-100 last:border-0">
                            <td className="py-2 pr-4 text-ink-900">{x.etiqueta}</td>
                            <td className={clsx(td, "text-right tabular-nums")}>{int(x.ordenes)}</td>
                            <td className={clsx(td, "text-right tabular-nums")}>{int(x.devueltas)}</td>
                            <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">
                              {pct(div(x.devueltas, x.ordenes))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-semibold text-ink-900">Tiendas donde más espera el repartidor</h3>
                  <p className="mt-1 text-xs text-ink-500">Mínimo 10 órdenes con dato.</p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-left">
                          <th className={th}>Tienda</th>
                          <th className={clsx(th, "text-right")}>Órdenes</th>
                          <th className={clsx(th, "text-right")}>Con dato</th>
                          <th className={clsx(th, "text-right")}>% Devueltas</th>
                          <th className={clsx(th, "text-right")}>Espera promedio</th>
                          <th className={clsx(th, "text-right")}>% con espera &gt;15 min</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recortar("espera", reporte.espera_tiendas).map((x) => (
                          <tr key={x.tienda} className="border-b border-ink-100 last:border-0">
                            <td className="py-2 pr-4 text-ink-900">{x.tienda}</td>
                            <td className={clsx(td, "text-right tabular-nums")}>{int(x.ordenes)}</td>
                            <td className={clsx(td, "text-right tabular-nums")}>{int(x.con_dato)}</td>
                            <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.devueltas, x.ordenes))}</td>
                            <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">
                              {x.espera_prom.toFixed(1)} min
                            </td>
                            <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.mas_15, x.con_dato), 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <VerMas
                    total={reporte.espera_tiendas.length}
                    mostrando={recortar("espera", reporte.espera_tiendas).length}
                    onClick={() => verTodas("espera")}
                  />
                </section>
              </div>
            )}

            {tab === "calidad" && (
              <div>
                <p className="text-xs text-ink-500">
                  Tiendas con 50+ órdenes, ordenadas por % de direcciones con algún problema (CP
                  faltante o incompleto, calle sin número o colonia vacía).
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 text-left">
                        <th className={th}>Tienda</th>
                        <th className={clsx(th, "text-right")}>Órdenes</th>
                        <th className={clsx(th, "text-right")}>% Devueltas</th>
                        <th className={clsx(th, "text-right")}>% CP faltante</th>
                        <th className={clsx(th, "text-right")}>% Calle sin número</th>
                        <th className={clsx(th, "text-right")}>% Colonia vacía</th>
                        <th className={clsx(th, "text-right")}>% Con algún problema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recortar("calidad", reporte.calidad_tiendas).map((x) => (
                        <tr key={x.tienda} className="border-b border-ink-100 last:border-0">
                          <td className="py-2 pr-4 text-ink-900">{x.tienda}</td>
                          <td className={clsx(td, "text-right tabular-nums")}>{int(x.ordenes)}</td>
                          <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.devueltas, x.ordenes), 1)}</td>
                          <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.cp_faltante, x.ordenes), 1)}</td>
                          <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.calle_sin_numero, x.ordenes), 1)}</td>
                          <td className={clsx(td, "text-right tabular-nums")}>{pct(div(x.colonia_vacia, x.ordenes), 1)}</td>
                          <td className="py-2 pr-4 text-right font-semibold tabular-nums text-ink-900">
                            {pct(div(x.problema, x.ordenes), 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <VerMas
                  total={reporte.calidad_tiendas.length}
                  mostrando={recortar("calidad", reporte.calidad_tiendas).length}
                  onClick={() => verTodas("calidad")}
                />
              </div>
            )}

            {tab === "ranking" && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {(
                  [
                    ["Top 20 peores tiendas", reporte.ranking_peores, "text-danger"],
                    ["Top 20 mejores tiendas", reporte.ranking_mejores, "text-success"],
                  ] as const
                ).map(([titulo, filas, color]) => (
                  <section key={titulo}>
                    <h3 className="text-sm font-semibold text-ink-900">{titulo}</h3>
                    <p className="mt-1 text-xs text-ink-500">
                      % problema = devoluciones + cancelaciones. Mínimo 50 órdenes, sin tiendas MF.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ink-100 text-left">
                            <th className={th}>Tienda</th>
                            <th className={clsx(th, "text-right")}>Órdenes</th>
                            <th className={clsx(th, "text-right")}>Dev.</th>
                            <th className={clsx(th, "text-right")}>Canc.</th>
                            <th className={clsx(th, "text-right")}>% Problema</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((x) => (
                            <tr key={x.tienda} className="border-b border-ink-100 last:border-0">
                              <td className="py-2 pr-4 text-ink-900">{x.tienda}</td>
                              <td className={clsx(td, "text-right tabular-nums")}>{int(x.ordenes)}</td>
                              <td className={clsx(td, "text-right tabular-nums")}>{int(x.devueltas)}</td>
                              <td className={clsx(td, "text-right tabular-nums")}>{int(x.canceladas)}</td>
                              <td className={clsx("py-2 pr-4 text-right font-semibold tabular-nums", color)}>
                                {pct(x.pct_problema, 1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
