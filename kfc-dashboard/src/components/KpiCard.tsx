interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "success" | "warning" | "danger";
}

const ACCENTS: Record<string, string> = {
  default: "border-l-ink-300",
  success: "border-l-emerald-500",
  warning: "border-l-amber-500",
  danger: "border-l-rose-500",
};

export default function KpiCard({ label, value, sublabel, accent = "default" }: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border border-ink-100 border-l-4 bg-white p-4 shadow-card ${ACCENTS[accent]}`}
    >
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-ink-500">{sublabel}</p>}
    </div>
  );
}
