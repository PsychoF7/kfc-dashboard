"use client";

interface PriceRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

export default function PriceRangeSlider({ min, max, value, onChange }: PriceRangeSliderProps) {
  const [low, high] = value;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-ink-500">
        <span>${low.toLocaleString("es-MX")}</span>
        <span>${high.toLocaleString("es-MX")}</span>
      </div>
      <div className="range-slider mt-1">
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), high - 1);
            onChange([next, high]);
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), low + 1);
            onChange([low, next]);
          }}
        />
      </div>
    </div>
  );
}
