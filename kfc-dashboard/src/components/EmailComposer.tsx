"use client";

import { useState } from "react";

const CC_PREDETERMINADOS = [
  "armando.alvarez@ambit.la",
  "carlos.pineda@ambit.la",
  "angelica.maldonado@ambit.la",
  "ivette.mendoza@ambit.la",
  "enrique.aguilera@ambit.la",
  "dinorah.baez@ambit.la",
  "claudia.parada@prb.com.mx",
  "estefania.herrmann@prb.com.mx",
  "xochitl.dimas@prb.com.mx",
  "paola.ubaldo@prb.com.mx",
  "dante.villalobos@prb.com.mx",
  "ricardo.arenas@prb.com.mx",
];

interface EmailComposerProps {
  open: boolean;
  onClose: () => void;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
}

export default function EmailComposer({
  open,
  onClose,
  defaultTo,
  defaultSubject,
  defaultBody,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [ccList, setCcList] = useState<string[]>(CC_PREDETERMINADOS);
  const [ccChecked, setCcChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(CC_PREDETERMINADOS.map((e) => [e, true]))
  );
  const [nuevoCc, setNuevoCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok?: boolean; error?: string } | null>(null);

  if (!open) return null;

  function toggleCc(email: string) {
    setCcChecked((prev) => ({ ...prev, [email]: !prev[email] }));
  }

  function agregarCc() {
    const email = nuevoCc.trim();
    if (!email || ccList.includes(email)) return;
    setCcList((prev) => [...prev, email]);
    setCcChecked((prev) => ({ ...prev, [email]: true }));
    setNuevoCc("");
  }

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    const cc = ccList.filter((e) => ccChecked[e]);
    try {
      const res = await fetch("/api/pagos/enviar-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, subject, body }),
      });
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setResultado({ ok: true });
    } catch (e) {
      setResultado({ error: e instanceof Error ? e.message : "No se pudo enviar el correo." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-900">Enviar confirmación de pago</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            ✕
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-ink-500">Para</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />

        <label className="mt-4 block text-xs font-medium text-ink-500">CC</label>
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
          {ccList.map((email) => (
            <label key={email} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={!!ccChecked[email]}
                onChange={() => toggleCc(email)}
                className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
              />
              {email}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="email"
            value={nuevoCc}
            onChange={(e) => setNuevoCc(e.target.value)}
            placeholder="agregar otro correo…"
            className="flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={agregarCc}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            Agregar
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-ink-500">Asunto</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />

        <label className="mt-4 block text-xs font-medium text-ink-500">
          Cuerpo (puedes editarlo antes de enviar)
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
        />

        {resultado?.ok && (
          <p className="mt-3 text-sm font-medium text-success">✓ Correo enviado a {to}.</p>
        )}
        {resultado?.error && (
          <p className="mt-3 text-sm font-medium text-danger">{resultado.error}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={enviando}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar correo ahora"}
          </button>
        </div>
      </div>
    </div>
  );
}
