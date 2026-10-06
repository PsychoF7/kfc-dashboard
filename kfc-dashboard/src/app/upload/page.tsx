"use client";

import { useState } from "react";
import clsx from "clsx";
import Papa from "papaparse";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizeHeader } from "@/lib/parse/columns";

type Tipo = "ops" | "ventas" | "tiempos" | "rappi";

interface UploadResult {
  ok?: boolean;
  error?: string;
  rows_processed?: number;
  date_range?: string | null;
  filename?: string;
}

// Los CSV se mandan por partes: el navegador lee el archivo y lo envía en
// lotes chicos, así se pueden cargar archivos mensuales muy grandes sin que
// el servidor se pase de su tiempo límite.
const FILAS_POR_LOTE = 2000;
const LOTES_EN_PARALELO = 3;
const COLUMNAS_TIENDA = ["restaurant", "restaurante", "nombre del restaurante", "picking point name"];

async function enviarLote(cuerpo: Record<string, unknown>, intentos = 3) {
  let ultimoError = "No se pudo guardar una parte del archivo.";
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch("/api/upload/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) return data;
      ultimoError = data?.error ?? `El servidor respondió ${res.status}.`;
      if (res.status === 400) break; // error del archivo: no tiene caso reintentar
    } catch {
      ultimoError = "Se perdió la conexión al guardar una parte del archivo.";
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(ultimoError);
}

const dos = (n: number) => String(n).padStart(2, "0");
/** Fecha de Excel -> "2026-09-21 18:19:20" (la misma hora que se ve en el archivo). */
function fechaATexto(d: Date) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** Excel (.xlsx): se lee en el navegador; las fechas se mandan como texto. */
async function leerExcel(file: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true, defval: null });
  return (filas as unknown[][]).map((fila) => fila.map((c) => (c instanceof Date ? fechaATexto(c) : c)));
}

function leerCsv(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as string[][]),
      error: (e) => reject(e),
    });
  });
}

const BUCKET = "raw-uploads";

function sanitizeFilename(name: string) {
  // Supabase Storage no acepta ciertos caracteres/espacios de forma
  // confiable en las rutas — los reemplazamos para evitar errores raros.
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function UploadCard({ tipo, title, description }: { tipo: Tipo; title: string; description: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing" | "reading">("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);

  /** CSV o Excel: se lee en el navegador y se manda por partes (sirve para archivos grandes). */
  async function cargarPorPartes(f: File) {
    setStage("reading");
    // Dejamos que la pantalla muestre "Leyendo archivo…" antes de empezar a leer
    await new Promise((r) => setTimeout(r, 50));
    const filas = f.name.toLowerCase().endsWith(".csv") ? await leerCsv(f) : await leerExcel(f);
    const [encabezados, ...datos] = filas;
    const headers = (encabezados ?? []).map((h) => String(h ?? ""));
    if (!headers || datos.length === 0) throw new Error("El archivo está vacío o no se pudo leer.");

    // Solo mandamos las filas de KFC (el servidor igual lo vuelve a revisar)
    const idxTienda = headers.findIndex((h) => COLUMNAS_TIENDA.includes(normalizeHeader(h)));
    const kfc = idxTienda >= 0 ? datos.filter((r) => /kfc/i.test(String(r[idxTienda] ?? ""))) : datos;

    const lotes: unknown[][][] = [];
    for (let i = 0; i < kfc.length; i += FILAS_POR_LOTE) lotes.push(kfc.slice(i, i + FILAS_POR_LOTE));
    if (lotes.length === 0) throw new Error("El archivo no tiene ninguna fila de KFC.");

    setStage("processing");
    setProgreso({ hechas: 0, total: kfc.length });
    let hechas = 0;
    let guardadas = 0;
    let fechaMin: string | null = null;
    let fechaMax: string | null = null;
    const anotar = (d: { guardadas: number; fecha_min: string | null; fecha_max: string | null }, n: number) => {
      guardadas += d.guardadas;
      if (d.fecha_min && (!fechaMin || d.fecha_min < fechaMin)) fechaMin = d.fecha_min;
      if (d.fecha_max && (!fechaMax || d.fecha_max > fechaMax)) fechaMax = d.fecha_max;
      hechas += n;
      setProgreso({ hechas, total: kfc.length });
    };

    // El primer lote abre el registro de la carga y revisa las columnas
    const base = { tipo, filename: f.name, headers };
    const primero = await enviarLote({ ...base, rows: lotes[0] });
    const uploadId = primero.upload_id as string;
    anotar(primero, lotes[0].length);

    // El resto, de 3 en 3
    let siguiente = 1;
    async function trabajador() {
      while (siguiente < lotes.length) {
        const i = siguiente++;
        const d = await enviarLote({ ...base, rows: lotes[i], upload_id: uploadId });
        anotar(d, lotes[i].length);
      }
    }
    await Promise.all(Array.from({ length: LOTES_EN_PARALELO }, trabajador));

    await enviarLote({ ...base, upload_id: uploadId, final: { row_count: guardadas, date_start: fechaMin, date_end: fechaMax } });
    return {
      ok: true,
      rows_processed: guardadas,
      date_range: fechaMin && fechaMax ? `${fechaMin} → ${fechaMax}` : null,
    } as UploadResult;
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setProgreso(null);

    if (/\.(csv|xlsx)$/i.test(file.name)) {
      try {
        setResult(await cargarPorPartes(file));
        setFile(null);
      } catch (e) {
        setResult({ error: e instanceof Error ? e.message : "No se pudo cargar el archivo." });
      } finally {
        setLoading(false);
        setStage("idle");
        setProgreso(null);
      }
      return;
    }

    const path = `${tipo}/${Date.now()}-${sanitizeFilename(file.name)}`;

    try {
      // 1) Subir el archivo DIRECTO a Supabase Storage desde el navegador.
      //    Esto evita el límite de 4.5MB que tiene Vercel para el cuerpo
      //    de las peticiones a funciones de servidor.
      setStage("uploading");
      const { error: uploadError } = await supabaseBrowser.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false });

      if (uploadError) {
        setResult({ error: `No se pudo subir el archivo a Storage: ${uploadError.message}` });
        return;
      }

      // 2) Avisarle al servidor que procese ese archivo (mandamos solo la
      //    ruta, un mensaje muy chico, no el archivo completo).
      setStage("processing");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, tipo, filename: file.name }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) setFile(null);
    } catch (e) {
      setResult({ error: "No se pudo subir el archivo. Intenta de nuevo." });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-xs text-ink-500">{description}</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) setFile(f);
        }}
        className={clsx(
          "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-ink-50 hover:bg-ink-100"
        )}
      >
        <input
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-sm font-medium text-ink-700">
          {file ? file.name : "Arrastra tu archivo aquí o haz clic para elegirlo"}
        </p>
        <p className="mt-1 text-xs text-ink-500">Formatos: .xlsx o .csv (delimitado por comas)</p>
      </label>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {stage === "reading" && "Leyendo archivo…"}
        {stage === "uploading" && "Subiendo archivo…"}
        {stage === "processing" &&
          (progreso
            ? `Guardando… ${progreso.hechas.toLocaleString("es-MX")} de ${progreso.total.toLocaleString("es-MX")}`
            : "Procesando filas…")}
        {stage === "idle" && (loading ? "Procesando…" : "Cargar archivo")}
      </button>

      {progreso && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-ink-100">
            <div
              className="h-2 rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.round((progreso.hechas / Math.max(progreso.total, 1)) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-ink-500">
            No cierres esta pestaña hasta que termine. Los archivos grandes pueden tardar unos minutos.
          </p>
        </div>
      )}

      {result?.ok && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          ✓ {result.rows_processed?.toLocaleString("es-MX")} filas guardadas
          {result.date_range ? ` · ${result.date_range}` : ""}
        </div>
      )}
      {result?.error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {result.error}
        </div>
      )}
    </div>
  );
}

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Cargar datos</h1>
      <p className="mt-1 text-sm text-ink-500">
        Cada archivo se guarda en su propia base — no se mezclan entre sí. Si una orden ya
        existía (semanas que se traslapan), se actualiza en vez de duplicarse.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <UploadCard
          tipo="ops"
          title="Data de Operaciones"
          description="El reporte principal: todas las órdenes con estatus, tiempos, restaurante, etc."
        />
        <UploadCard
          tipo="ventas"
          title="Data de Ventas"
          description="Usada para el desglose de pagos y la facturación mensual."
        />
        <UploadCard
          tipo="tiempos"
          title="Data de Tiempos"
          description="El CSV kfcDeliveryTimesFrom… — base de Devoluciones y cancelaciones."
        />
        <UploadCard
          tipo="rappi"
          title="Reporte de Rappi KFC"
          description="El cargo_order_report que descargas de la plataforma de Rappi (Rappi exclusivo de KFC)."
        />
      </div>
    </div>
  );
}
