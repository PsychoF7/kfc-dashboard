"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";

export interface Aviso {
  id: string;
  titulo: string;
  mensaje: string;
  nivel: "info" | "importante";
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

interface Ctx {
  avisos: Aviso[]; // solo los activos
  datosHasta: string | null;
  pendientes: number; // activos que esta persona aún no cierra
  abrirPanel: () => void;
  recargar: () => void;
}

const AvisosCtx = createContext<Ctx>({ avisos: [], datosHasta: null, pendientes: 0, abrirPanel: () => {}, recargar: () => {} });
export const useAvisos = () => useContext(AvisosCtx);

const LLAVE = "kfc-avisos-vistos";

function leerVistos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LLAVE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function fechaCorta(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${meses[m - 1]} ${a}`;
}

function Tarjeta({ a }: { a: Aviso }) {
  return (
    <div className={clsx("rounded-xl border p-4", a.nivel === "importante" ? "border-warning/40 bg-warning-bg" : "border-ink-100 bg-ink-50")}>
      <p className="text-sm font-semibold text-ink-900">{a.titulo}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{a.mensaje}</p>
    </div>
  );
}

export function AvisosProvider({ activo, children }: { activo: boolean; children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [datosHasta, setDatosHasta] = useState<string | null>(null);
  const [vistos, setVistos] = useState<Record<string, string>>({});
  const [listo, setListo] = useState(false);
  const [modal, setModal] = useState(false);
  const [panel, setPanel] = useState(false);

  const recargar = useCallback(() => {
    fetch("/api/avisos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAvisos((d.avisos as Aviso[]).filter((a) => a.activo));
        setDatosHasta(d.datos_hasta ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activo) return;
    setVistos(leerVistos());
    setListo(true);
    recargar();
    const t = setInterval(recargar, 60_000);
    return () => clearInterval(t);
  }, [activo, recargar]);

  const nuevos = useMemo(() => avisos.filter((a) => vistos[a.id] !== a.actualizado_en), [avisos, vistos]);

  // El aviso se abre solo cuando hay alguno que la persona aún no cierra.
  useEffect(() => {
    if (listo && nuevos.length > 0) setModal(true);
  }, [listo, nuevos.length]);

  function cerrar() {
    const mapa = { ...vistos };
    avisos.forEach((a) => (mapa[a.id] = a.actualizado_en));
    setVistos(mapa);
    try {
      localStorage.setItem(LLAVE, JSON.stringify(mapa));
    } catch {}
    setModal(false);
  }

  const valor: Ctx = {
    avisos,
    datosHasta,
    pendientes: nuevos.length,
    abrirPanel: () => setPanel(true),
    recargar,
  };

  const mostrados = modal ? nuevos : panel ? avisos : [];

  return (
    <AvisosCtx.Provider value={valor}>
      {children}
      {activo && (modal || panel) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Avisos">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-ink-900">Avisos</h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">{mostrados.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {mostrados.length === 0 ? (
                <p className="text-sm text-ink-500">No hay avisos por ahora.</p>
              ) : (
                mostrados.map((a) => <Tarjeta key={a.id} a={a} />)
              )}
            </div>
            <button
              type="button"
              onClick={() => (modal ? cerrar() : setPanel(false))}
              className="mt-5 w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </AvisosCtx.Provider>
  );
}
