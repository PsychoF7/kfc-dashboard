"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface MultiSelectFilterProps {
  label: string;
  items: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function MultiSelectFilter({ label, items, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, search]);

  function toggleItem(item: string) {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }

  const buttonLabel =
    selected.length === 0
      ? "Todas"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} seleccionadas`;

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label className="text-xs font-medium text-ink-500">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <span className="truncate">{buttonLabel}</span>
          <svg
            className={`ml-2 h-4 w-4 flex-shrink-0 text-ink-500 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-64 rounded-lg border border-ink-200 bg-white shadow-lg">
            <div className="border-b border-ink-100 p-2">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-md border border-ink-200 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              <div className="mb-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const merged = new Set([...selected, ...filteredItems]);
                    onChange(Array.from(merged));
                  }}
                  className="flex-1 rounded-md px-2 py-1.5 text-left text-xs font-medium text-brand-600 hover:bg-brand-50"
                >
                  {search ? `Seleccionar los ${filteredItems.length} filtrados` : "Seleccionar todas"}
                </button>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="flex-1 rounded-md px-2 py-1.5 text-left text-xs font-medium text-ink-500 hover:bg-ink-50"
                  >
                    Limpiar ({selected.length})
                  </button>
                )}
              </div>
              {filteredItems.length === 0 && (
                <p className="px-2 py-2 text-xs text-ink-500">Sin resultados</p>
              )}
              {filteredItems.map((item) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(item)}
                    onChange={() => toggleItem(item)}
                    className="h-4 w-4 flex-shrink-0 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="truncate">{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
