"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import DetalleDiaBase, { DetalleDiaVacio, buscarPrevio, type FilaDia } from "@/components/DetalleDia";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import {
  ETAPAS_CANCELACION,
  MOTIVOS_CANCELACION,
  RappiMeta,
  RappiPanorama,
  RappiTurbo,
  TurboResumen,
  TurboTienda,
} from "@/lib/rappi";

const int = (n: number | null | undefined) => (n == null ? "—" : Math.round(n).toLocaleString("es-MX"));
const min = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${n.toFixed(d)} min`);
const pct = (x: number | null | undefined, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`);
const money = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`);
const fechaCorta = (iso: string) =>
  new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
};
const campo =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

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

// ---------------------------------------------------------------------
// Meta del mes
// ---------------------------------------------------------------------
function MetaMes() {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`);
  const [data, setData] = useState<RappiMeta | null>(null);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [recargar, setRecargar] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/rappi/meta?mes=${mes}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        setData(res);
        setValor(res?.meta ? String(res.meta) : "");
      })
      .catch((e) => setError(e.message));
  }, [mes, recargar]);

  async function guardar() {
    setError(null);
    const res = await fetch("/api/rappi/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes, meta: Number(valor.replace(/[^0-9]/g, "")) }),
    });
    const d = await res.json();
    if (!res.ok || d?.error) {
      setError(d?.error ?? "No se guardó.");
      return;
    }
    setEditando(false);
    setRecargar((n) => n + 1);
  }

  const [y, m] = mes.split("-").map(Number);
  const diasMes = new Date(y, m, 0).getDate();
  const diasConData = data?.ultimo_dia ? Number(data.ultimo_dia.slice(8, 10)) : 0;
  const entregadas = data?.entregadas ?? 0;
  const meta = data?.meta ?? null;
  const avance = meta ? entregadas / meta : null;
  const ritmo = diasConData ? entregadas / diasConData : 0;
  const proyeccion = Math.round(ritmo * diasMes);
  const faltan = meta ? Math.max(meta - entregadas, 0) : null;
  const diasRestantes = diasMes - diasConData;
  const necesario = faltan != null && diasRestantes > 0 ? faltan / diasRestantes : null;
  const esperadoHoy = meta && diasConData ? (meta / diasMes) * diasConData : null;
  const vaBien = esperadoHoy != null ? entregadas >= esperadoHoy : null;
  const maxDia = Math.max(1, ...(data?.por_dia ?? []).map((d) => d.entregadas), meta ? meta / diasMes : 0);

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Meta del mes</h2>
          <p className="mt-0.5 text-xs text-ink-500">Órdenes que Rappi entregó (estatus &quot;finished&quot; en el reporte de Rappi).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className={campo} />
          {editando ? (
            <>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ej. 10000"
                className={clsx(campo, "w-32")}
                autoFocus
              />
              <button onClick={guardar} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600">
                Guardar
              </button>
              <button onClick={() => setEditando(false)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700">
                Cancelar
              </button>
            </>
          ) : (
            <button onClick={() => setEditando(true)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50">
              {meta ? "Cambiar meta" : "Poner meta"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <p className="text-xs text-ink-500">{nombreMes(`${mes}-01`)}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
            {int(entregadas)}
            <span className="text-base font-normal text-ink-500"> / {meta ? int(meta) : "sin meta"}</span>
          </p>
          {meta && (
            <>
              <div className="mt-3 h-3 w-full rounded-full bg-ink-100">
                <div
                  className={clsx("h-3 rounded-full", (avance ?? 0) >= 1 ? "bg-success" : "bg-brand-500")}
                  style={{ width: `${Math.min(100, (avance ?? 0) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">{pct(avance)} de la meta</p>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm lg:col-span-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-ink-500">Días con data</p>
            <p className="font-semibold text-ink-900">
              {diasConData} de {diasMes}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Promedio diario</p>
            <p className="font-semibold text-ink-900">{int(ritmo)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Necesitas por día</p>
            <p className={clsx("font-semibold", necesario != null && necesario > ritmo ? "text-danger" : "text-ink-900")}>
              {necesario == null ? "—" : int(Math.ceil(necesario))}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Proyección al cierre</p>
            <p className={clsx("font-semibold", meta && proyeccion < meta ? "text-danger" : "text-success")}>
              {diasConData ? int(proyeccion) : "—"}
            </p>
          </div>
          {vaBien != null && (
            <p className={clsx("col-span-2 text-xs font-medium lg:col-span-4", vaBien ? "text-success" : "text-danger")}>
              {vaBien
                ? `Vas arriba del ritmo: a esta fecha se esperaban ${int(esperadoHoy)} y llevas ${int(entregadas)}.`
                : `Vas abajo del ritmo: a esta fecha se esperaban ${int(esperadoHoy)} y llevas ${int(entregadas)}.`}
            </p>
          )}
          {/* Barras por día */}
          <div className="col-span-2 flex h-16 items-end gap-0.5 lg:col-span-4">
            {Array.from({ length: diasMes }, (_, i) => {
              const d = data?.por_dia.find((x) => Number(x.dia.slice(8, 10)) === i + 1);
              const v = d?.entregadas ?? 0;
              return (
                <div
                  key={i}
                  className={clsx("flex-1 rounded-t", v ? "bg-brand-500/80" : "bg-ink-100")}
                  style={{ height: `${Math.max(4, (v / maxDia) * 100)}%` }}
                  title={`${i + 1} de ${MESES[m - 1]}: ${int(v)} entregadas`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------
// Rappi Turbo
// ---------------------------------------------------------------------
function Turbo() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [data, setData] = useState<(RappiTurbo & { total_datos: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [nueva, setNueva] = useState({ picking_point_id: "", nombre: "", restaurant_id: "", fecha_activacion: "" });

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    return p.toString();
  }, [desde, hasta]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/rappi/turbo?${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        setData(res);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, recargar]);

  async function guardarTienda(cuerpo: Record<string, unknown>) {
    const res = await fetch("/api/rappi/turbo/tiendas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const d = await res.json();
    if (!res.ok || d?.error) {
      setError(d?.error ?? "No se guardó.");
      return false;
    }
    setRecargar((n) => n + 1);
    return true;
  }

  const get = (turbo: boolean, post: boolean): TurboResumen | undefined =>
    data?.resumen?.find((x) => x.turbo === turbo && x.post === post);
  const tPre = get(true, false);
  const tPost = get(true, true);
  const cPre = get(false, false);
  const cPost = get(false, true);
  const filas: [string, (x?: TurboResumen) => number | null, "pct" | "min", boolean][] = [
    ["Órdenes", (x) => x?.n ?? null, "min", false],
    ["% Completas", (x) => (x?.n ? x.completas / x.n : null), "pct", false],
    ["% Devueltas", (x) => (x?.n ? x.devueltas / x.n : null), "pct", true],
    ["% Canceladas", (x) => (x?.n ? x.canceladas / x.n : null), "pct", true],
    ["Aceptación de repartidor", (x) => x?.t_rep ?? null, "min", true],
    ["Llegar a tienda", (x) => x?.t_llegar ?? null, "min", true],
    ["Recoger pedido", (x) => x?.t_recoger ?? null, "min", true],
    ["Entregar", (x) => x?.t_entregar ?? null, "min", true],
    ["Ciclo total (aceptada → completada)", (x) => x?.ciclo ?? null, "min", true],
    ["% Tiempo total > 60 min", (x) => (x?.n ? x.gt60 / x.n : null), "pct", true],
  ];
  const fmt = (v: number | null, tipo: "pct" | "min", esConteo: boolean) =>
    esConteo ? int(v) : tipo === "pct" ? pct(v) : min(v);
  const cambio = (a: number | null, b: number | null, tipo: "pct" | "min") =>
    a == null || b == null ? null : tipo === "pct" ? (b - a) * 100 : b - a;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Rappi Turbo</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Órdenes entregadas por Rappi en las tiendas Turbo, antes y después de su activación. Se comparan contra las tiendas
            sin Turbo en las mismas fechas para saber si la mejora es por Turbo.
          </p>
        </div>
        <a
          href={`/api/rappi/turbo/excel?${query}`}
          className={clsx(
            "rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600",
            (!data || loading || !data.total_datos) && "pointer-events-none opacity-40"
          )}
        >
          Descargar Excel Turbo
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
        </div>
        {data?.periodo && (
          <p className="pb-2 text-xs text-ink-500">
            Mostrando del {fechaCorta(data.periodo.desde)} al {fechaCorta(data.periodo.hasta)}
            {desde || hasta ? "" : " (por defecto: 10 días antes de la activación hasta el último día con data)"} ·{" "}
            {int(data.total_datos)} órdenes en tiendas Turbo.
          </p>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {data && !data.sin_tiendas && (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4 font-medium">Indicador</th>
                  <th className="py-2 pr-4 text-right font-medium">Turbo antes</th>
                  <th className="py-2 pr-4 text-right font-medium">Turbo después</th>
                  <th className="py-2 pr-4 text-right font-medium">Cambio</th>
                  <th className="py-2 pr-4 text-right font-medium text-ink-300">Sin Turbo antes</th>
                  <th className="py-2 pr-4 text-right font-medium text-ink-300">Sin Turbo después</th>
                  <th className="py-2 text-right font-medium">¿Turbo mejoró más?</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(([nombre, val, tipo, menorEsMejor], i) => {
                  const esConteo = i === 0;
                  const ct = cambio(val(tPre), val(tPost), tipo);
                  const cc = cambio(val(cPre), val(cPost), tipo);
                  const diff = ct != null && cc != null ? ct - cc : null;
                  const mejor = diff == null || esConteo ? null : menorEsMejor ? diff < 0 : diff > 0;
                  return (
                    <tr key={nombre} className="border-b border-ink-100 last:border-0">
                      <td className="py-2 pr-4 text-ink-900">{nombre}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmt(val(tPre), tipo, esConteo)}</td>
                      <td className="py-2 pr-4 text-right font-semibold tabular-nums">{fmt(val(tPost), tipo, esConteo)}</td>
                      <td
                        className={clsx(
                          "py-2 pr-4 text-right tabular-nums",
                          ct == null || esConteo ? "text-ink-500" : (menorEsMejor ? ct <= 0 : ct >= 0) ? "text-success" : "text-danger"
                        )}
                      >
                        {ct == null || esConteo ? "—" : `${ct >= 0 ? "+" : ""}${ct.toFixed(1)}${tipo === "pct" ? " pts" : " min"}`}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink-500">{fmt(val(cPre), tipo, esConteo)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-ink-500">{fmt(val(cPost), tipo, esConteo)}</td>
                      <td className={clsx("py-2 text-right text-xs font-semibold", mejor == null ? "text-ink-300" : mejor ? "text-success" : "text-danger")}>
                        {mejor == null ? "—" : mejor ? "Sí" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            &quot;¿Turbo mejoró más?&quot; compara el cambio de las tiendas Turbo contra el cambio de las tiendas sin Turbo en las
            mismas fechas. Si las dos mejoraron igual, la mejora no es por Turbo.
          </p>

          {data.semanas.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-ink-900">Por semana (tiendas Turbo)</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4 font-medium">Semana del</th>
                      <th className="py-2 pr-4 text-right font-medium">Órdenes</th>
                      <th className="py-2 pr-4 text-right font-medium">% Completas</th>
                      <th className="py-2 pr-4 text-right font-medium">% Devueltas</th>
                      <th className="py-2 pr-4 text-right font-medium">Aceptación rep.</th>
                      <th className="py-2 pr-4 text-right font-medium">Recoger</th>
                      <th className="py-2 pr-4 text-right font-medium">Ciclo total</th>
                      <th className="py-2 text-right font-medium">&gt; 60 min</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.semanas.map((s) => (
                      <tr key={s.semana} className="border-b border-ink-100 last:border-0">
                        <td className="py-2 pr-4 text-ink-900">
                          {fechaCorta(s.semana)}
                          {s.semana <= data.activacion && data.activacion < new Date(new Date(s.semana).getTime() + 7 * 864e5).toISOString().slice(0, 10) && (
                            <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">activación</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{int(s.n)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{pct(s.n ? s.completas / s.n : null)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{pct(s.n ? s.devueltas / s.n : null)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{min(s.t_rep)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{min(s.t_recoger)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{min(s.ciclo)}</td>
                        <td className="py-2 text-right tabular-nums">{pct(s.n ? s.gt60 / s.n : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6">
            <TiendasTurbo tiendas={data.tiendas} onGuardar={guardarTienda} />
            <div className="mt-4 rounded-lg border border-ink-100 bg-ink-50 p-4">
              <p className="text-sm font-medium text-ink-900">Agregar tienda a Turbo</p>
              <p className="text-xs text-ink-500">
                Los IDs vienen en tu archivo &quot;cruzado&quot;: Picking point ID (de Rappi) y _id external largo (el ID de tienda de
                operaciones).
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
                <input className={campo} placeholder="Picking point ID" value={nueva.picking_point_id} onChange={(e) => setNueva({ ...nueva, picking_point_id: e.target.value })} />
                <input className={clsx(campo, "md:col-span-2")} placeholder="Nombre (ej. KFC SATELITE 542)" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
                <input className={campo} placeholder="_id external largo" value={nueva.restaurant_id} onChange={(e) => setNueva({ ...nueva, restaurant_id: e.target.value })} />
                <input type="date" className={campo} value={nueva.fecha_activacion} onChange={(e) => setNueva({ ...nueva, fecha_activacion: e.target.value })} />
              </div>
              <button
                onClick={async () => {
                  const ok = await guardarTienda({ ...nueva, activa: true });
                  if (ok) setNueva({ picking_point_id: "", nombre: "", restaurant_id: "", fecha_activacion: "" });
                }}
                disabled={!nueva.picking_point_id || !nueva.nombre}
                className="mt-2 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

function TiendasTurbo({ tiendas, onGuardar }: { tiendas: TurboTienda[]; onGuardar: (c: Record<string, unknown>) => Promise<boolean> }) {
  const [abierta, setAbierta] = useState(false);
  const activas = tiendas.filter((t) => t.activa).length;
  return (
    <div className="rounded-lg border border-ink-100">
      <button onClick={() => setAbierta(!abierta)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="text-sm font-medium text-ink-900">
          Tiendas Turbo <span className="text-ink-500">({activas} activas)</span>
        </span>
        <span className="text-xs font-medium text-brand-600">{abierta ? "Ocultar" : "Ver y editar"}</span>
      </button>
      {abierta && (
        <div className="max-h-[420px] overflow-auto border-t border-ink-100 px-4 pb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                <th className="py-2 pr-4 font-medium">Tienda</th>
                <th className="py-2 pr-4 font-medium">Picking point</th>
                <th className="py-2 pr-4 text-right font-medium">Órdenes Rappi</th>
                <th className="py-2 pr-4 font-medium">Activación</th>
                <th className="py-2 font-medium">Activa</th>
              </tr>
            </thead>
            <tbody>
              {tiendas.map((t) => (
                <tr key={t.picking_point_id} className={clsx("border-b border-ink-100 last:border-0", !t.activa && "opacity-50")}>
                  <td className="py-1.5 pr-4 text-ink-900">
                    {t.nombre}
                    {!t.restaurant_id && <span className="ml-1 text-[10px] text-danger">sin ID de operaciones</span>}
                  </td>
                  <td className="py-1.5 pr-4 text-xs text-ink-500">{t.picking_point_id}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{int(t.ordenes)}</td>
                  <td className="py-1.5 pr-4">
                    <input
                      type="date"
                      defaultValue={t.fecha_activacion}
                      onBlur={(e) => e.target.value !== t.fecha_activacion && onGuardar({ picking_point_id: t.picking_point_id, fecha_activacion: e.target.value })}
                      className="rounded-md border border-ink-200 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={t.activa}
                      onChange={(e) => onGuardar({ picking_point_id: t.picking_point_id, activa: e.target.checked })}
                      className="h-4 w-4 accent-brand-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Página
function DetalleDia({ dias, dia }: { dias: RappiPanorama["por_dia"]; dia: string | null }) {
  const d = dias.find((x) => x.dia === dia);
  if (!d) return <DetalleDiaVacio />;
  const p = buscarPrevio(dias, d.dia);
  const pc = d.envios ? d.canceladas / d.envios : null;
  const pcPrev = p && p.envios ? p.canceladas / p.envios : null;
  const filas: FilaDia[] = [
    { etiqueta: "Envíos", actual: d.envios, previo: p?.envios, formato: "n", mejor: null },
    { etiqueta: "Entregadas", actual: d.entregadas, previo: p?.entregadas, formato: "n", mejor: "sube" },
    { etiqueta: "Canceladas por Rappi", actual: d.canceladas, previo: p?.canceladas, formato: "n", mejor: "baja" },
    { etiqueta: "% canceladas", actual: pc, previo: pcPrev, formato: "pct", mejor: "baja" },
    { etiqueta: "Devueltas", actual: d.devueltas, previo: p?.devueltas, formato: "n", mejor: "baja" },
    { etiqueta: "Tiempo al cliente", actual: d.tiempo_a_cliente, previo: p?.tiempo_a_cliente, formato: "min", mejor: "baja" },
  ];
  return <DetalleDiaBase dia={d.dia} filas={filas} hayPrevio={!!p} />;
}

// ---------------------------------------------------------------------
export default function RappiPage() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [data, setData] = useState<RappiPanorama | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diaFijo, setDiaFijo] = useState<string | null>(null);
  const [diaHover, setDiaHover] = useState<string | null>(null);

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
      fetch(`/api/rappi/panorama?${query}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((res) => {
          if (res?.error) throw new Error(res.error);
          setData(res);
        })
        .catch((e) => setError(e.message ?? "No se pudo cargar Rappi."))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const k = data?.kpis;
  const gx = data?.general_vs_exclusivo;
  const cargando = (v: string) => (loading ? "…" : v);
  const maxDia = Math.max(1, ...(data?.por_dia ?? []).map((d) => d.envios));
  const etapas = useMemo(() => {
    const m = new Map<string, number>();
    (data?.cancelaciones ?? []).forEach((c) => m.set(c.etapa, (m.get(c.etapa) ?? 0) + c.envios));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);
  const maxEtapa = Math.max(1, ...etapas.map(([, n]) => n));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Rappi</h1>
      <p className="mt-1 text-sm text-ink-500">
        Rappi exclusivo de KFC, con el reporte que descargas de la plataforma de Rappi. Las órdenes de Rappi que no vienen en
        ese reporte son del Rappi general.
      </p>

      <MetaMes />

      {data?.sin_datos ? (
        <Card className="mt-6">
          <p className="text-sm text-ink-700">
            Todavía no hay reporte de Rappi cargado. Súbelo en{" "}
            <a href="/upload" className="font-medium text-brand-600 hover:underline">Cargar datos</a> (tarjeta &quot;Reporte de Rappi KFC&quot;).
          </p>
        </Card>
      ) : (
        <>
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
              <MultiSelectFilter label="Tienda" items={data?.tiendas_opciones ?? []} selected={tiendas} onChange={setTiendas} />
            </div>
          </Card>
          {data?.periodo && (
            <p className="mt-2 text-xs text-ink-500">
              Mostrando del {fechaCorta(data.periodo.desde)} al {fechaCorta(data.periodo.hasta)}
              {desde || hasta ? "" : " (todo el reporte cargado)"}.
            </p>
          )}
          {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          {/* Tarjetas */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <KpiCard label="Envíos a Rappi" value={cargando(int(k?.envios))} sublabel={k ? `${int(k.ordenes)} órdenes · ${int(k.reintentos)} reintentos` : undefined} />
            <KpiCard label="Entregadas" value={cargando(int(k?.entregadas))} sublabel={`${pct(k?.pct_entregadas)} de los envíos`} accent="success" />
            <KpiCard label="Canceladas por Rappi" value={cargando(int(k?.canceladas))} sublabel={`${pct(k?.pct_canceladas)} de los envíos`} accent="danger" />
            <KpiCard label="Devueltas" value={cargando(int(k?.devueltas))} sublabel={`${pct(k?.pct_devueltas)} de los envíos`} accent="warning" />
            <KpiCard label="Tiempo al cliente" value={cargando(min(k?.tiempo_a_cliente))} sublabel={`${pct(k?.pct_45)} en menos de 45 min`} />
            <KpiCard label="Asignar repartidor" value={cargando(min(k?.min_asignar))} sublabel="Entregadas" />
            <KpiCard label="Espera en tienda" value={cargando(min(k?.espera))} sublabel={`Llegar a tienda: ${min(k?.min_a_tienda)}`} accent="warning" />
            <KpiCard label="Valor entregado" value={cargando(money(k?.valor_entregado))} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <h2 className="text-sm font-semibold text-ink-900">Envíos por día</h2>
              <div className="mt-4 flex h-40 items-stretch gap-1" onMouseLeave={() => setDiaHover(null)}>
                {(data?.por_dia ?? []).map((d) => {
                  const activo = (diaHover ?? diaFijo) === d.dia;
                  return (
                    <button
                      type="button"
                      key={d.dia}
                      onMouseEnter={() => setDiaHover(d.dia)}
                      onFocus={() => setDiaHover(d.dia)}
                      onClick={() => setDiaFijo((x) => (x === d.dia ? null : d.dia))}
                      aria-label={`${fechaCorta(d.dia)}: ${int(d.envios)} envíos`}
                      className={clsx(
                        "flex flex-1 flex-col justify-end rounded-t outline-none transition-opacity",
                        (diaHover ?? diaFijo) && !activo ? "opacity-40" : "opacity-100",
                        activo && "bg-ink-50"
                      )}
                    >
                      <div className="w-full rounded-t bg-danger/70" style={{ height: `${(d.canceladas / maxDia) * 140}px` }} />
                      <div className="w-full bg-warning/70" style={{ height: `${(d.devueltas / maxDia) * 140}px` }} />
                      <div className="w-full bg-success/70" style={{ height: `${(d.entregadas / maxDia) * 140}px` }} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-success/70" /> Entregadas</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-warning/70" /> Devueltas</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-danger/70" /> Canceladas</span>
                <span>Pasa el mouse para ver el detalle; da clic para dejarlo fijo.</span>
              </div>
              <DetalleDia dias={data?.por_dia ?? []} dia={diaHover ?? diaFijo} />
            </Card>
            <Card>
              <h2 className="text-sm font-semibold text-ink-900">Rappi exclusivo vs general</h2>
              <p className="mt-1 text-xs text-ink-500">
                Órdenes que operaciones marca como Rappi en el periodo: si vienen en tu reporte de Rappi son del exclusivo; si no,
                del general.
              </p>
              {gx && (
                <div className="mt-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-100">
                    <div className="bg-brand-500" style={{ width: `${(gx.exclusivo / Math.max(1, gx.exclusivo + gx.general)) * 100}%` }} />
                    <div className="bg-peri" style={{ width: `${(gx.general / Math.max(1, gx.exclusivo + gx.general)) * 100}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span><span className="font-semibold text-brand-600">{int(gx.exclusivo)}</span> exclusivo</span>
                    <span><span className="font-semibold" style={{ color: "#5A6BE0" }}>{int(gx.general)}</span> general</span>
                  </div>
                  <p className="mt-4 text-xs font-medium text-ink-900">Tiendas con órdenes en el Rappi general</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                    {(data?.tiendas_general ?? []).slice(0, 30).map((t) => (
                      <li key={t.tienda} className="flex justify-between gap-2">
                        <span className="truncate text-ink-700">{t.tienda}</span>
                        <span className="flex-shrink-0 tabular-nums text-ink-500">
                          {int(t.general)} de {int(t.total)}
                        </span>
                      </li>
                    ))}
                    {data && data.tiendas_general.length === 0 && <li className="text-ink-500">Ninguna en este periodo.</li>}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Detalle */}
          <div className="mt-6 space-y-4">
            <Seccion
              titulo="¿Por qué cancela Rappi?"
              descripcion="Etapa en la que se canceló el envío y el motivo que reporta Rappi."
              resumen={etapas[0] ? <span>Principal: {ETAPAS_CANCELACION[etapas[0][0]] ?? etapas[0][0]}</span> : null}
              abierta
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-ink-900">Por etapa</p>
                  <ul className="mt-3 space-y-3">
                    {etapas.map(([e, n]) => (
                      <li key={e}>
                        <div className="flex justify-between text-sm">
                          <span className="text-ink-900">{ETAPAS_CANCELACION[e] ?? e}</span>
                          <span className="tabular-nums text-ink-700">{int(n)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100">
                          <div className="h-1.5 rounded-full bg-danger/70" style={{ width: `${(n / maxEtapa) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-900">Etapa y motivo</p>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {(data?.cancelaciones ?? []).slice(0, 12).map((c) => (
                        <tr key={`${c.etapa}-${c.motivo}`} className="border-b border-ink-100 last:border-0">
                          <td className="py-1.5 pr-3 text-xs text-ink-500">{ETAPAS_CANCELACION[c.etapa] ?? c.etapa}</td>
                          <td className="py-1.5 pr-3 text-ink-900">{MOTIVOS_CANCELACION[c.motivo] ?? c.motivo}</td>
                          <td className="py-1.5 text-right tabular-nums">{int(c.envios)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Seccion>

            <Seccion titulo="Tiendas" descripcion="Envíos, cancelaciones y tiempos por tienda. Las marcadas con Turbo son de las 59." resumen={<span>{int(data?.tiendas.length)} tiendas</span>}>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4 font-medium">Tienda</th>
                      <th className="py-2 pr-4 text-right font-medium">Envíos</th>
                      <th className="py-2 pr-4 text-right font-medium">Entregadas</th>
                      <th className="py-2 pr-4 text-right font-medium">% Canceladas</th>
                      <th className="py-2 pr-4 text-right font-medium">Sin repartidor</th>
                      <th className="py-2 pr-4 text-right font-medium">Asignar</th>
                      <th className="py-2 pr-4 text-right font-medium">Espera</th>
                      <th className="py-2 text-right font-medium">Al cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.tiendas ?? []).map((t) => (
                      <tr key={t.tienda} className="border-b border-ink-100 last:border-0">
                        <td className="py-1.5 pr-4 text-ink-900">
                          {t.tienda}
                          {t.turbo && <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Turbo</span>}
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(t.envios)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(t.entregadas)}</td>
                        <td className={clsx("py-1.5 pr-4 text-right tabular-nums", t.pct_canceladas > 0.2 ? "font-semibold text-danger" : "")}>{pct(t.pct_canceladas)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(t.sin_repartidor)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{min(t.min_asignar)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{min(t.espera)}</td>
                        <td className="py-1.5 text-right tabular-nums">{min(t.tiempo_a_cliente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>

            <Seccion titulo="Por hora y vehículo" descripcion="A qué hora cancela más Rappi y cómo rinde cada tipo de vehículo.">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4 font-medium">Hora</th>
                      <th className="py-2 pr-4 text-right font-medium">Envíos</th>
                      <th className="py-2 pr-4 text-right font-medium">% Canceladas</th>
                      <th className="py-2 text-right font-medium">Asignar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.por_hora ?? []).filter((h) => h.envios >= 10).map((h) => (
                      <tr key={h.hora} className="border-b border-ink-100 last:border-0">
                        <td className="py-1.5 pr-4">{h.hora}:00</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(h.envios)}</td>
                        <td className={clsx("py-1.5 pr-4 text-right tabular-nums", h.pct_canceladas > 0.25 ? "font-semibold text-danger" : "")}>{pct(h.pct_canceladas)}</td>
                        <td className="py-1.5 text-right tabular-nums">{min(h.min_asignar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="w-full self-start text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4 font-medium">Vehículo</th>
                      <th className="py-2 pr-4 text-right font-medium">Envíos</th>
                      <th className="py-2 pr-4 text-right font-medium">% Entregadas</th>
                      <th className="py-2 text-right font-medium">Al cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.vehiculos ?? []).map((v) => (
                      <tr key={v.vehiculo} className="border-b border-ink-100 last:border-0">
                        <td className="py-1.5 pr-4 capitalize">{({ motorbike: "Moto", bicycle: "Bicicleta", car: "Auto" } as Record<string, string>)[v.vehiculo] ?? v.vehiculo}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(v.envios)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{pct(v.pct_entregadas)}</td>
                        <td className="py-1.5 text-right tabular-nums">{min(v.tiempo_a_cliente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          </div>
        </>
      )}

      <Turbo />
    </div>
  );
}
