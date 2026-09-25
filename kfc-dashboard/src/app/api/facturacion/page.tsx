"use client";

import { useState } from "react";

export default function FacturacionPage() {
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState<{ ok?: boolean; total?: number; error?: string } | null>(
    null
  );

  async function sincronizar() {
    setSincronizando(true);
    setResultado(null);
    try {
      const res = await fetch("/api/facturacion/sincronizar-altas", { method: "POST" });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setResultado({ ok: true, total: data.total });
    } catch (e) {
      setResultado({ error: e instanceof Error ? e.message : "No se pudo sincronizar." });
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Facturación mensual</h1>
      <p className="mt-1 text-sm text-ink-500">
        Primero sincroniza tu historial de altas/bajas — el cálculo del mes lo agregamos en el
        siguiente paso.
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Altas y bajas</h2>
            <p className="mt-1 text-xs text-ink-500">
              Trae lo más reciente de tu hoja "Seguimientos_altas_KFC" (pestañas General 2026,
              Delivery a Flotilla, Flotilla a Delivery y Bajas 2026).
            </p>
          </div>
          <button
            onClick={sincronizar}
            disabled={sincronizando}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {sincronizando ? "Sincronizando…" : "Sincronizar altas/bajas"}
          </button>
        </div>

        {resultado?.ok && (
          <p className="mt-3 text-sm font-medium text-success">
            ✓ Se sincronizaron {resultado.total?.toLocaleString("es-MX")} movimientos.
          </p>
        )}
        {resultado?.error && (
          <p className="mt-3 text-sm font-medium text-danger">{resultado.error}</p>
        )}
      </div>
    </div>
  );
}
