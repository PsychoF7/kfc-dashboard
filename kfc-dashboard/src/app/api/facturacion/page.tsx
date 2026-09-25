"use client";

import { useEffect, useMemo, useState } from "react";

interface FilaFactura {
  codigo: string;
  restaurant: string;
  tipo: "delivery" | "flotilla";
  ordenes_mes: number;
  es_nueva: boolean;
  fecha_inicio: string | null;
  dias_a_cobrar: number | null;
  monto_a_cobrar: number | null;
  posible_baja: boolean;
  sin_seguimiento: boolean;
}

interface Calculo {
  dias_en_mes: number;
  costo_mensual: number;
  costo_diario: number;
  sucursales_activas_inicio_mes: number;
  altas_nuevas: FilaFactura[];
  posibles_bajas: FilaFactura[];
  sin_seguimiento: FilaFactura[];
  resumen: {
    facturacion_flat: number;
    proporcional_delivery: number;
    proporcional_flotilla: number;
    total_a_facturar: number;
  };
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));

export default function FacturacionPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth()); // por default, el mes anterior

  const [sincronizando, setSincronizando] = useState(false);
  const [syncResultado, setSyncResultado] = useState<{ ok?: boolean; total?: number; error?: string } | null>(
    null
  );

  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/facturacion/calcular?year=${year}&month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setCalculo(data);
      })
      .catch((e) => setError(e.message ?? "No se pudo calcular la factura."))
      .finally(() => setLoading(false));
  }, [year, month]);

  async function sincronizar() {
    setSincronizando(true);
    setSyncResultado(null);
    try {
      const res = await fetch("/api/facturacion/sincronizar-altas", { method: "POST" });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setSyncResultado({ ok: true, total: data.total });
    } catch (e) {
      setSyncResultado({ error: e instanceof Error ? e.message : "No se pudo sincronizar." });
    } finally {
      setSincronizando(false);
    }
  }

  const altasDelivery = useMemo(
    () => calculo?.altas_nuevas.filter((f) => f.tipo === "delivery") ?? [],
    [calculo]
  );
  const altasFlotilla = useMemo(
    () => calculo?.altas_nuevas.filter((f) => f.tipo === "flotilla") ?? [],
    [calculo]
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Facturación mensual</h1>
      <p className="mt-1 text-sm text-ink-500">
        Se factura en los primeros 5 días del mes siguiente — normalmente vas a elegir el mes que
        acaba de terminar.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Mes a facturar</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          onClick={sincronizar}
          disabled={sincronizando}
          className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          {sincronizando ? "Sincronizando…" : "Sincronizar altas/bajas"}
        </button>
      </div>

      {syncResultado?.ok && (
        <p className="mt-2 text-xs font-medium text-success">
          ✓ Se sincronizaron {syncResultado.total?.toLocaleString("es-MX")} movimientos.
        </p>
      )}
      {syncResultado?.error && (
        <p className="mt-2 text-xs font-medium text-danger">{syncResultado.error}</p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-ink-500">Calculando…</p>}

      {!loading && calculo && (
        <>
          <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink-900">
              Resumen — {MESES[month - 1]} {year}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Sucursales activas al inicio del mes</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">
                  {int(calculo.sucursales_activas_inicio_mes)}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  × {money(calculo.costo_mensual)} = {money(calculo.resumen.facturacion_flat)}
                </p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Días en el mes / costo diario</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">
                  {calculo.dias_en_mes} días
                </p>
                <p className="mt-1 text-xs text-ink-500">{money(calculo.costo_diario)} / día</p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Proporcional altas Delivery</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">
                  {money(calculo.resumen.proporcional_delivery)}
                </p>
                <p className="mt-1 text-xs text-ink-500">{altasDelivery.length} tienda(s) nueva(s)</p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Proporcional altas Mi Flotilla</p>
                <p className="mt-1 text-lg font-semibold text-ink-900">
                  {money(calculo.resumen.proporcional_flotilla)}
                </p>
                <p className="mt-1 text-xs text-ink-500">{altasFlotilla.length} tienda(s) nueva(s)</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-brand-50 p-4">
              <p className="text-xs text-ink-500">Total a facturar</p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {money(calculo.resumen.total_a_facturar)}
              </p>
            </div>
          </div>

          {calculo.sin_seguimiento.length > 0 && (
            <div className="mt-6 rounded-xl border border-warning bg-warning-bg p-5 shadow-card">
              <h2 className="text-sm font-semibold text-warning">
                ⚠ Tiendas con órdenes este mes pero sin historial de alta ({calculo.sin_seguimiento.length})
              </h2>
              <p className="mt-1 text-xs text-ink-700">
                Tuvieron órdenes pero no aparecen en tu hoja de altas/bajas — puede que sean de
                antes de que empezaras a llevar el registro, o un desfase de nombre. Revísalas a
                mano antes de facturar.
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {calculo.sin_seguimiento.map((f) => (
                  <li key={f.codigo} className="flex justify-between text-ink-900">
                    <span>{f.restaurant}</span>
                    <span className="text-ink-500">{int(f.ordenes_mes)} órdenes</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {calculo.posibles_bajas.length > 0 && (
            <div className="mt-6 rounded-xl border border-danger bg-danger-bg p-5 shadow-card">
              <h2 className="text-sm font-semibold text-danger">
                ⚠ Posibles bajas — sin órdenes este mes ({calculo.posibles_bajas.length})
              </h2>
              <p className="mt-1 text-xs text-ink-700">
                Estaban activas antes de este mes y no tienen una baja registrada, pero tampoco
                tuvieron ni una orden. Se siguen contando en "sucursales activas" hasta que
                confirmes la baja en tu hoja.
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {calculo.posibles_bajas.map((f) => (
                  <li key={f.codigo} className="text-ink-900">
                    {f.restaurant}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink-900">
              Altas nuevas este mes ({calculo.altas_nuevas.length})
            </h2>
            {calculo.altas_nuevas.length === 0 ? (
              <p className="mt-2 text-xs text-ink-500">No hubo tiendas nuevas este mes.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                      <th className="py-2 pr-4">Tienda</th>
                      <th className="py-2 pr-4">Tipo</th>
                      <th className="py-2 pr-4">Fecha inicio</th>
                      <th className="py-2 pr-4 text-right">Días a cobrar</th>
                      <th className="py-2 pr-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculo.altas_nuevas.map((f) => (
                      <tr key={f.codigo} className="border-b border-ink-100 last:border-0">
                        <td className="py-2 pr-4 text-ink-900">{f.restaurant}</td>
                        <td className="py-2 pr-4 capitalize text-ink-700">{f.tipo}</td>
                        <td className="py-2 pr-4 text-ink-700">{f.fecha_inicio}</td>
                        <td className="py-2 pr-4 text-right text-ink-700">{int(f.dias_a_cobrar)}</td>
                        <td className="py-2 pr-4 text-right font-semibold text-ink-900">
                          {money(f.monto_a_cobrar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
