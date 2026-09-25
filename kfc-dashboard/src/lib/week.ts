export interface WeekRange {
  start: string; // yyyy-mm-dd (lunes)
  end: string; // yyyy-mm-dd (domingo)
  label: string; // "21 sep – 27 sep"
  weekNumber: number; // 38
  fullLabel: string; // "Semana 38 · 21 sep – 27 sep"
}

/** Dado cualquier día, regresa el lunes-domingo de esa semana, más el
 * número de semana (misma fórmula que usabas en tu Apps Script, para que
 * "Semana 38" siga significando lo mismo que siempre). */
export function getWeekRange(dateStr: string): WeekRange {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay() || 7; // domingo=0 -> 7
  const monday = new Date(date);
  if (day !== 1) monday.setDate(date.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const pastDays = Math.floor((monday.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);

  const label = `${fmt(monday)} – ${fmt(sunday)}`;

  return {
    start: toISO(monday),
    end: toISO(sunday),
    label,
    weekNumber,
    fullLabel: `Semana ${weekNumber} · ${label}`,
  };
}
