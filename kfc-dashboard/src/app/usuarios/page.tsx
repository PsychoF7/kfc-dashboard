"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { useSesion } from "@/components/Sesion";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/permisos";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
  ultimo_acceso: string | null;
}

const campo =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function fecha(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UsuariosPage() {
  const yo = useSesion();
  const [lista, setLista] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", password: "", rol: "consulta" as Rol });
  const [creando, setCreando] = useState(false);
  const [claveDe, setClaveDe] = useState<string | null>(null);
  const [claveNueva, setClaveNueva] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/usuarios", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error ?? "No se pudo cargar.");
      setLista(d.usuarios);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiar(id: string, datos: Record<string, unknown>, ok: string) {
    setError(null);
    setAviso(null);
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      setError(d?.error ?? "No se pudo guardar.");
      return false;
    }
    setAviso(ok);
    await cargar();
    return true;
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo crear.");
      setAviso(`Usuario creado: ${nuevo.email}. Pásale su contraseña por un medio seguro.`);
      setNuevo({ nombre: "", email: "", password: "", rol: "consulta" });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear.");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-ink-900">Usuarios y permisos</h1>
      <p className="mt-1 text-sm text-ink-500">
        Quién puede entrar al panel y qué ve. Los cambios de rol o baja aplican al volver a iniciar sesión
        (máximo 12 horas).
      </p>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {aviso && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</div>}

      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink-900">Agregar usuario</h2>
        <form onSubmit={crear} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className={campo} placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          <input className={campo} type="email" placeholder="Correo" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required />
          <input className={campo} type="text" placeholder="Contraseña (mín. 8)" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} required minLength={8} autoComplete="off" />
          <select className={campo} value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
            ))}
          </select>
          <button type="submit" disabled={creando} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {creando ? "Creando…" : "Crear usuario"}
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-500">
          Administrador: todo. Editor: todo menos esta pantalla. Consulta (KFC): panel principal, devoluciones (sin reporte
          semanal ni “Por repartidor”), tiempos, flotilla, reembolsos, materiales y avisos, sin descargas de Excel.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-ink-100 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Último acceso</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-500">Cargando…</td></tr>
            )}
            {!cargando && lista.map((u) => {
              const soyYo = u.id === (yo ? lista.find((x) => x.email === yo.email)?.id : undefined);
              return (
                <tr key={u.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{u.nombre}{soyYo && <span className="ml-2 text-xs text-ink-500">(tú)</span>}</p>
                    <p className="text-xs text-ink-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={clsx(campo, "w-auto")}
                      value={u.rol}
                      disabled={soyYo}
                      onChange={(e) => cambiar(u.id, { rol: e.target.value }, `Rol de ${u.nombre} actualizado.`)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">{fecha(u.ultimo_acceso)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", u.activo ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-500")}>
                      {u.activo ? "Activo" : "Baja"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {claveDe === u.id ? (
                      <span className="inline-flex items-center gap-2">
                        <input className={clsx(campo, "w-44")} placeholder="Nueva contraseña" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} autoComplete="off" />
                        <button
                          className="text-xs font-semibold text-brand-600 hover:underline"
                          onClick={async () => {
                            if (await cambiar(u.id, { password: claveNueva }, `Contraseña de ${u.nombre} cambiada.`)) {
                              setClaveDe(null);
                              setClaveNueva("");
                            }
                          }}
                        >
                          Guardar
                        </button>
                        <button className="text-xs text-ink-500 hover:underline" onClick={() => { setClaveDe(null); setClaveNueva(""); }}>Cancelar</button>
                      </span>
                    ) : (
                      <span className="inline-flex gap-4 text-xs font-medium">
                        <button className="text-brand-600 hover:underline" onClick={() => { setClaveDe(u.id); setClaveNueva(""); }}>Cambiar contraseña</button>
                        {!soyYo && (
                          <button
                            className={u.activo ? "text-danger hover:underline" : "text-brand-600 hover:underline"}
                            onClick={() => cambiar(u.id, { activo: !u.activo }, u.activo ? `${u.nombre} ya no tiene acceso.` : `${u.nombre} volvió a tener acceso.`)}
                          >
                            {u.activo ? "Dar de baja" : "Reactivar"}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
