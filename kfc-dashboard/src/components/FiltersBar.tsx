"use client";

import { DashboardFilters, FilterOptions } from "@/lib/types";
import PriceRangeSlider from "./PriceRangeSlider";

interface FiltersBarProps {
  options: FilterOptions | null;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onClear: () => void;
  priceBounds: [number, number];
}

function Select({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-500">{label}</label>
      <select
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Todas</option>
        {items.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function FiltersBar({
  options,
  filters,
  onChange,
  onClear,
  priceBounds,
}: FiltersBarProps) {
  const set = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Filtros</h2>
        <button
          onClick={onClear}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Limpiar filtros
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Desde</label>
          <input
            type="date"
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={filters.date_from}
            onChange={(e) => set("date_from", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Hasta</label>
          <input
            type="date"
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={filters.date_to}
            onChange={(e) => set("date_to", e.target.value)}
          />
        </div>

        <Select
          label="Ciudad"
          value={filters.ciudad}
          items={options?.ciudades ?? []}
          onChange={(v) => set("ciudad", v)}
        />
        <Select
          label="Restaurant"
          value={filters.restaurant}
          items={options?.restaurantes ?? []}
          onChange={(v) => set("restaurant", v)}
        />
        <Select
          label="Zona"
          value={filters.zona}
          items={options?.zonas ?? []}
          onChange={(v) => set("zona", v)}
        />
        <Select
          label="Estatus de orden"
          value={filters.estatus}
          items={options?.estatus ?? []}
          onChange={(v) => set("estatus", v)}
        />
        <Select
          label="Repartido por"
          value={filters.repartido_por}
          items={options?.repartidores ?? []}
          onChange={(v) => set("repartido_por", v)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Orden planeada</label>
          <select
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={filters.orden_planeada}
            onChange={(e) => set("orden_planeada", e.target.value)}
          >
            <option value="">Todas</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>

        <div className="col-span-2 flex flex-col gap-1 md:col-span-2 lg:col-span-2">
          <label className="text-xs font-medium text-ink-500">Rango de precio</label>
          <PriceRangeSlider
            min={priceBounds[0]}
            max={priceBounds[1]}
            value={[filters.price_min, filters.price_max]}
            onChange={([lo, hi]) => onChange({ ...filters, price_min: lo, price_max: hi })}
          />
        </div>
      </div>
    </div>
  );
}
