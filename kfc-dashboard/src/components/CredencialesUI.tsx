"use client";

import { useState } from "react";
import clsx from "clsx";

export function Etiqueta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

export function Copiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      const t = document.createElement("textarea");
      t.value = valor;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }
  return (
    <button type="button" onClick={copiar} aria-label={`Copiar ${etiqueta}`} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700">
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}
