"use client";

import { useEffect, useMemo, useState } from "react";
import FiltersBar from "@/components/FiltersBar";
import KpiCard from "@/components/KpiCard";
import { DashboardFilters, EMPTY_FILTERS, FilterOptions, KpiSummary } from "@/lib/types";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
const int = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-MX"));
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)}%`);

// Espera un momento antes de aplicar cambios rápidos (arrastrar, teclear
// en la búsqueda, etc.) para no disparar una petición por cada pixel/tecla.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function DashboardPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 400);
  const [kpis, setKpis] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/filters", { cache: "no-store" })
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => setError("No se pudieron cargar las opciones de filtro."));
  }, []);

  const queryString = useMemo(() => {
    const f = debouncedFilters;
    const params = new URLSearchParams();
    if (f.date_from) params.set("date_from", f.date_from);
    if (f.date_to) params.set("date_to", f.date_to);
    f.ciudad.forEach((v) => params.append("ciudad", v));
    f.restaurant.forEach((v) => params.append("restaurant", v));
    f.zona.forEach((v) => params.append("zona", v));
    f.estatus.forEach((v) => params.append("estatus", v));
    f.repartido_por.forEach((v) => params.append("repartido_por", v));
    if (f.orden_planeada) params.set("orden_planeada", f.orden_planeada);
    if (f.price_min != null) params.set("price_min", String(f.price_min));
    if (f.price_max != null) params.set("price_max", String(f.price_max));
    return params.toString();
  }, [debouncedFilters]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/kpis?${queryString}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setKpis(data);
      })
      .catch((e) => setError(e.message ?? "No se pudieron cargar los KPIs."))
      .finally(() => setLoading(false));
  }, [queryString]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Panel principal</h1>
          <p className="text-sm text-ink-500">
            Resumen general de la operación de delivery — solo tiendas KFC.
          </p>
        </div>
      </div>

      <FiltersBar
        options={options}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Órdenes totales" value={loading ? "…" : int(kpis?.total_ordenes)} />
        <KpiCard
          label="Completadas"
          value={loading ? "…" : int(kpis?.completadas)}
          sublabel={pct(kpis?.pct_completadas)}
          accent="success"
        />
        <KpiCard
          label="Devueltas"
          value={loading ? "…" : int(kpis?.devueltas)}
          sublabel={pct(kpis?.pct_devueltas)}
          accent="warning"
        />
        <KpiCard
          label="Canceladas"
          value={loading ? "…" : int(kpis?.canceladas)}
          sublabel={pct(kpis?.pct_canceladas)}
          accent="danger"
        />
        <KpiCard label="Tiendas activas" value={loading ? "…" : int(kpis?.tiendas_activas)} />
        <KpiCard label="Órdenes en efectivo" value={loading ? "…" : int(kpis?.ordenes_efectivo)} />
        <KpiCard label="Órdenes con tarjeta" value={loading ? "…" : int(kpis?.ordenes_tarjeta)} />
        <KpiCard label="Precio promedio" value={loading ? "…" : money(kpis?.promedio_total)} />
        <KpiCard
          label="Venta total"
          value={loading ? "…" : money(kpis?.suma_total)}
          accent="success"
        />
      </div>
    </div>
  );
}
