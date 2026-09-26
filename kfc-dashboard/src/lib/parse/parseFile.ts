import * as XLSX from "xlsx";
import Papa from "papaparse";
import { ColumnDef, isFlotilla, normalizeHeader } from "./columns";

export interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

/** Lee un .xlsx o .csv (subido como Buffer) y regresa filas crudas, tal
 * cual las vería una tabla dinámica: primera fila = encabezados. */
export function readSpreadsheet(buffer: Buffer, filename: string): ParsedSheet {
  const isCsv = filename.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const text = buffer.toString("utf-8");
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const [headers, ...rows] = result.data as string[][];
    return { headers: headers ?? [], rows: rows ?? [] };
  }

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const [headers, ...rows] = data as unknown[][];
  return { headers: (headers ?? []).map((h) => String(h ?? "")), rows: rows ?? [] };
}

/** Excel a veces guarda fechas como número serial en vez de Date (sobre
 * todo si el archivo viene de un export intermedio). Esto las convierte. */
function excelSerialToDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const fractionalDay = serial - Math.floor(serial) + 0.0000001;
  let totalSeconds = Math.floor(86400 * fractionalDay);
  const seconds = totalSeconds % 60;
  totalSeconds -= seconds;
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = Math.floor(totalSeconds / 60) % 60;
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
    hours,
    minutes,
    seconds
  );
}

function parseDateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return excelSerialToDate(value).toISOString();

  const str = String(value).trim();
  // Formatos comunes: "16/09/2026 18:19:20" o "2026-09-16 18:19:20"
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
  if (dmy) {
    const [, d, m, y, h = "0", min = "0", s = "0"] = dmy;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s)
    ).toISOString();
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseBooleanValue(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value !== 0;
  const str = String(value).trim().toLowerCase();
  // En blanco significa "no marcado" (false), no "desconocido" — así viene
  // representado en el archivo (solo escriben algo cuando SÍ aplica).
  if (str === "") return false;
  if (["true", "si", "sí", "yes", "verdadero"].includes(str)) return true;
  if (["false", "no"].includes(str)) return false;
  // Algunos exports guardan 1/0 como "1.0"/"0.0" en vez de "1"/"0".
  const num = Number(str);
  if (!isNaN(num)) return num !== 0;
  return null;
}

function parseNumberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// Postgres no permite el byte nulo (\u0000) dentro de columnas text/jsonb
// — algunos exports grandes lo dejan colado en algún campo de texto
// libre y hace que TODO el lote falle. Lo quitamos junto con otros
// caracteres de control invisibles que tampoco deberían estar ahí.
function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Construye un mapa header-normalizado -> índice de columna, para poder
 * localizar cada campo sin importar el orden en que venga el archivo. */
function buildHeaderIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(normalizeHeader(h), i));
  return map;
}

export interface MappedRow {
  values: Record<string, unknown>;
}

/** Mapea cada fila cruda a las columnas canónicas definidas en columns.ts. */
export function mapRows(
  headers: string[],
  rows: unknown[][],
  columnDefs: ColumnDef[]
): MappedRow[] {
  const headerIndex = buildHeaderIndex(headers);

  const resolvedColumns = columnDefs.map((def) => {
    let colIndex = -1;
    for (const alias of def.aliases) {
      const idx = headerIndex.get(normalizeHeader(alias));
      if (idx !== undefined) {
        colIndex = idx;
        break;
      }
    }
    return { ...def, colIndex };
  });

  return rows
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => {
      const values: Record<string, unknown> = {};
      for (const col of resolvedColumns) {
        const cell = col.colIndex >= 0 ? row[col.colIndex] : null;
        switch (col.type) {
          case "number":
            values[col.key] = parseNumberValue(cell);
            break;
          case "boolean":
            values[col.key] = parseBooleanValue(cell);
            break;
          case "datetime":
            values[col.key] = parseDateValue(cell);
            break;
          default:
            values[col.key] =
              cell === null || cell === undefined ? null : sanitizeText(String(cell).trim());
        }
      }
      if (typeof values.restaurant === "string") {
        values.is_flotilla = isFlotilla(values.restaurant as string);
      }

      return { values };
    });
}

/** Faltantes de columnas esperadas — útil para avisar al usuario si subió
 * el archivo equivocado (p.ej. ventas en vez de operaciones). */
export function findMissingRequiredColumns(
  headers: string[],
  columnDefs: ColumnDef[],
  requiredKeys: readonly string[]
): string[] {
  const headerIndex = buildHeaderIndex(headers);
  const missing: string[] = [];
  for (const def of columnDefs) {
    if (!requiredKeys.includes(def.key)) continue;
    const found = def.aliases.some((a) => headerIndex.has(normalizeHeader(a)));
    if (!found) missing.push(def.aliases[0]);
  }
  return missing;
}
