"use client";

import { useEffect, useState } from "react";

export default function MantenimientoPage() {
  const [mensaje, setMensaje] = useState("");
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    function revisar() {
      fetch("/api/auth/estado", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.mantenimiento?.activo) setMensaje(d.mantenimiento.mensaje ?? "");
          else window.location.href = "/dashboard";
        })
        .catch(() => {});
    }
    revisar();
    const t = setInterval(revisar, 20_000);
    return () => clearInterval(t);
  }, []);

  async function salir() {
    setSaliendo(true);
    await fetch("/api/auth/salir", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card">
        <h1 className="font-display text-xl font-semibold text-ink-900">Panel en mantenimiento</h1>
        <p className="mt-3 whitespace-pre-line text-sm text-ink-700">{mensaje}</p>
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          className="mt-6 rounded-xl border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          {saliendo ? "Saliendo…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}
