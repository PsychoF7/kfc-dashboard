"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { useSesion } from "@/components/Sesion";
import { useAvisos, type Aviso } from "@/components/Avisos";

const campo =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";
const boton = "rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60";

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AvisosPage() {
  const sesion = useSesion();
  const esAdmin = sesion?.rol === "admin";
  const { recargar } = useAvisos();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [nivel, setNivel] = useState<"info" | "importante">("info");
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState<string | null>(null);
  const [eTitulo, setETitulo] = useState("");
  const [eMensaje, setEMensaje] = useState("");
  const [eNivel, setENivel] = useState<"info" | "importante">("info");
  const [aEliminar, setAEliminar] = useState<string | null>(null);

  const [mant, setMant] = useState({ activo: false, mensaje: "" });
  const [mantMsg, setMantMsg] = useState("");
  const [mantGuardando, setMantGuardando] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/avisos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setAvisos(d.avisos ?? []);
      })
      .catch((e) => setError(e.message ?? "No se pudieron cargar los avisos."))
      .finally(() => setCargando(false));
    fetch("/api/auth/estado", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.mantenimiento) {
          setMant(d.mantenimiento);
          setMantMsg(d.mantenimiento.mensaje ?? "");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(cargar, [cargar]);

  async function enviar(url: string, metodo: string, cuerpo?: unknown): Promise<boolean> {
    setError(null);
    try {
      const r = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error ?? "No se pudo guardar.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    }
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    if (await enviar("/api/avisos", "POST", { titulo, mensaje, nivel })) {
      setTitulo("");
      setMensaje("");
      setNivel("info");
      cargar();
      recargar();
    }
    setGuardando(false);
  }

  async function guardarEdicion(id: string) {
    if (await enviar(`/api/avisos/${id}`, "PATCH", { titulo: eTitulo, mensaje: eMensaje, nivel: eNivel })) {
      setEditando(null);
      cargar();
      recargar();
    }
  }

  async function alternar(a: Aviso) {
    if (await enviar(`/api/avisos/${a.id}`, "PATCH", { activo: !a.activo })) {
      cargar();
      recargar();
    }
  }

  async function eliminar(id: string) {
    if (aEliminar !== id) {
      setAEliminar(id);
      return;
    }
    if (await enviar(`/api/avisos/${id}`, "DELETE")) {
      setAEliminar(null);
      cargar();
      recargar();
    }
  }

  async function guardarMantenimiento(activo: boolean) {
    if (mantGuardando) return;
    setMantGuardando(true);
    if (await enviar("/api/mantenimiento", "PUT", { activo, mensaje: mantMsg })) cargar();
    setMantGuardando(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Avisos</h1>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          {error}
        </div>
      )}

      {esAdmin && (
        <>
          <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-900">Mantenimiento</h2>
              <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-medium", mant.activo ? "bg-danger-bg text-danger" : "bg-success-bg text-success")}>
                {mant.activo ? "Activo" : "Apagado"}
              </span>
            </div>
            <textarea
              value={mantMsg}
              onChange={(e) => setMantMsg(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Mensaje que verán los usuarios"
              className={`${campo} mt-4`}
            />
            <div className="mt-3 flex gap-2">
              {mant.activo ? (
                <>
                  <button type="button" disabled={mantGuardando} onClick={() => guardarMantenimiento(true)} className={`${boton} border border-ink-200 text-ink-700 hover:bg-ink-50`}>
                    Guardar mensaje
                  </button>
                  <button type="button" disabled={mantGuardando} onClick={() => guardarMantenimiento(false)} className={`${boton} bg-brand-500 text-white hover:bg-brand-600`}>
                    Desactivar mantenimiento
                  </button>
                </>
              ) : (
                <button type="button" disabled={mantGuardando} onClick={() => guardarMantenimiento(true)} className={`${boton} bg-danger text-white hover:opacity-90`}>
                  Activar mantenimiento
                </button>
              )}
            </div>
          </section>

          <form onSubmit={publicar} className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
            <h2 className="text-sm font-semibold text-ink-900">Nuevo aviso</h2>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Título" required className={`${campo} mt-4`} />
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} maxLength={1500} placeholder="Mensaje" required className={`${campo} mt-3`} />
            <div className="mt-3 flex items-center gap-3">
              <select value={nivel} onChange={(e) => setNivel(e.target.value as "info" | "importante")} className={`${campo} max-w-[12rem]`}>
                <option value="info">Informativo</option>
                <option value="importante">Importante</option>
              </select>
              <button type="submit" disabled={guardando} className={`${boton} bg-brand-500 text-white hover:bg-brand-600`}>
                {guardando ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </form>
        </>
      )}

      <section className="mt-6 space-y-3">
        {cargando ? (
          <p className="text-sm text-ink-500">Cargando…</p>
        ) : avisos.length === 0 ? (
          <p className="text-sm text-ink-500">No hay avisos.</p>
        ) : (
          avisos.map((a) => (
            <div key={a.id} className={clsx("rounded-2xl border bg-white p-5 shadow-card", a.nivel === "importante" ? "border-warning/40" : "border-ink-100", !a.activo && "opacity-60")}>
              {editando === a.id ? (
                <>
                  <input value={eTitulo} onChange={(e) => setETitulo(e.target.value)} maxLength={120} className={campo} />
                  <textarea value={eMensaje} onChange={(e) => setEMensaje(e.target.value)} rows={4} maxLength={1500} className={`${campo} mt-3`} />
                  <div className="mt-3 flex items-center gap-2">
                    <select value={eNivel} onChange={(e) => setENivel(e.target.value as "info" | "importante")} className={`${campo} max-w-[12rem]`}>
                      <option value="info">Informativo</option>
                      <option value="importante">Importante</option>
                    </select>
                    <button type="button" onClick={() => guardarEdicion(a.id)} className={`${boton} bg-brand-500 text-white hover:bg-brand-600`}>
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditando(null)} className={`${boton} border border-ink-200 text-ink-700 hover:bg-ink-50`}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-900">{a.titulo}</p>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {a.nivel === "importante" && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">Importante</span>}
                      {esAdmin && (
                        <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", a.activo ? "bg-success-bg text-success" : "bg-ink-100 text-ink-500")}>
                          {a.activo ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{a.mensaje}</p>
                  <p className="mt-3 text-xs text-ink-500">{fecha(a.creado_en)}</p>
                  {esAdmin && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(a.id);
                          setETitulo(a.titulo);
                          setEMensaje(a.mensaje);
                          setENivel(a.nivel);
                        }}
                        className={`${boton} border border-ink-200 text-ink-700 hover:bg-ink-50`}
                      >
                        Editar
                      </button>
                      <button type="button" onClick={() => alternar(a)} className={`${boton} border border-ink-200 text-ink-700 hover:bg-ink-50`}>
                        {a.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button type="button" onClick={() => eliminar(a.id)} className={`${boton} border border-rose-200 text-rose-700 hover:bg-rose-50`}>
                        {aEliminar === a.id ? "Confirmar eliminar" : "Eliminar"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
