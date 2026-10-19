"use client";

import { useEffect, useState } from "react";
import { DashboardFilters, FilterOptions } from "@/lib/types";
import MultiSelectFilter from "./MultiSelectFilter";
import PriceRangeInput from "./PriceRangeInput";

interface FiltersBarProps {
  options: FilterOptions | null;
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onClear: () => void;
}

// Solo avisa el cambio cuando la fecha está completa y es razonable; mientras se
// escribe el año (0002, 0020...) no se consulta nada.
function CampoFecha({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [texto, setTexto] = useState(value);
  useEffect(() => setTexto(value), [value]);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-500">{label}</label>
      <input
        type="date"
        min="2020-01-01"
        max="2100-12-31"
        className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        value={texto}
        onChange={(e) => {
          const v = e.target.value;
          setTexto(v);
          if (v === "" || /^20\d\d-\d\d-\d\d$/.test(v)) onChange(v);
        }}
      />
    </div>
  );
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
        <CampoFecha label="Desde" value={filters.date_from} onChange={(v) => set("date_from", v)} />
        <CampoFecha label="Hasta" value={filters.date_to} onChange={(v) => set("date_to", v)} />

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
