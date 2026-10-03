"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface MultiSelectFilterProps {
  label: string;
  items: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Tiendas Mi Flotilla: su nombre termina en " MF"
const esFlotilla = (item: string) => /\sMF$/i.test(String(item ?? "").trim());

export default function MultiSelectFilter({ label, items: itemsCrudos, selected, onChange }: MultiSelectFilterProps) {
  // Por si la lista trae vacíos (por ejemplo, órdenes sin zona o sin repartidor)
  const items = useMemo(
    () => (itemsCrudos ?? []).filter((i): i is string => typeof i === "string" && i.trim() !== ""),
    [itemsCrudos]
  );
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

  // Si es una lista de tiendas KFC con Delivery y Mi Flotilla, se separan en dos grupos
  const delivery = useMemo(() => items.filter((i) => !esFlotilla(i)), [items]);
  const flotilla = useMemo(() => items.filter((i) => esFlotilla(i)), [items]);
  const conGrupos = items.some((i) => /kfc/i.test(i)) && delivery.length > 0 && flotilla.length > 0;

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

  const igual = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x));
  const buttonLabel =
    selected.length === 0
      ? "Todas"
      : conGrupos && igual(selected, delivery)
        ? `Solo Delivery (${delivery.length})`
        : conGrupos && igual(selected, flotilla)
          ? `Solo Mi Flotilla (${flotilla.length})`
          : selected.length === items.length
            ? `Todas (${items.length})`
            : selected.length === 1
              ? selected[0]
              : `${selected.length} seleccionadas`;

  const boton =
    "rounded-md px-2 py-1.5 text-left text-xs font-medium hover:bg-brand-50 disabled:cursor-default disabled:opacity-40";

  const filaItem = (item: string) => (
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
  );

  const encabezadoGrupo = (texto: string, n: number) => (
    <p className="mt-1 px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
      {texto} ({n})
    </p>
  );

  const filtradasDelivery = filteredItems.filter((i) => !esFlotilla(i));
  const filtradasFlotilla = filteredItems.filter((i) => esFlotilla(i));

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
          <div className="absolute z-20 mt-1 w-72 rounded-lg border border-ink-200 bg-white shadow-lg">
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

            {/* Accesos rápidos */}
            <div className="grid grid-cols-2 gap-1 border-b border-ink-100 p-1">
              {conGrupos && !search && (
                <>
                  <button type="button" onClick={() => onChange([...delivery])} className={`${boton} text-brand-600`}>
                    Solo Delivery ({delivery.length})
                  </button>
                  <button type="button" onClick={() => onChange([...flotilla])} className={`${boton} text-brand-600`}>
                    Solo Mi Flotilla ({flotilla.length})
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  const merged = new Set([...selected, ...filteredItems]);
                  onChange(Array.from(merged));
                }}
                className={`${boton} text-brand-600`}
              >
                {search ? `Seleccionar los ${filteredItems.length} filtrados` : "Seleccionar todas"}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className={`${boton} text-ink-500 hover:bg-ink-50`}
              >
                Limpiar{selected.length > 0 ? ` (${selected.length})` : ""}
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {filteredItems.length === 0 && <p className="px-2 py-2 text-xs text-ink-500">Sin resultados</p>}
              {conGrupos ? (
                <>
                  {filtradasDelivery.length > 0 && encabezadoGrupo("Delivery", filtradasDelivery.length)}
                  {filtradasDelivery.map(filaItem)}
                  {filtradasFlotilla.length > 0 && encabezadoGrupo("Mi Flotilla", filtradasFlotilla.length)}
                  {filtradasFlotilla.map(filaItem)}
                </>
              ) : (
                filteredItems.map(filaItem)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
