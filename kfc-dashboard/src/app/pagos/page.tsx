"use client";

import { useEffect, useMemo, useState } from "react";
import { getWeekRange } from "@/lib/week";
import EmailComposer from "@/components/EmailComposer";

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

interface TiendaTrend {
  restaurant: string;
  monto_actual: number;
  monto_anterior: number;
  diferencia: number;
  pct_cambio: number | null;
  dejo_de_operar: boolean;
}

interface HistoricoFila {
  id: string;
  semana_inicio: string;
  semana_fin: string;
  categoria: string;
  efectivo_depositar: number;
  total_envio: number;
  estado: string;
}

interface TiendaInactiva {
  restaurant: string;
  ultima_orden: string | null;
  dias_sin_operar: number | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  general: "General",
  delivery: "Delivery",
  flotilla: "Mi Flotilla",
};

const UMBRAL_DIFERENCIA = 5;
const TOP_N = 5;
const UMBRAL_DIAS_INACTIVA = 10;

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
  const [tiendas, setTiendas] = useState<TiendaTrend[] | null>(null);
  const [inactivas, setInactivas] = useState<TiendaInactiva[] | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const [historico, setHistorico] = useState<HistoricoFila[] | null>(null);
  const [filtroSemana, setFiltroSemana] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  const week = useMemo(() => (anchorDate ? getWeekRange(anchorDate) : null), [anchorDate]);

  useEffect(() => {
    if (!week) return;
    setLoading(true);
    setError(null);
    setGuardadoOk(false);

    Promise.all([
      fetch(`/api/pagos/comparativa?week_start=${week.start}&week_end=${week.end}`, {
        cache: "no-store",
      }).then((r) => r.json()),
      fetch(`/api/pagos/desglose?week_start=${week.start}&week_end=${week.end}`, {
        cache: "no-store",
      }).then((r) => r.json()),
      fetch(`/api/pagos/tendencia?week_start=${week.start}&week_end=${week.end}`, {
        cache: "no-store",
      }).then((r) => r.json()),
      fetch(`/api/pagos/inactividad?as_of=${week.end}`, { cache: "no-store" }).then((r) =>
        r.json()
      ),
      fetch(`/api/pagos/notas?week_start=${week.start}`, { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ])
      .then(([comparativa, desglose, tendencia, inactividad, notasRes]) => {
        if (comparativa?.error) throw new Error(comparativa.error);
        if (desglose?.error) throw new Error(desglose.error);
        if (tendencia?.error) throw new Error(tendencia.error);
        if (inactividad?.error) throw new Error(inactividad.error);
        setDias(comparativa.dias);
        setFilas(desglose.filas);
        setTiendas(tendencia.tiendas);
        setInactivas(inactividad.tiendas);
        const notasMap: Record<string, string> = {};
        (notasRes.notas ?? []).forEach((n: { restaurant: string; nota: string | null }) => {
          notasMap[n.restaurant] = n.nota ?? "";
        });
        setNotas(notasMap);
      })
      .catch((e) => setError(e.message ?? "No se pudo calcular el desglose."))
      .finally(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    const url = filtroSemana
      ? `/api/pagos/historico?week_start=${filtroSemana}`
      : "/api/pagos/historico";
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((res) => setHistorico(res.filas ?? []))
      .catch(() => setHistorico([]));
  }, [filtroSemana, guardadoOk]);

  async function guardarHistorico() {
    if (!week || !filas) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/pagos/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: week.start, week_end: week.end, filas }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setGuardadoOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar en el histórico.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarNota(restaurant: string, nota: string) {
    if (!week) return;
    try {
      await fetch("/api/pagos/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: week.start, restaurant, nota }),
      });
    } catch {
      // silencioso: si falla, el valor se queda visible y se puede reintentar al perder foco de nuevo
    }
  }

  const totalVentas = dias?.reduce((s, d) => s + d.en_ventas, 0) ?? 0;
  const totalOps = dias?.reduce((s, d) => s + d.en_operaciones, 0) ?? 0;
  const diferenciaTotal = Math.abs(totalVentas - totalOps);
  const hayQueRevisar = diferenciaTotal > UMBRAL_DIFERENCIA;

  const totalActual = tiendas?.reduce((s, t) => s + t.monto_actual, 0) ?? 0;
  const totalAnterior = tiendas?.reduce((s, t) => s + t.monto_anterior, 0) ?? 0;
  const pctCambioTotal =
    totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null;
  const tiendasDetenidas = tiendas?.filter((t) => t.dejo_de_operar) ?? [];
  const tiendasSinOperacion = (inactivas ?? [])
    .filter((t) => (t.dias_sin_operar ?? 0) >= UMBRAL_DIAS_INACTIVA)
    .sort((a, b) => (b.dias_sin_operar ?? 0) - (a.dias_sin_operar ?? 0));
  const tiendasSubieron = (tiendas ?? [])
    .filter((t) => !t.dejo_de_operar && t.diferencia > 0)
    .sort((a, b) => b.diferencia - a.diferencia)
    .slice(0, TOP_N);
  const tiendasBajaron = (tiendas ?? [])
    .filter((t) => !t.dejo_de_operar && t.diferencia < 0)
    .sort((a, b) => a.diferencia - b.diferencia)
    .slice(0, TOP_N);

  const filaDelivery = filas?.find((f) => f.categoria === "delivery");
  const defaultSubject = week ? `Pago Semana ${week.label} KFC` : "";
  const defaultBody = week
    ? `Buen día Mariela.\n\nMe podrías apoyar, por favor, con la generación del pago correspondiente a la semana del ${week.label} de KFC; el monto a considerar es de ${money(
        filaDelivery?.efectivo_depositar
      )}\n\nTe agradezco mucho el apoyo.\nSaludos.`
    : "";

  const semanasDisponibles = Array.from(
    new Set((historico ?? []).map((h) => h.semana_inicio))
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Desglose de pagos</h1>
      <p className="mt-1 text-sm text-ink-500">
        Comparativa Ventas vs Operaciones, el desglose semanal, y su histórico.
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
        <label className="text-xs font-medium text-ink-500">
          Elige cualquier día de la semana a revisar
        </label>
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
              <span className={`font-semibold ${hayQueRevisar ? "text-danger" : "text-success"}`}>
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Desglose de la semana</h2>
            <div className="flex gap-2">
              <button
                onClick={guardarHistorico}
                disabled={guardando}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Guardar en histórico"}
              </button>
              <button
                onClick={() => setComposerOpen(true)}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Enviar correo
              </button>
            </div>
          </div>
          {guardadoOk && (
            <p className="mt-2 text-xs font-medium text-success">
              ✓ Semana guardada en el histórico.
            </p>
          )}
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
        </div>
      )}

      {week && !loading && tiendasSinOperacion.length > 0 && (
        <div className="mt-6 rounded-xl border border-danger bg-danger-bg p-5 shadow-card">
          <h2 className="text-sm font-semibold text-danger">
            ⚠ Tiendas sin operación reciente (10+ días)
          </h2>
          <p className="mt-1 text-xs text-ink-700">
            Estas tiendas no tienen ni una sola orden desde hace tiempo — se detectan aunque haya
            pasado más de una semana desde que dejaron de operar, así no se pierden entre
            revisiones.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-danger/30 text-left text-xs text-ink-600">
                  <th className="py-2 pr-4">Tienda</th>
                  <th className="py-2 pr-4">Última orden</th>
                  <th className="py-2 pr-4 text-right">Días sin operar</th>
                </tr>
              </thead>
              <tbody>
                {tiendasSinOperacion.map((t) => (
                  <tr key={t.restaurant} className="border-b border-danger/20 last:border-0">
                    <td className="py-2 pr-4 text-ink-900">{t.restaurant}</td>
                    <td className="py-2 pr-4 text-ink-700">{t.ultima_orden ?? "Nunca"}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-danger">
                      {t.dias_sin_operar ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {week && !loading && tiendas && (
        <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink-900">Comparativo vs. semana anterior</h2>

          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold text-ink-900">{money(totalActual)}</span>
            <span className="text-sm text-ink-500">vs {money(totalAnterior)} la semana pasada</span>
            {pctCambioTotal != null && (
              <span
                className={`text-sm font-semibold ${
                  pctCambioTotal >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {pctCambioTotal >= 0 ? "▲" : "▼"} {Math.abs(pctCambioTotal).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Tiendas que más subieron
              </h3>
              {tiendasSubieron.length === 0 ? (
                <p className="mt-2 text-xs text-ink-500">Ninguna tienda subió esta semana.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {tiendasSubieron.map((t) => (
                    <li key={t.restaurant} className="flex justify-between text-xs">
                      <span className="truncate pr-2 text-ink-700">{t.restaurant}</span>
                      <span className="flex-shrink-0 font-medium text-success">
                        +{money(t.diferencia)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Tiendas que más bajaron
              </h3>
              {tiendasBajaron.length === 0 ? (
                <p className="mt-2 text-xs text-ink-500">Ninguna tienda bajó esta semana.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {tiendasBajaron.map((t) => (
                    <li key={t.restaurant} className="flex justify-between text-xs">
                      <span className="truncate pr-2 text-ink-700">{t.restaurant}</span>
                      <span className="flex-shrink-0 font-medium text-danger">
                        {money(t.diferencia)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {tiendasDetenidas.length > 0 && (
            <div className="mt-6 rounded-lg border border-warning bg-warning-bg p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">
                Tiendas que dejaron de operar esta semana
              </h3>
              <p className="mt-1 text-xs text-ink-700">
                Tuvieron ventas la semana pasada y esta semana no registran nada. Agrega una nota
                si ya sabes el motivo (para revisar con KFC).
              </p>
              <div className="mt-3 space-y-2">
                {tiendasDetenidas.map((t) => (
                  <div key={t.restaurant} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                    <span className="text-sm text-ink-900 sm:w-72 sm:flex-shrink-0">
                      {t.restaurant}
                      <span className="ml-2 text-xs text-ink-500">
                        (tenía {money(t.monto_anterior)})
                      </span>
                    </span>
                    <input
                      type="text"
                      defaultValue={notas[t.restaurant] ?? ""}
                      onBlur={(e) => guardarNota(t.restaurant, e.target.value)}
                      placeholder="Nota / motivo (opcional)"
                      className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!week && (
        <p className="mt-6 text-sm text-ink-500">
          Elige un día de la semana que quieras revisar para ver la comparativa y el desglose.
        </p>
      )}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Histórico de semanas guardadas</h2>
          {semanasDisponibles.length > 0 && (
            <select
              value={filtroSemana}
              onChange={(e) => setFiltroSemana(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
            >
              <option value="">Todas las semanas</option>
              {semanasDisponibles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        {!historico || historico.length === 0 ? (
          <p className="mt-3 text-xs text-ink-500">
            Todavía no has guardado ninguna semana. Usa el botón "Guardar en histórico" de arriba.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="py-2 pr-4">Semana</th>
                  <th className="py-2 pr-4">Desglose</th>
                  <th className="py-2 pr-4 text-right">Total envío</th>
                  <th className="py-2 pr-4 text-right">Efectivo a depositar</th>
                  <th className="py-2 pr-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={h.id} className="border-b border-ink-100 last:border-0">
                    <td className="py-2 pr-4 text-ink-700">
                      {h.semana_inicio} → {h.semana_fin}
                    </td>
                    <td className="py-2 pr-4 font-medium text-ink-900">
                      {CATEGORIA_LABEL[h.categoria] ?? h.categoria}
                    </td>
                    <td className="py-2 pr-4 text-right text-ink-700">{money(h.total_envio)}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-ink-900">
                      {money(h.efectivo_depositar)}
                    </td>
                    <td className="py-2 pr-4 text-xs text-ink-500">{h.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmailComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultTo="mariela.miranda@ambit.la"
        defaultSubject={defaultSubject}
        defaultBody={defaultBody}
      />
    </div>
  );
}
