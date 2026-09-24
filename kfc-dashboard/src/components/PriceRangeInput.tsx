"use client";

interface PriceRangeInputProps {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

export default function PriceRangeInput({ min, max, onChange }: PriceRangeInputProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
          $
        </span>
        <input
          type="number"
          min={0}
          placeholder="Mínimo"
          value={min ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), max)}
          className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-6 pr-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <span className="text-ink-300">–</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
          $
        </span>
        <input
          type="number"
          min={0}
          placeholder="Máximo"
          value={max ?? ""}
          onChange={(e) => onChange(min, e.target.value === "" ? null : Number(e.target.value))}
          className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-6 pr-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}
