"use client";

import { useState } from "react";
import clsx from "clsx";
import MultiSelectFilter from "@/components/MultiSelectFilter";
import type { FilterOptions } from "@/lib/types";
import {
  ALCANCES_INCIDENCIA,
  AlcanceIncidencia,
  ClimaDia,
  Incidencia,
  RELEVANCIA_CLIMA,
  UMBRALES_CLIMA,
  climaPorDia,
  impactoClima,
  detalleClima,
  nombreCiudad,
  TIPOS_INCIDENCIA,
  TipoIncidencia,
  alcanceIncidencia,
  fechasIncidencia,
} from "@/lib/devoluciones";

type Borrador = Omit<Incidencia, "id"> & { id?: string };

const VACIA: Borrador = {
  tipo: "clima",
  fecha_inicio: "",
  fecha_fin: "",
  alcance: "general",
  alcance_valores: [],
  descripcion: "",
};

const campo =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Tarjeta de "Incidencias y contexto": lista las del periodo y permite
 * agregar, editar o borrar (mal clima, tráfico, intermitencias, bugs...). */
function fechaLarga(iso: string) {
  const t = new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const DIAS_INICIALES = 7;

/** Nota opcional para un día de clima (se guarda al salir del campo). */
function NotaClima({ c, onGuardar }: { c: ClimaDia; onGuardar: (nota: string) => Promise<void> }) {
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        defaultValue={c.nota ?? ""}
        placeholder="Nota opcional (ej. cerraron 3 tiendas)"
        onBlur={async (e) => {
          if (e.target.value === (c.nota ?? "")) return;
          try {
            await onGuardar(e.target.value);
            setEstado("ok");
          } catch {
            setEstado("error");
          }
        }}
        className="w-full min-w-[200px] rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <span className="w-3 text-xs" aria-live="polite">
        {estado === "ok" && <span className="text-success">✓</span>}
        {estado === "error" && <span className="text-danger" title="No se guardó, intenta de nuevo">!</span>}
      </span>
    </div>
  );
}

export default function Incidencias({
  incidencias,
  clima,
  opciones,
  onCambio,
  onClimaCambio,
}: {
  incidencias: Incidencia[];
  clima: ClimaDia[];
  opciones: FilterOptions | null;
  onCambio: () => void;
  onClimaCambio: () => void;
}) {
  const [verDescartados, setVerDescartados] = useState(false);
  const [verTodosDias, setVerTodosDias] = useState(false);
  const [climaAbierto, setClimaAbierto] = useState(false);

  async function actualizarClima(c: ClimaDia, cambios: { nota?: string; descartado?: boolean }) {
    const res = await fetch("/api/devoluciones/clima", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciudad: c.ciudad, fecha: c.fecha, ...cambios }),
    });
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error ?? "No se guardó");
    if (cambios.descartado !== undefined) onClimaCambio();
  }

  const descartados = clima.filter((c) => c.descartado);
  // Lo más reciente primero
  const diasClima = climaPorDia(clima).reverse();
  const diasVisibles = verTodosDias ? diasClima : diasClima.slice(0, DIAS_INICIALES);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const valoresAlcance = (a: AlcanceIncidencia) =>
    a === "zona" ? opciones?.zonas ?? [] : a === "ciudad" ? opciones?.ciudades ?? [] : opciones?.restaurantes ?? [];

  async function guardar() {
    if (!borrador) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/devoluciones/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...borrador, fecha_fin: borrador.fecha_fin || borrador.fecha_inicio }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "No se pudo guardar.");
      setBorrador(null);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/devoluciones/incidencias?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error ?? "No se pudo borrar.");
      setBorrando(null);
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar.");
    }
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Incidencias y contexto</h2>
          <p className="mt-1 text-xs text-ink-500">
            Lo que explica por qué subieron las devoluciones o cancelaciones: mal clima, tráfico,
            intermitencias, bugs… Se marcan en la gráfica y salen en el resumen y el Excel de la semana.
          </p>
        </div>
        {!borrador && (
          <button
            onClick={() => {
              setError(null);
              setBorrador({ ...VACIA });
            }}
            className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            + Agregar incidencia
          </button>
        )}
      </div>

      {borrador && (
        <div className="mt-4 rounded-lg border border-brand-500 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-ink-900">
            {borrador.id ? "Editar incidencia" : "Nueva incidencia"}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-xs font-medium text-ink-500">Tipo</label>
              <select
                className={campo}
                value={borrador.tipo}
                onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value as TipoIncidencia })}
              >
                {(Object.keys(TIPOS_INCIDENCIA) as TipoIncidencia[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_INCIDENCIA[t].icono} {TIPOS_INCIDENCIA[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">Desde</label>
              <input
                type="date"
                className={campo}
                value={borrador.fecha_inicio}
                onChange={(e) => setBorrador({ ...borrador, fecha_inicio: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">Hasta (si fue un solo día, déjalo vacío)</label>
              <input
                type="date"
                className={campo}
                value={borrador.fecha_fin}
                min={borrador.fecha_inicio || undefined}
                onChange={(e) => setBorrador({ ...borrador, fecha_fin: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-500">¿A quién afectó?</label>
              <select
                className={campo}
                value={borrador.alcance}
                onChange={(e) =>
                  setBorrador({ ...borrador, alcance: e.target.value as AlcanceIncidencia, alcance_valores: [] })
                }
              >
                {(Object.keys(ALCANCES_INCIDENCIA) as AlcanceIncidencia[]).map((a) => (
                  <option key={a} value={a}>
                    {ALCANCES_INCIDENCIA[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              {borrador.alcance !== "general" && (
                <MultiSelectFilter
                  label={
                    borrador.alcance === "zona"
                      ? "Zonas afectadas"
                      : borrador.alcance === "ciudad"
                        ? "Ciudades afectadas"
                        : "Tiendas afectadas"
                  }
                  items={valoresAlcance(borrador.alcance)}
                  selected={borrador.alcance_valores}
                  onChange={(v) => setBorrador({ ...borrador, alcance_valores: v })}
                />
              )}
            </div>
            <div className="flex flex-col gap-1 md:col-span-4">
              <label className="text-xs font-medium text-ink-500">Descripción</label>
              <textarea
                rows={2}
                className={campo}
                placeholder="Ej. Intermitencias en la inyección de órdenes por parte de KFC entre 7 y 10 pm."
                value={borrador.descripcion}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                setBorrador(null);
                setError(null);
              }}
              className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {!borrador && error && <p className="mt-3 text-xs font-medium text-danger">{error}</p>}

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-500">Registradas por ti</h3>
      {incidencias.length === 0 ? (
        <p className="mt-2 text-xs text-ink-500">No hay incidencias registradas en este periodo.</p>
      ) : (
        <ul className="mt-4 divide-y divide-ink-100">
          {incidencias.map((i) => {
            const t = TIPOS_INCIDENCIA[i.tipo] ?? TIPOS_INCIDENCIA.otro;
            return (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 text-lg leading-none" aria-hidden>
                    {t.icono}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-ink-500"> · {fechasIncidencia(i)} · {alcanceIncidencia(i)}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">{i.descripcion}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 text-xs">
                  {borrando === i.id ? (
                    <>
                      <span className="text-ink-500">¿Borrar?</span>
                      <button onClick={() => borrar(i.id)} className="font-semibold text-danger hover:underline">
                        Sí, borrar
                      </button>
                      <button onClick={() => setBorrando(null)} className="font-medium text-ink-500 hover:underline">
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setError(null);
                          setBorrador({ ...i, fecha_fin: i.fecha_fin === i.fecha_inicio ? "" : i.fecha_fin });
                        }}
                        className={clsx("font-medium text-brand-600 hover:underline")}
                      >
                        Editar
                      </button>
                      <button onClick={() => setBorrando(i.id)} className="font-medium text-ink-500 hover:underline">
                        Borrar
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Clima detectado automáticamente (desplegable) */}
      <div className="mt-6 border-t border-ink-100 pt-4">
        <button
          type="button"
          onClick={() => setClimaAbierto(!climaAbierto)}
          aria-expanded={climaAbierto}
          className="flex w-full items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={clsx(
                "inline-block text-[10px] text-ink-500 transition-transform motion-reduce:transition-none",
                climaAbierto && "rotate-90"
              )}
            >
              ▶
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              🌧️ Mal clima detectado automáticamente
            </span>
          </span>
          <span className="text-xs text-ink-500">
            {diasClima.length === 0
              ? "Sin días relevantes"
              : `${diasClima.length} ${diasClima.length === 1 ? "día" : "días"} · ${
                  new Set(clima.filter((c) => !c.descartado).map((c) => c.ciudad)).size
                } ${new Set(clima.filter((c) => !c.descartado).map((c) => c.ciudad)).size === 1 ? "ciudad" : "ciudades"}`}
            <span className="ml-2 font-medium text-brand-600">{climaAbierto ? "Ocultar" : "Ver"}</span>
          </span>
        </button>
        {climaAbierto && (
        <>
        <p className="mt-2 text-xs text-ink-500">
          Se revisa solo el clima de cada ciudad por día. Cuenta como mal clima: lluvia de{" "}
          {UMBRALES_CLIMA.lluvia_mm} mm o más, tormenta eléctrica con {UMBRALES_CLIMA.tormenta_lluvia_mm} mm o más,
          o ráfagas de {UMBRALES_CLIMA.rafaga_kmh} km/h o más. Solo se muestra cuando la ciudad pesa en la
          operación ese día: al menos {RELEVANCIA_CLIMA.min_ordenes} órdenes y al menos{" "}
          {RELEVANCIA_CLIMA.min_pct_dia * 100}% de las órdenes KFC del día. La nota es opcional; si no afectó,
          márcalo y ya no sale en el resumen ni en el Excel.
        </p>
        {diasClima.length === 0 ? (
          <p className="mt-3 text-xs text-ink-500">No se detectó mal clima en este periodo.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {diasVisibles.map((g) => (
              <div key={g.fecha}>
                <p className="text-sm font-semibold text-ink-900">{fechaLarga(g.fecha)}</p>
                <ul className="mt-1 divide-y divide-ink-100">
                  {g.ciudades.map((c) => (
                    <li key={c.ciudad} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <p className="text-sm text-ink-700">
                          <span className="font-medium text-ink-900">{nombreCiudad(c.ciudad)}</span> · {detalleClima(c)}
                        </p>
                        {impactoClima(c) && <p className="text-xs text-ink-500">{impactoClima(c)}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <NotaClima c={c} onGuardar={(nota) => actualizarClima(c, { nota })} />
                        <button
                          onClick={() => actualizarClima(c, { descartado: true }).catch(() => undefined)}
                          className="whitespace-nowrap text-xs font-medium text-ink-500 hover:underline"
                        >
                          No afectó
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {diasClima.length > DIAS_INICIALES && (
              <button
                onClick={() => setVerTodosDias(!verTodosDias)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {verTodosDias ? "Mostrar solo los más recientes" : `Ver los ${diasClima.length} días con mal clima`}
              </button>
            )}
          </div>
        )}
        {descartados.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setVerDescartados(!verDescartados)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {verDescartados ? "Ocultar" : "Ver"} los {descartados.length} marcados como &quot;no afectó&quot;
            </button>
            {verDescartados && (
              <ul className="mt-2 space-y-1.5">
                {descartados.map((c) => (
                  <li key={`${c.ciudad}-${c.fecha}`} className="flex items-center justify-between gap-2 text-xs text-ink-500">
                    <span>
                      {fechaLarga(c.fecha)} · {nombreCiudad(c.ciudad)} · {detalleClima(c)}
                    </span>
                    <button
                      onClick={() => actualizarClima(c, { descartado: false }).catch(() => undefined)}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Sí afectó
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
