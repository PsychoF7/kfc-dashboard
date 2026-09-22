"use client";

import { useState } from "react";
import clsx from "clsx";

type Tipo = "ops" | "ventas";

interface UploadResult {
  ok?: boolean;
  error?: string;
  rows_processed?: number;
  date_range?: string | null;
  filename?: string;
}

function UploadCard({ tipo, title, description }: { tipo: Tipo; title: string; description: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tipo", tipo);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (data.ok) setFile(null);
    } catch (e) {
      setResult({ error: "No se pudo subir el archivo. Intenta de nuevo." });
    } finally {
      setLoading(false);
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
        {loading ? "Procesando…" : "Cargar archivo"}
      </button>

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
      </div>
    </div>
  );
}
