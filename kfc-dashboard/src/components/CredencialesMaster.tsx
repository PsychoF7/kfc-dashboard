"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Copiar, Etiqueta } from "@/components/CredencialesUI";
import { fechaCorta } from "@/lib/altas-bajas";

const campo =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

interface Master {
  id: number;
  etiqueta: string;
  usuario: string;
  contrasena: string;
}

interface Codigo {
  id: number;
  para: string | null;
  creado_en: string;
  vence_en: string;
  usado_en: string | null;
  usado_por: string | null;
}

function Datos({ m }: { m: Master }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {(
        [
          ["Usuario", m.usuario],
          ["Contraseña", m.contrasena],
        ] as const
      ).map(([t, v]) => (
        <div key={t} className="min-w-0">
          <div className="text-xs text-ink-500">{t}</div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="truncate font-mono text-sm text-ink-900" title={v}>
              {v}
            </span>
            <Copiar valor={v} etiqueta={t.toLowerCase()} />
          </div>
        </div>
      ))}
    </div>
  );
}

const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return `${fechaCorta(iso.slice(0, 10))} ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
};

// ---------------------------------------------------------------------
// KFC: ver los usuarios master con un código de un solo uso
// ---------------------------------------------------------------------
export function VerMasterKfc() {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masters, setMasters] = useState<Master[] | null>(null);

  async function canjear(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/credenciales/master/revelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo validar el código.");
      setMasters(d.masters);
      setCodigo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar el código.");
    } finally {
      setCargando(false);
    }
  }

  function ocultar() {
    setMasters(null);
    setAbierto(false);
    setError(null);
  }

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-900">Usuarios master</h2>
        {masters ? (
          <button type="button" onClick={ocultar} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Ocultar
          </button>
        ) : (
          !abierto && (
            <button type="button" onClick={() => setAbierto(true)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50">
              Ingresar código
            </button>
          )
        )}
      </div>

      {!masters && abierto && (
        <form onSubmit={canjear} className="mt-4 flex flex-wrap items-start gap-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="cr-codigo-master" className="sr-only">
              Código de un solo uso
            </label>
            <input
              id="cr-codigo-master"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Código de un solo uso"
              className={clsx(campo, "font-mono tracking-widest")}
              maxLength={12}
            />
            {error && (
              <p className="mt-2 text-sm text-rose-700" role="alert">
                {error}
              </p>
            )}
          </div>
          <button type="submit" disabled={cargando || codigo.replace(/[^A-Z0-9]/gi, "").length < 8} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {cargando ? "Validando…" : "Ver usuarios"}
          </button>
        </form>
      )}

      {masters && (
        <div className="mt-4 divide-y divide-ink-100">
          {masters.length === 0 && <p className="py-2 text-sm text-ink-500">Todavía no hay usuarios master registrados.</p>}
          {masters.map((m) => (
            <div key={m.id} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-3 text-sm font-medium text-ink-900">{m.etiqueta}</div>
              <Datos m={m} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------
// Administrador: usuarios master y códigos
// ---------------------------------------------------------------------
function FormularioMaster({ inicial, onListo, onCerrar }: { inicial: Master | null; onListo: () => void; onCerrar: () => void }) {
  const [b, setB] = useState({ etiqueta: inicial?.etiqueta ?? "", usuario: inicial?.usuario ?? "", contrasena: inicial?.contrasena ?? "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const etiqueta = "text-xs font-medium text-ink-500";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(inicial ? `/api/credenciales/master/${inicial.id}` : "/api/credenciales/master", {
        method: inicial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo guardar.");
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!inicial || !window.confirm("¿Borrar este usuario master?")) return;
    setGuardando(true);
    const res = await fetch(`/api/credenciales/master/${inicial.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onListo();
    else {
      setError("No se pudo borrar.");
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Usuario master">
      <form onSubmit={guardar} className="my-6 w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{inicial ? "Editar usuario master" : "Nuevo usuario master"}</h2>
          <button type="button" onClick={onCerrar} className="text-sm text-ink-500 hover:text-ink-900" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className={etiqueta} htmlFor="ms-etiqueta">Nombre</label>
            <input id="ms-etiqueta" required className={`${campo} mt-1`} value={b.etiqueta} onChange={(e) => setB({ ...b, etiqueta: e.target.value })} placeholder="Ej. Master Delivery" />
          </div>
          <div>
            <label className={etiqueta} htmlFor="ms-usuario">Usuario</label>
            <input id="ms-usuario" required className={`${campo} mt-1 font-mono`} value={b.usuario} onChange={(e) => setB({ ...b, usuario: e.target.value })} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="ms-pass">Contraseña</label>
            <input id="ms-pass" required className={`${campo} mt-1 font-mono`} value={b.contrasena} onChange={(e) => setB({ ...b, contrasena: e.target.value })} />
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          {inicial ? (
            <button type="button" onClick={borrar} disabled={guardando} className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50">
              Borrar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function estadoCodigo(c: Codigo): { texto: string; clase: string } {
  if (c.usado_en) return { texto: `Usado${c.usado_por ? ` por ${c.usado_por}` : ""} · ${fechaHora(c.usado_en)}`, clase: "bg-emerald-50 text-emerald-700" };
  if (new Date(c.vence_en).getTime() < Date.now()) return { texto: "Vencido", clase: "bg-ink-100 text-ink-500" };
  return { texto: `Pendiente · vence ${fechaHora(c.vence_en)}`, clase: "bg-amber-50 text-amber-700" };
}

export default function PanelMaster() {
  const [masters, setMasters] = useState<Master[] | null>(null);
  const [codigos, setCodigos] = useState<Codigo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ m: Master | null } | null>(null);
  const [para, setPara] = useState("");
  const [horas, setHoras] = useState(24);
  const [generando, setGenerando] = useState(false);
  const [nuevo, setNuevo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/credenciales/master", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/credenciales/codigos", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (a?.error) throw new Error(a.error);
      if (b?.error) throw new Error(b.error);
      setMasters(a.masters);
      setCodigos(b.codigos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function generar() {
    if (generando) return;
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch("/api/credenciales/codigos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ para, horas }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo generar el código.");
      setNuevo(d.codigo);
      setPara("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el código.");
    } finally {
      setGenerando(false);
    }
  }

  async function anular(id: number) {
    await fetch(`/api/credenciales/codigos?id=${id}`, { method: "DELETE" }).catch(() => null);
    await cargar();
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Usuarios master</h2>
          <button onClick={() => setForm({ m: null })} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
            + Nuevo usuario master
          </button>
        </div>
        <div className="mt-4 divide-y divide-ink-100">
          {!masters && <p className="py-2 text-sm text-ink-500">Cargando…</p>}
          {masters?.length === 0 && <p className="py-2 text-sm text-ink-500">Todavía no hay usuarios master.</p>}
          {masters?.map((m) => (
            <div key={m.id} className="py-4 first:pt-0 last:pb-0">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-900">{m.etiqueta}</span>
                <button onClick={() => setForm({ m })} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                  Editar
                </button>
              </div>
              <Datos m={m} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink-900">Códigos de un solo uso</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="cd-para" className="text-xs font-medium text-ink-500">
              Para quién (opcional)
            </label>
            <input id="cd-para" className={`${campo} mt-1`} value={para} onChange={(e) => setPara(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label htmlFor="cd-horas" className="text-xs font-medium text-ink-500">
              Vigencia
            </label>
            <select id="cd-horas" className={`${campo} mt-1`} value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
              <option value={1}>1 hora</option>
              <option value={24}>24 horas</option>
              <option value={168}>7 días</option>
            </select>
          </div>
          <button onClick={generar} disabled={generando} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {generando ? "Generando…" : "Generar código"}
          </button>
        </div>

        {nuevo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <span className="font-mono text-xl font-semibold tracking-widest text-ink-900" data-testid="codigo-nuevo">
              {nuevo}
            </span>
            <span className="flex items-center gap-3">
              <Copiar valor={nuevo} etiqueta="código" />
              <button onClick={() => setNuevo(null)} className="text-xs font-medium text-ink-500 hover:text-ink-900">
                Ocultar
              </button>
            </span>
          </div>
        )}

        <div className="mt-5 divide-y divide-ink-100">
          {codigos?.length === 0 && <p className="py-2 text-sm text-ink-500">Todavía no has generado códigos.</p>}
          {codigos?.map((c) => {
            const e = estadoCodigo(c);
            const pendiente = !c.usado_en && new Date(c.vence_en).getTime() >= Date.now();
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="text-ink-700">
                  {fechaHora(c.creado_en)}
                  {c.para ? ` · ${c.para}` : ""}
                </span>
                <span className="flex items-center gap-3">
                  <Etiqueta className={e.clase}>{e.texto}</Etiqueta>
                  {pendiente && (
                    <button onClick={() => anular(c.id)} className="text-xs font-medium text-rose-600 hover:text-rose-700">
                      Anular
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {form && (
        <FormularioMaster
          inicial={form.m}
          onListo={() => {
            setForm(null);
            cargar();
          }}
          onCerrar={() => setForm(null)}
        />
      )}
    </div>
  );
}
