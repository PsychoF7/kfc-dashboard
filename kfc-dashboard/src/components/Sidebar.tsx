"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";

// Íconos simples (trazo), para que el menú se entienda aun contraído.
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const AVAILABLE = [
  { href: "/dashboard", label: "Panel principal", icono: <Icono><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Icono> },
  { href: "/upload", label: "Cargar datos", icono: <Icono><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Icono> },
  { href: "/pagos", label: "Desglose de pagos", icono: <Icono><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></Icono> },
  { href: "/facturacion", label: "Facturación mensual", icono: <Icono><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h7" /></Icono> },
  { href: "/devoluciones", label: "Devoluciones y cancelaciones", icono: <Icono><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></Icono> },
  { href: "/tiempos", label: "Análisis de tiempos", icono: <Icono><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icono> },
  { href: "/flotilla", label: "Mi Flotilla", icono: <Icono><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17h5l3-8h3" /><path d="M10 6h3" /></Icono> },
  { href: "/rappi", label: "Rappi", icono: <Icono><path d="M3 9h18l-1.5 10a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></Icono> },
];

// Estas secciones son las fases siguientes del proyecto — se muestran
// para que el roadmap sea transparente, pero aún no están construidas.
const ROADMAP = [
  "Avisos y actualizaciones",
  "Bugs",
  "Solicitudes de desarrollo",
  "Altas y bajas",
  "Reembolsos",
  "Materiales",
];

const LLAVE = "kfc-menu-contraido";
const LLAVE_TEMA = "kfc-tema";

export default function Sidebar() {
  const pathname = usePathname();
  const [contraido, setContraido] = useState(false);
  const [oscuro, setOscuro] = useState(false);

  // Recordar la elección entre visitas (si el navegador no lo permite, no pasa nada)
  useEffect(() => {
    try {
      setContraido(localStorage.getItem(LLAVE) === "1");
    } catch {
      /* sin almacenamiento */
    }
    // El tema ya se aplicó antes de pintar (ver layout.tsx); aquí solo se lee
    setOscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternarTema() {
    const nuevo = !oscuro;
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem(LLAVE_TEMA, nuevo ? "oscuro" : "claro");
    } catch {
      /* sin almacenamiento */
    }
    setOscuro(nuevo);
  }

  function alternar() {
    setContraido((c) => {
      const nuevo = !c;
      try {
        localStorage.setItem(LLAVE, nuevo ? "1" : "0");
      } catch {
        /* sin almacenamiento */
      }
      return nuevo;
    });
  }

  return (
    <aside
      className={clsx(
        "flex h-screen flex-shrink-0 flex-col border-r border-ink-100 bg-white transition-[width] duration-200",
        contraido ? "w-[76px]" : "w-64"
      )}
    >
      <div className={clsx("flex items-center border-b border-ink-100 py-5", contraido ? "justify-center px-2" : "gap-3 px-5")}>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-peri text-sm font-bold text-white">
          KFC
        </div>
        {!contraido && (
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold text-ink-900">Panel Operativo</p>
            <p className="truncate text-xs text-ink-500">Ambit · Delivery</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {!contraido && (
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-300">Disponible</p>
        )}
        <ul className="space-y-1">
          {AVAILABLE.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={contraido ? item.label : undefined}
                  aria-label={item.label}
                  className={clsx(
                    "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                    contraido ? "justify-center px-0" : "gap-3 px-3",
                    active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50 hover:text-ink-900"
                  )}
                >
                  {item.icono}
                  {!contraido && <span className="leading-tight">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {!contraido && (
          <>
            <p className="mt-6 px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-300">Próximamente</p>
            <ul className="space-y-1">
              {ROADMAP.map((label) => (
                <li key={label}>
                  <span className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-sm text-ink-300">
                    {label}
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">pronto</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <div className="space-y-1 border-t border-ink-100 p-3">
        <button
          type="button"
          onClick={alternarTema}
          title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className={clsx(
            "flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900",
            contraido ? "justify-center" : "gap-3 px-3"
          )}
        >
          {oscuro ? (
            <Icono>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </Icono>
          ) : (
            <Icono>
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </Icono>
          )}
          {!contraido && <span>{oscuro ? "Modo claro" : "Modo oscuro"}</span>}
        </button>
        <button
          type="button"
          onClick={alternar}
          title={contraido ? "Expandir menú" : "Contraer menú"}
          aria-label={contraido ? "Expandir menú" : "Contraer menú"}
          className={clsx(
            "flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900",
            contraido ? "justify-center" : "gap-3 px-3"
          )}
        >
          <svg viewBox="0 0 24 24" className={clsx("h-5 w-5 flex-shrink-0 transition-transform", contraido && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m11 17-5-5 5-5" />
            <path d="m18 17-5-5 5-5" />
          </svg>
          {!contraido && <span>Contraer menú</span>}
        </button>
      </div>
    </aside>
  );
}
