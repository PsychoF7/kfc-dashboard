"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const AVAILABLE = [
  { href: "/dashboard", label: "Panel principal" },
  { href: "/upload", label: "Cargar datos" },
  { href: "/pagos", label: "Desglose de pagos" },
  { href: "/facturacion", label: "Facturación mensual" },
];

// Estas secciones son las fases siguientes del proyecto — se muestran
// para que el roadmap sea transparente, pero aún no están construidas.
const ROADMAP = [
  "Devoluciones y cancelaciones",
  "Análisis de tiempos",
  "Avisos y actualizaciones",
  "Bugs",
  "Solicitudes de desarrollo",
  "Altas y bajas",
  "Reembolsos",
  "Materiales",
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-ink-100 bg-white">
      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-peri text-sm font-bold text-white">
          KFC
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">Panel Operativo</p>
          <p className="text-xs text-ink-500">Ambit · Delivery</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-300">
          Disponible
        </p>
        <ul className="space-y-1">
          {AVAILABLE.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-700 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-300">
          Próximamente
        </p>
        <ul className="space-y-1">
          {ROADMAP.map((label) => (
            <li key={label}>
              <span className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-300">
                {label}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  pronto
                </span>
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
