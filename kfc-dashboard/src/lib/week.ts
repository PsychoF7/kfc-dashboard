export interface WeekRange {
  start: string; // yyyy-mm-dd (lunes)
  end: string; // yyyy-mm-dd (domingo)
  label: string; // "21 sep – 27 sep"
}

/** Dado cualquier día, regresa el lunes-domingo de esa semana. */
export function getWeekRange(dateStr: string): WeekRange {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay() || 7; // domingo=0 -> 7
  const monday = new Date(date);
  if (day !== 1) monday.setDate(date.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return {
    start: toISO(monday),
    end: toISO(sunday),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  };
}
