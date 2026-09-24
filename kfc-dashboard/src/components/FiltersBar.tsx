"use client";

import { DashboardFilters, FilterOptions } from "@/lib/types";
import MultiSelectFilter from "./MultiSelectFilter";
import PriceRangeInput from "./PriceRangeInput";

interface FiltersBarProps {
  options: FilterOptions | null;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onClear: () => void;
}

export default function FiltersBar({ options, filters, onChange, onClear }: FiltersBarProps) {
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

        <MultiSelectFilter
          label="Ciudad"
          items={options?.ciudades ?? []}
          selected={filters.ciudad}
          onChange={(v) => set("ciudad", v)}
        />
        <MultiSelectFilter
          label="Restaurant"
          items={options?.restaurantes ?? []}
          selected={filters.restaurant}
          onChange={(v) => set("restaurant", v)}
        />
        <MultiSelectFilter
          label="Zona"
          items={options?.zonas ?? []}
          selected={filters.zona}
          onChange={(v) => set("zona", v)}
        />
        <MultiSelectFilter
          label="Estatus de orden"
          items={options?.estatus ?? []}
          selected={filters.estatus}
          onChange={(v) => set("estatus", v)}
        />
        <MultiSelectFilter
          label="Repartido por"
          items={options?.repartidores ?? []}
          selected={filters.repartido_por}
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

        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs font-medium text-ink-500">Rango de precio</label>
          <PriceRangeInput
            min={filters.price_min}
            max={filters.price_max}
            onChange={(lo, hi) => onChange({ ...filters, price_min: lo, price_max: hi })}
          />
        </div>
      </div>
    </div>
  );
}
