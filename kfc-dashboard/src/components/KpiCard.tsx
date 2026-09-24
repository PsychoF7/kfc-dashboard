interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "success" | "warning" | "danger";
}

const TOP_BAR: Record<string, string> = {
  default: "bg-gradient-to-r from-brand-500 to-peri",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const SUBLABEL_COLOR: Record<string, string> = {
  default: "text-ink-500",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export default function KpiCard({ label, value, sublabel, accent = "default" }: KpiCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      <div className={`h-1 w-full ${TOP_BAR[accent]}`} />
      <div className="p-4">
        <p className="text-xs font-medium text-ink-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
        {sublabel && <p className={`mt-1 text-xs font-medium ${SUBLABEL_COLOR[accent]}`}>{sublabel}</p>}
      </div>
    </div>
  );
}
