"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import { ESTADOS, FilaFactura, mesAnterior, mesSiguiente, nombreMes, nombreMesAnio, partesMes } from "@/lib/facturacion";
import type { FacturaRespuesta } from "@/lib/facturacion-server";

const money = (n: number | null | undefined, d = 2) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));

const AÑOS = [2026, 2027, 2028];

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

/** Nota de una tienda: se guarda al salir del campo. */
function Nota({
  fila,
  deshabilitada,
  onGuardar,
}: {
  fila: FilaFactura;
  deshabilitada: boolean;
  onGuardar: (nota: string) => Promise<void>;
}) {
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        defaultValue={fila.nota ?? ""}
        disabled={deshabilitada}
        placeholder="Nota (sale en la hoja Nuevas)"
        onBlur={async (e) => {
          if (e.target.value === (fila.nota ?? "")) return;
          try {
            await onGuardar(e.target.value);
            setEstado("ok");
          } catch {
            setEstado("error");
          }
        }}
        className="w-full min-w-[220px] rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-ink-50"
      />
      <span className="w-3 text-xs">
        {estado === "ok" && <span className="text-success">✓</span>}
        {estado === "error" && <span className="text-danger">!</span>}
      </span>
    </div>
  );
}

export default function FacturacionPage() {
  const [mes, setMes] = useState<string | null>(null);
  const [data, setData] = useState<FacturaRespuesta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nuevaAlta, setNuevaAlta] = useState({ tienda: "", nota: "" });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/facturacion/factura${mes ? `?mes=${mes.slice(0, 7)}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => {
        if (res?.error) throw new Error(res.error);
        setData(res);
        if (!mes) setMes(res.calculo.mesPago);
      })
      .catch((e) => setError(e.message ?? "No se pudo calcular la factura."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, recargar]);

  const c = data?.calculo;
  const r = c?.resumen;
  const cerrada = !!data?.cerrada;
  const filas = useMemo(() => c?.filas ?? [], [c]);
  const nuevas = filas.filter((f) => f.estado === "nueva").sort((a, b) => (a.primerDia ?? 99) - (b.primerDia ?? 99));
  const sinOrdenes = filas.filter((f) => f.estado === "sin_ordenes" || f.estado === "alta_manual");
  const bajas = filas.filter((f) => f.estado === "baja");
  const detalle = filas.filter((f) => f.tienda.toLowerCase().includes(busqueda.toLowerCase()));

  async function ajuste(f: Pick<FilaFactura, "tienda" | "codigo">, accion: "baja" | "alta" | null, nota: string | null) {
    const res = await fetch("/api/facturacion/ajustes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes, codigo: f.codigo, tienda: f.tienda, accion, nota }),
    });
    const d = await res.json();
    if (!res.ok || d?.error) throw new Error(d?.error ?? "No se guardó.");
  }
  const accionDe = (f: FilaFactura) => (f.estado === "baja" ? "baja" : f.estado === "alta_manual" ? "alta" : null);

  async function cambiar(f: FilaFactura, accion: "baja" | "alta" | null) {
    setTrabajando(true);
    try {
      await ajuste(f, accion, f.nota);
      setRecargar((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó.");
    } finally {
      setTrabajando(false);
    }
  }

  async function agregarAlta() {
    if (!nuevaAlta.tienda.trim()) return;
    setTrabajando(true);
    try {
      const tienda = nuevaAlta.tienda.trim().toUpperCase();
      await ajuste({ tienda, codigo: tienda.match(/^\d+/)?.[0] ?? tienda }, "alta", nuevaAlta.nota || null);
      setNuevaAlta({ tienda: "", nota: "" });
      setRecargar((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se guardó.");
    } finally {
      setTrabajando(false);
    }
  }

  async function cerrar() {
    setTrabajando(true);
    setError(null);
    try {
      const res = await fetch("/api/facturacion/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      const d = await res.json();
      if (!res.ok || d?.error) throw new Error(d?.error ?? "No se pudo cerrar.");
      setConfirmarCierre(false);
      setRecargar((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar.");
    } finally {
      setTrabajando(false);
    }
  }

  async function reabrir() {
    setTrabajando(true);
    try {
      const res = await fetch(`/api/facturacion/cerrar?mes=${mes}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok || d?.error) throw new Error(d?.error ?? "No se pudo reabrir.");
      setRecargar((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reabrir.");
    } finally {
      setTrabajando(false);
    }
  }

  const sel = mes ? partesMes(mes) : null;
  const elegir = (y: number, m: number) => setMes(`${y}-${String(m).padStart(2, "0")}-01`);
  const cambioOrdenes =
    r && data?.ordenesMesAnterior ? ((r.ordenesMes - data.ordenesMesAnterior) / data.ordenesMesAnterior) * 100 : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Facturación mensual</h1>
      <p className="mt-1 text-sm text-ink-500">
        La factura lleva el nombre del mes en que se paga y se arma con las órdenes del mes anterior.
      </p>

      {/* Selector y acciones */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">Factura de</label>
              <div className="flex gap-2">
                <select
                  value={sel?.m ?? ""}
                  onChange={(e) => sel && elegir(sel.y, Number(e.target.value))}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {nombreMes(`2026-${String(m).padStart(2, "0")}-01`)}
                    </option>
                  ))}
                </select>
                <select
                  value={sel?.y ?? ""}
                  onChange={(e) => sel && elegir(Number(e.target.value), sel.m)}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {AÑOS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {mes && (
              <p className="pb-2 text-sm text-ink-700">
                Se arma con las órdenes de{" "}
                <span className="font-semibold">{nombreMesAnio(mesAnterior(mes)).toLowerCase()}</span>
                {data && (
                  <span
                    className={clsx(
                      "ml-3 rounded-full px-2 py-0.5 text-xs font-semibold",
                      cerrada ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
                    )}
                  >
                    {cerrada ? "Cerrada" : "Borrador"}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={mes ? `/api/facturacion/excel?mes=${mes.slice(0, 7)}` : "#"}
              className={clsx(
                "rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50",
                (!data || loading) && "pointer-events-none opacity-40"
              )}
            >
              Descargar Excel
            </a>
            {cerrada ? (
              <button
                onClick={reabrir}
                disabled={trabajando}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-40"
              >
                Reabrir para corregir
              </button>
            ) : (
              <button
                onClick={() => setConfirmarCierre(true)}
                disabled={!data || loading || trabajando}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              >
                Cerrar factura
              </button>
            )}
          </div>
        </div>

        {data && (
          <p className="mt-3 text-xs text-ink-500">
            {data.baseMes
              ? `Lista base: la factura de ${nombreMesAnio(data.baseMes)} (cerrada). `
              : "No hay una factura anterior cerrada: todas las tiendas con órdenes salen como nuevas. "}
            {cerrada && data.cerradaEl && `Cerrada el ${new Date(data.cerradaEl).toLocaleDateString("es-MX")}. `}
            {cerrada && data.hayFacturaPosteriorCerrada && "Ojo: ya hay una factura posterior cerrada que usa esta como base."}
          </p>
        )}

        {confirmarCierre && r && mes && (
          <div className="mt-4 rounded-lg border border-brand-500 bg-brand-50 p-4 text-sm">
            <p className="font-semibold text-ink-900">¿Cerrar la factura de {nombreMesAnio(mes)}?</p>
            <p className="mt-1 text-ink-700">
              Sus {int(r.tiendasFacturar)} tiendas quedan guardadas como base de la factura de{" "}
              {nombreMesAnio(mesSiguiente(mes))}. Total: {money(r.total)}. Si necesitas corregir algo después, puedes
              reabrirla.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setConfirmarCierre(false)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700"
              >
                Cancelar
              </button>
              <button
                onClick={cerrar}
                disabled={trabajando}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {trabajando ? "Cerrando…" : "Sí, cerrar"}
              </button>
            </div>
          </div>
        )}
      </Card>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading && <p className="mt-6 text-sm text-ink-500">Calculando la factura…</p>}

      {!loading && c && r && (
        <>
          {/* Tarjetas */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Tiendas a facturar" value={int(r.tiendasFacturar)} sublabel={`${int(r.continuas)} con órdenes`} />
            <KpiCard
              label="Nuevas"
              value={int(r.nuevasDelivery + r.nuevasFlotilla)}
              sublabel={`${r.nuevasDelivery} Delivery · ${r.nuevasFlotilla} Mi Flotilla`}
              accent="success"
            />
            <KpiCard label="Sin órdenes" value={int(r.sinOrdenes + r.altasManuales)} sublabel="Se cobran completas" accent="warning" />
            <KpiCard label="Bajas" value={int(r.bajas)} sublabel="No se cobran" accent="danger" />
            <KpiCard
              label={`Órdenes de ${nombreMes(c.mesOperado).toLowerCase()}`}
              value={int(r.ordenesMes)}
              sublabel={
                cambioOrdenes != null
                  ? `${cambioOrdenes >= 0 ? "▲" : "▼"} ${Math.abs(cambioOrdenes).toFixed(1)}% vs mes anterior`
                  : "Completadas + devueltas"
              }
            />
            <KpiCard label="Total con IVA" value={money(r.total, 0)} accent="danger" />
          </div>

          {/* Resumen de cobro, igual que el bloque de tu Excel */}
          <Card className="mt-6">
            <h2 className="text-sm font-semibold text-ink-900">Resumen de cobro</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                    <th className="py-2 pr-4 font-medium">Concepto</th>
                    <th className="py-2 pr-4 text-right font-medium">Sucursales</th>
                    <th className="py-2 pr-4 text-right font-medium">Días</th>
                    <th className="py-2 pr-4 text-right font-medium">Costo por día</th>
                    <th className="py-2 text-right font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-ink-100">
                    <td className="py-2 pr-4 text-ink-900">
                      Mes de {nombreMes(c.mesPago).toLowerCase()} ({money(r.costoMensual, 0)} por tienda)
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(r.tiendasFacturar)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{c.diasMes}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(r.costoDiario)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{money(r.montoBase)}</td>
                  </tr>
                  <tr className="border-b border-ink-100">
                    <td className="py-2 pr-4 text-ink-900">Proporcional de {nombreMes(c.mesOperado).toLowerCase()} · Delivery</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(r.nuevasDelivery)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(r.diasDelivery)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(r.costoDiario)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{money(r.proporcionalDelivery)}</td>
                  </tr>
                  <tr className="border-b border-ink-100">
                    <td className="py-2 pr-4 text-ink-900">Proporcional de {nombreMes(c.mesOperado).toLowerCase()} · Mi Flotilla</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(r.nuevasFlotilla)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{int(r.diasFlotilla)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{money(r.costoDiario)}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{money(r.proporcionalFlotilla)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="pt-3 pr-4 text-right text-ink-700">Subtotal</td>
                    <td className="pt-3 text-right font-semibold tabular-nums">{money(r.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="py-1 pr-4 text-right text-ink-700">IVA 16%</td>
                    <td className="py-1 text-right tabular-nums">{money(r.iva)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="py-1 pr-4 text-right font-semibold text-ink-900">Total</td>
                    <td className="py-1 text-right text-lg font-semibold tabular-nums text-danger">{money(r.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Revisión */}
          <div className="mt-6 space-y-4">
            <Seccion
              titulo="Nuevas del mes"
              descripcion="No estaban en la factura anterior y tuvieron su primera orden en el mes. Se cobran los días desde esa primera orden."
              resumen={<span>{nuevas.length} tiendas</span>}
              abierta={!cerrada}
            >
              {nuevas.length === 0 ? (
                <p className="text-xs text-ink-500">No hay tiendas nuevas este mes.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                        <th className="py-2 pr-4 font-medium">Tienda</th>
                        <th className="py-2 pr-4 font-medium">Tipo</th>
                        <th className="py-2 pr-4 text-right font-medium">Primera orden</th>
                        <th className="py-2 pr-4 text-right font-medium">Días a cobrar</th>
                        <th className="py-2 pr-4 text-right font-medium">Monto</th>
                        <th className="py-2 pr-4 text-right font-medium">Órdenes</th>
                        <th className="py-2 font-medium">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nuevas.map((f) => (
                        <tr key={f.codigo} className="border-b border-ink-100 last:border-0">
                          <td className="py-2 pr-4 text-ink-900">{f.tienda}</td>
                          <td className="py-2 pr-4 text-xs text-ink-500">{f.tipo === "flotilla" ? "Mi Flotilla" : "Delivery"}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {f.primerDia} de {nombreMes(c.mesOperado).toLowerCase()}
                          </td>
                          <td className="py-2 pr-4 text-right font-semibold tabular-nums">{f.diasCobrar}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{money(f.monto)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{int(f.total)}</td>
                          <td className="py-2">
                            <Nota fila={f} deshabilitada={cerrada} onGuardar={(n) => ajuste(f, accionDe(f), n)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>

            <Seccion
              titulo="Sin órdenes y bajas"
              descripcion="Las tiendas de la lista sin órdenes este mes se siguen cobrando completas hasta que les marques baja."
              resumen={
                <span>
                  {sinOrdenes.length} sin órdenes · {bajas.length} bajas
                </span>
              }
              abierta={!cerrada}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sin órdenes (se cobran)</h3>
              {sinOrdenes.length === 0 ? (
                <p className="mt-2 text-xs text-ink-500">Todas las tiendas de la lista tuvieron órdenes.</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink-100">
                  {sinOrdenes.map((f) => (
                    <li key={f.codigo} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <span className="text-sm text-ink-900">
                        {f.tienda}
                        <span className={clsx("ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold", ESTADOS[f.estado].clase)}>
                          {ESTADOS[f.estado].label}
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <Nota fila={f} deshabilitada={cerrada} onGuardar={(n) => ajuste(f, accionDe(f), n)} />
                        {!cerrada && (
                          <button
                            onClick={() => cambiar(f, f.estado === "alta_manual" ? null : "baja")}
                            disabled={trabajando}
                            className="whitespace-nowrap text-xs font-semibold text-danger hover:underline disabled:opacity-40"
                          >
                            {f.estado === "alta_manual" ? "Quitar alta" : "Marcar baja"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-500">Bajas (no se cobran)</h3>
              {bajas.length === 0 ? (
                <p className="mt-2 text-xs text-ink-500">No hay bajas marcadas.</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink-100">
                  {bajas.map((f) => (
                    <li key={f.codigo} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <span className="text-sm font-semibold text-danger">{f.tienda}</span>
                      <div className="flex items-center gap-3">
                        <Nota fila={f} deshabilitada={cerrada} onGuardar={(n) => ajuste(f, "baja", n)} />
                        {!cerrada && (
                          <button
                            onClick={() => cambiar(f, null)}
                            disabled={trabajando}
                            className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline disabled:opacity-40"
                          >
                            Quitar baja
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!cerrada && (
                <div className="mt-6 rounded-lg border border-ink-100 bg-ink-50 p-4">
                  <p className="text-sm font-medium text-ink-900">Agregar alta sin órdenes</p>
                  <p className="text-xs text-ink-500">
                    Para una tienda dada de alta que todavía no tiene órdenes y sí se debe cobrar.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={nuevaAlta.tienda}
                      onChange={(e) => setNuevaAlta({ ...nuevaAlta, tienda: e.target.value })}
                      placeholder="Ej. 778 KFC LEON PLAZA MAYOR"
                      className="min-w-[260px] flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <input
                      value={nuevaAlta.nota}
                      onChange={(e) => setNuevaAlta({ ...nuevaAlta, nota: e.target.value })}
                      placeholder="Nota (opcional)"
                      className="min-w-[220px] flex-1 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      onClick={agregarAlta}
                      disabled={trabajando || !nuevaAlta.tienda.trim()}
                      className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}
            </Seccion>

            <Seccion
              titulo="Detalle por tienda"
              descripcion="Todas las tiendas de la factura con sus órdenes del mes."
              resumen={<span>{filas.length} tiendas</span>}
            >
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar tienda…"
                className="w-full max-w-sm rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <div className="mt-3 max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Tienda</th>
                      <th className="py-2 pr-4 font-medium">Tipo</th>
                      <th className="py-2 pr-4 font-medium">Estado</th>
                      <th className="py-2 pr-4 text-right font-medium">Órdenes</th>
                      <th className="py-2 pr-4 text-right font-medium">Primera orden</th>
                      <th className="py-2 text-right font-medium">Proporcional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.map((f, i) => (
                      <tr key={f.codigo} className="border-b border-ink-100 last:border-0">
                        <td className="py-1.5 pr-4 text-xs text-ink-300">{i + 1}</td>
                        <td className="py-1.5 pr-4 text-ink-900">{f.tienda}</td>
                        <td className="py-1.5 pr-4 text-xs text-ink-500">{f.tipo === "flotilla" ? "Mi Flotilla" : "Delivery"}</td>
                        <td className="py-1.5 pr-4">
                          <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold", ESTADOS[f.estado].clase)}>
                            {ESTADOS[f.estado].label}
                          </span>
                        </td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{int(f.total)}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums text-ink-500">{f.primerDia ? `día ${f.primerDia}` : "—"}</td>
                        <td className="py-1.5 text-right tabular-nums">{f.monto != null ? money(f.monto) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          </div>
        </>
      )}
    </div>
  );
}
