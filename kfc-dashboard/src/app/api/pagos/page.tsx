"use client";

import { useEffect, useMemo, useState } from "react";
import { getWeekRange } from "@/lib/week";

interface DiaComparativa {
  dia: string;
  en_ventas: number;
  en_operaciones: number;
  diferencia: number;
}

interface FilaDesglose {
  categoria: "general" | "delivery" | "flotilla";
  monto_efectivo: number;
  n_efectivo: number;
  n_tarjeta: number;
  envios_efectivo: number;
  envios_tarjeta: number;
  total_envio: number;
  efectivo_depositar: number;
  deposito_envios_tarjeta: number;
}

const CATEGORIA_LABEL: Record<string, string> = {
  general: "General",
  delivery: "Delivery",
  flotilla: "Mi Flotilla",
};

const UMBRAL_DIFERENCIA = 5;

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));

const diaLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

export default function PagosPage() {
  const [anchorDate, setAnchorDate] = useState("");
  const [dias, setDias] = useState<DiaComparativa[] | null>(null);
  const [filas, setFilas] = useState<FilaDesglose[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = useMemo(() => (anchorDate ? getWeekRange(anchorDate) : null), [anchorDate]);

  useEffect(() => {
    if (!week) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/pagos/comparativa?week_start=${week.start}&week_end=${week.end}`, {
        cache: "no-store",
      }).then((r) => r.json()),
      fetch(`/api/pagos/desglose?week_start=${week.start}&week_end=${week.end}`, {
        cache: "no-store",
      }).then((r) => r.json()),
    ])
      .then(([comparativa, desglose]) => {
        if (comparativa?.error) throw new Error(comparativa.error);
        if (desglose?.error) throw new Error(desglose.error);
        setDias(comparativa.dias);
        setFilas(desglose.filas);
      })
      .catch((e) => setError(e.message ?? "No se pudo calcular el desglose."))
      .finally(() => setLoading(false));
  }, [week]);

  const totalVentas = dias?.reduce((s, d) => s + d.en_ventas, 0) ?? 0;
  const totalOps = dias?.reduce((s, d) => s + d.en_operaciones, 0) ?? 0;
  const diferenciaTotal = Math.abs(totalVentas - totalOps);
  const hayQueRevisar = diferenciaTotal > UMBRAL_DIFERENCIA;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Desglose de pagos</h1>
      <p className="mt-1 text-sm text-ink-500">
        Comparativa Ventas vs Operaciones y el desglose General / Delivery / Mi Flotilla de una
        semana.
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <label className="text-xs font-medium text-ink-500">Elige cualquier día de la semana a revisar</label>
        <input
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
          className="mt-1 block rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {week && <p className="mt-2 text-sm text-ink-700">Semana: {week.label}</p>}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {week && !loading && dias && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">
              Comparativa de órdenes (Ventas vs Operaciones)
            </h2>
            <span className="text-xs text-ink-500">
              Solo completadas/devueltas, sin Mi Flotilla, solo KFC
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <p>
              <span className="text-ink-500">Ventas: </span>
              <span className="font-semibold text-ink-900">{int(totalVentas)}</span>
            </p>
            <p>
              <span className="text-ink-500">Operaciones: </span>
              <span className="font-semibold text-ink-900">{int(totalOps)}</span>
            </p>
            <p>
              <span className="text-ink-500">Diferencia: </span>
              <span
                className={`font-semibold ${hayQueRevisar ? "text-danger" : "text-success"}`}
              >
                {int(diferenciaTotal)}
              </span>
            </p>
          </div>

          {diferenciaTotal > 0 && (
            <p className={`mt-1 text-xs ${hayQueRevisar ? "text-danger" : "text-ink-500"}`}>
              {hayQueRevisar
                ? "Esta diferencia es mayor a lo normal — vale la pena revisar en qué día está."
                : "Diferencia dentro de lo normal, no hace falta investigar."}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4">Día</th>
                  <th className="py-2 pr-4 text-right">Ventas</th>
                  <th className="py-2 pr-4 text-right">Operaciones</th>
                  <th className="py-2 pr-4 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((d) => (
                  <tr key={d.dia} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-4 capitalize text-ink-900">{diaLabel(d.dia)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{int(d.en_ventas)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{int(d.en_operaciones)}</td>
                    <td
                      className={`py-2 pr-4 text-right font-medium ${
                        d.diferencia > UMBRAL_DIFERENCIA ? "text-danger" : "text-ink-500"
                      }`}
                    >
                      {int(d.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {week && !loading && filas && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Desglose de la semana</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4">Desglose</th>
                  <th className="py-2 pr-4 text-right">Monto efectivo</th>
                  <th className="py-2 pr-4 text-right"># Efectivo</th>
                  <th className="py-2 pr-4 text-right"># Tarjeta</th>
                  <th className="py-2 pr-4 text-right">Envíos efectivo</th>
                  <th className="py-2 pr-4 text-right">Envíos tarjeta</th>
                  <th className="py-2 pr-4 text-right">Total envío</th>
                  <th className="py-2 pr-4 text-right">Efectivo a depositar</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.categoria} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink-900">
                      {CATEGORIA_LABEL[f.categoria]}
                    </td>
                    <td className="py-2 pr-4 text-right text-ink-700">{money(f.monto_efectivo)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{int(f.n_efectivo)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{int(f.n_tarjeta)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{money(f.envios_efectivo)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{money(f.envios_tarjeta)}</td>
                    <td className="py-2 pr-4 text-right text-ink-700">{money(f.total_envio)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-ink-900">
                      {money(f.efectivo_depositar)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            "Delivery + Mi Flotilla" debe sumar lo mismo que "General" en cada columna — es una
            forma rápida de verificar que el desglose está cuadrado.
          </p>
        </div>
      )}

      {!week && (
        <p className="mt-6 text-sm text-ink-500">
          Elige un día de la semana que quieras revisar para ver la comparativa y el desglose.
        </p>
      )}
    </div>
  );
}
