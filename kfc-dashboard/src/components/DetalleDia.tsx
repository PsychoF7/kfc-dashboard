"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

// Panel con el detalle de UN día de una gráfica "por día", comparado contra
// el mismo día de la semana anterior (un martes contra el martes previo).
// Lo usan Rappi, Devoluciones, Análisis de tiempos y Mi Flotilla.

export type FormatoDia = "n" | "pct" | "min" | "money";

export interface FilaDia {
  etiqueta: string;
  actual: number | null | undefined;
  /** Valor del mismo día de la semana anterior (si existe en los datos). */
  previo?: number | null;
  formato: FormatoDia;
  /** Qué dirección es "mejor": "baja" (devoluciones, tiempos), "sube" (entregadas, % en 45) o null (solo informativo). */
  mejor?: "sube" | "baja" | null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Suma días a una fecha "yyyy-mm-dd" sin que la zona horaria la mueva. */
export function isoMasDias(iso: string, dias: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** El registro de 7 días antes (o undefined si el periodo elegido no lo incluye). */
export function buscarPrevio<T extends { dia: string }>(datos: T[], dia: string): T | undefined {
  const objetivo = isoMasDias(dia, -7);
  return datos.find((x) => x.dia.slice(0, 10) === objetivo);
}

function nombreDia(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fechaCorta(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

function valor(n: number | null | undefined, f: FormatoDia) {
  if (n == null) return "—";
  if (f === "pct") return `${(n * 100).toFixed(1)}%`;
  if (f === "min") return `${n.toFixed(1)} min`;
  if (f === "money") return `$${Math.round(n).toLocaleString("es-MX")}`;
  return Math.round(n).toLocaleString("es-MX");
}

function Cambio({ fila }: { fila: FilaDia }) {
  const { actual, previo, formato, mejor } = fila;
  if (actual == null || previo == null) return <span className="text-ink-300">sin dato</span>;
  const dif = actual - previo;
  const igual = formato === "pct" ? Math.abs(dif) < 0.0005 : formato === "min" ? Math.abs(dif) < 0.05 : Math.abs(dif) < 0.5;
  if (igual) return <span className="text-ink-500">igual</span>;
  const signo = dif > 0 ? "+" : "−";
  const abs = Math.abs(dif);
  const texto =
    formato === "pct"
      ? `${signo}${(abs * 100).toFixed(1)} pts`
      : formato === "min"
        ? `${signo}${abs.toFixed(1)} min`
        : formato === "money"
          ? `${signo}$${Math.round(abs).toLocaleString("es-MX")}`
          : `${signo}${Math.round(abs).toLocaleString("es-MX")}${previo !== 0 ? ` (${signo}${((abs / Math.abs(previo)) * 100).toFixed(0)}%)` : ""}`;
  const bueno = mejor == null ? null : mejor === "sube" ? dif > 0 : dif < 0;
  return (
    <span className={clsx(bueno == null ? "text-ink-500" : bueno ? "text-success" : "text-danger")}>
      {dif > 0 ? "▲" : "▼"} {texto}
    </span>
  );
}

export function DetalleDiaVacio() {
  return (
    <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
      Pasa el mouse sobre un día para ver qué pasó; da clic para dejarlo fijo. Se compara contra el mismo día de la semana anterior.
    </p>
  );
}

export default function DetalleDia({
  dia,
  filas,
  hayPrevio,
  extra,
}: {
  dia: string;
  filas: FilaDia[];
  hayPrevio: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50 p-3">
      <p className="text-sm font-semibold text-ink-900">{nombreDia(dia)}</p>
      <p className="text-xs text-ink-500">
        {hayPrevio
          ? `Comparado con el mismo día de la semana anterior (${fechaCorta(isoMasDias(dia, -7))}).`
          : "Sin dato de la semana anterior: el periodo que elegiste no la incluye. Amplía las fechas para compararla."}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {filas.map((f) => (
          <div key={f.etiqueta} className="flex items-baseline justify-between gap-3 border-b border-ink-100 py-1.5 text-xs last:border-0">
            <dt className="text-ink-500">{f.etiqueta}</dt>
            <dd className="text-right">
              <span className="font-semibold text-ink-900">{valor(f.actual, f.formato)}</span>
              {hayPrevio && (
                <span className="ml-2">
                  <Cambio fila={f} />
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {extra}
    </div>
  );
}
