"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useSesion } from "@/components/Sesion";
import { fechaCorta } from "@/lib/altas-bajas";
import { credencialesDeLibro } from "@/lib/credenciales-excel";
import { PRODUCTOS_CRED, type CredencialVista, type GrupoTienda } from "@/lib/credenciales";
import PanelMaster, { VerMasterKfc } from "@/components/CredencialesMaster";
import { Copiar, Etiqueta } from "@/components/CredencialesUI";

const campo =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const COLOR_PRODUCTO: Record<string, string> = {
  Delivery: "bg-indigo-50 text-indigo-700",
  Flotilla: "bg-teal-50 text-teal-700",
  Franquicia: "bg-amber-50 text-amber-700",
};

function Dato({ titulo, valor, mono = true, tachado }: { titulo: string; valor: string | null; mono?: boolean; tachado?: boolean }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-500">{titulo}</div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className={clsx("truncate text-sm text-ink-900", mono && "font-mono", tachado && "line-through decoration-ink-300")} title={valor}>
          {valor}
        </span>
        <Copiar valor={valor} etiqueta={titulo.toLowerCase()} />
      </div>
    </div>
  );
}

function FilaCredencial({ c, equipo, onEditar }: { c: CredencialVista; equipo: boolean; onEditar: (c: CredencialVista) => void }) {
  const anterior = c.estado !== "vigente";
  return (
    <div className={clsx("px-5 py-4", anterior && "bg-ink-50/60")}>
      <div className="flex flex-wrap items-center gap-2">
        <Etiqueta className={COLOR_PRODUCTO[c.producto]}>{c.producto}</Etiqueta>
        {c.estado === "anterior" && (
          <Etiqueta className="bg-amber-50 text-amber-700">
            Ya no aplica · ahora {c.ahora}
            {c.desde ? ` desde ${fechaCorta(c.desde)}` : ""}
          </Etiqueta>
        )}
        {c.estado === "baja" && <Etiqueta className="bg-rose-50 text-rose-700">Baja{c.desde ? ` · ${fechaCorta(c.desde)}` : ""}</Etiqueta>}
        {equipo && (
          <button type="button" onClick={() => onEditar(c)} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
            Editar
          </button>
        )}
      </div>
      <div className={clsx("mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", anterior && "opacity-70")}>
        <Dato titulo="ID" valor={c.restaurant_id} />
        <Dato titulo="Usuario" valor={c.usuario} />
        <Dato titulo="Contraseña" valor={c.contrasena} />
        <Dato titulo="Código para unirse a la flotilla" valor={c.codigo_flotilla} tachado={c.estado === "anterior"} />
      </div>
    </div>
  );
}

function TarjetaTienda({ g, equipo, onEditar }: { g: GrupoTienda; equipo: boolean; onEditar: (c: CredencialVista) => void }) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-ink-900">{g.sucursal}</h2>
        {g.baja && <Etiqueta className="bg-rose-50 text-rose-700">Baja</Etiqueta>}
        {!g.baja && g.producto && <Etiqueta className={COLOR_PRODUCTO[g.producto]}>Hoy: {g.producto}</Etiqueta>}
        {g.sinUsuarioActual && <Etiqueta className="bg-amber-50 text-amber-700">Sin usuario de {g.producto} cargado</Etiqueta>}
      </header>
      <div className="divide-y divide-ink-100">
        {g.credenciales.map((c) => (
          <FilaCredencial key={c.id} c={c} equipo={equipo} onEditar={onEditar} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Formulario de credencial (equipo)
// ---------------------------------------------------------------------
interface Borrador {
  sucursal: string;
  producto: string;
  restaurant_id: string;
  usuario: string;
  contrasena: string;
  codigo_flotilla: string;
  direccion: string;
}

function FormularioCred({ inicial, editandoId, onListo, onCerrar }: { inicial: Borrador; editandoId: number | null; onListo: () => void; onCerrar: () => void }) {
  const [b, setB] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Borrador, v: string) => setB((x) => ({ ...x, [k]: v }));
  const etiqueta = "text-xs font-medium text-ink-500";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(editandoId ? `/api/credenciales/${editandoId}` : "/api/credenciales", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...b, codigo_flotilla: b.producto === "Flotilla" ? b.codigo_flotilla : "" }),
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
    if (!editandoId || !window.confirm("¿Borrar esta credencial?")) return;
    setGuardando(true);
    const res = await fetch(`/api/credenciales/${editandoId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onListo();
    else {
      setError("No se pudo borrar.");
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Credencial">
      <form onSubmit={guardar} className="my-6 w-full max-w-xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{editandoId ? "Editar credencial" : "Nueva credencial"}</h2>
          <button type="button" onClick={onCerrar} className="text-sm text-ink-500 hover:text-ink-900" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={etiqueta} htmlFor="cr-sucursal">Sucursal</label>
            <input id="cr-sucursal" required className={`${campo} mt-1`} value={b.sucursal} onChange={(e) => set("sucursal", e.target.value)} placeholder="Ej. 371 KFC PLAZA CENTRAL" />
          </div>
          <div>
            <label className={etiqueta} htmlFor="cr-producto">Producto</label>
            <select id="cr-producto" className={`${campo} mt-1`} value={b.producto} onChange={(e) => set("producto", e.target.value)}>
              {PRODUCTOS_CRED.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="cr-id">ID</label>
            <input id="cr-id" className={`${campo} mt-1 font-mono`} value={b.restaurant_id} onChange={(e) => set("restaurant_id", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="cr-usuario">Usuario</label>
            <input id="cr-usuario" required className={`${campo} mt-1 font-mono`} value={b.usuario} onChange={(e) => set("usuario", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="cr-pass">Contraseña</label>
            <input id="cr-pass" required className={`${campo} mt-1 font-mono`} value={b.contrasena} onChange={(e) => set("contrasena", e.target.value)} />
          </div>
          {b.producto === "Flotilla" && (
            <div className="sm:col-span-2">
              <label className={etiqueta} htmlFor="cr-codigo">Código para unirse a la flotilla</label>
              <input id="cr-codigo" className={`${campo} mt-1 font-mono`} value={b.codigo_flotilla} onChange={(e) => set("codigo_flotilla", e.target.value)} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={etiqueta} htmlFor="cr-dir">Dirección</label>
            <input id="cr-dir" className={`${campo} mt-1`} value={b.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-between gap-3">
          {editandoId ? (
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

const borradorVacio = (): Borrador => ({ sucursal: "", producto: "Delivery", restaurant_id: "", usuario: "", contrasena: "", codigo_flotilla: "", direccion: "" });
const desdeCred = (c: CredencialVista): Borrador => ({
  sucursal: c.sucursal,
  producto: c.producto,
  restaurant_id: c.restaurant_id ?? "",
  usuario: c.usuario,
  contrasena: c.contrasena,
  codigo_flotilla: c.codigo_flotilla ?? "",
  direccion: c.direccion ?? "",
});

// ---------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------
const POR_PAGINA = 30;

export default function Credenciales() {
  const sesion = useSesion();
  const rol = sesion?.rol;
  const equipo = rol === "admin" || rol === "editor";
  const esAdmin = rol === "admin";

  const [vista, setVista] = useState<"tiendas" | "master">("tiendas");
  const [q, setQ] = useState("");
  const [producto, setProducto] = useState("");
  const [soloCambios, setSoloCambios] = useState(false);
  const [grupos, setGrupos] = useState<GrupoTienda[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [form, setForm] = useState<{ inicial: Borrador; id: number | null } | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    if (!rol) return;
    const consulta = rol === "consulta";
    const termino = q.trim();
    if (consulta && termino.length < 2) {
      setGrupos([]);
      setTotal(0);
      setCargando(false);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const r = await fetch(`/api/credenciales?q=${encodeURIComponent(termino)}`, { cache: "no-store", signal: ctl.signal });
        const d = await r.json();
        if (!r.ok || d?.error) throw new Error(d?.error ?? "No se pudo cargar.");
        setGrupos(d.grupos);
        setTotal(d.total);
        setVisibles(POR_PAGINA);
        setCargando(false);
      } catch (e) {
        if (ctl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
        setCargando(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, rol, equipo, recargar]);

  const filtrados = useMemo(
    () =>
      grupos.filter(
        (g) => (!producto || g.credenciales.some((c) => c.producto === producto)) && (!soloCambios || g.credenciales.some((c) => c.estado !== "vigente"))
      ),
    [grupos, producto, soloCambios]
  );

  const importar = useCallback(
    async (file: File) => {
      setImportando(true);
      setAviso(null);
      try {
        const XLSX = await import("xlsx");
        const libro = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const hojas = libro.SheetNames.map((nombre) => ({
          nombre,
          filas: XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null }) as unknown[][],
        }));
        const { credenciales, hojasUsadas, duplicadas } = credencialesDeLibro(hojas);
        if (credenciales.length === 0) throw new Error("No encontré las hojas Usuarios Delivery, Usuarios Flotilla o Usuarios Franquicias con las columnas Usuario y Contraseña.");
        const res = await fetch("/api/credenciales/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credenciales }) });
        const d = await res.json().catch(() => null);
        if (!res.ok) throw new Error(d?.error ?? "No se pudo importar.");
        setRecargar((n) => n + 1);
        setAviso({
          ok: true,
          texto: `Importado (${hojasUsadas.join(", ")}): ${d.nuevos} nuevas y ${d.actualizados} actualizadas${duplicadas ? `, ${duplicadas} repetidas en el archivo` : ""}.`,
        });
      } catch (e) {
        setAviso({ ok: false, texto: e instanceof Error ? e.message : "No se pudo importar el archivo." });
      } finally {
        setImportando(false);
      }
    },
    []
  );

  if (!rol) return <div className="py-16 text-center text-sm text-ink-500">Cargando…</div>;

  const tiendas = (
    <>
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <label htmlFor="cr-buscar" className="sr-only">
          Buscar tienda
        </label>
        <input
          id="cr-buscar"
          type="search"
          autoFocus
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número o nombre de la tienda"
          className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {equipo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {["", ...PRODUCTOS_CRED].map((p) => (
                <button
                  key={p || "todos"}
                  type="button"
                  aria-pressed={producto === p}
                  onClick={() => setProducto(p)}
                  className={clsx("rounded-full border px-3 py-1 text-xs font-medium", producto === p ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50")}
                >
                  {p || "Todos"}
                </button>
              ))}
              <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                Con cambio de producto
              </label>
            </div>
            <span className="text-xs text-ink-500">{filtrados.length} {filtrados.length === 1 ? "tienda" : "tiendas"}</span>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 space-y-4">
        {filtrados.slice(0, equipo ? visibles : filtrados.length).map((g) => (
          <TarjetaTienda key={g.clave} g={g} equipo={equipo} onEditar={(c) => setForm({ inicial: desdeCred(c), id: c.id })} />
        ))}
        {equipo && filtrados.length > visibles && (
          <button type="button" onClick={() => setVisibles((v) => v + POR_PAGINA)} className="w-full rounded-lg border border-ink-200 bg-white py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
            Mostrar más
          </button>
        )}
        {!equipo && !cargando && q.trim().length >= 2 && grupos.length === 0 && !error && (
          <p className="py-8 text-center text-sm text-ink-500">No encontré ninguna tienda con “{q.trim()}”.</p>
        )}
        {!equipo && total > grupos.length && <p className="py-2 text-center text-sm text-ink-500">Hay {total} coincidencias; escribe más para acotar la búsqueda.</p>}
        {equipo && !cargando && grupos.length === 0 && !error && <p className="py-8 text-center text-sm text-ink-500">Sin resultados.</p>}
        {cargando && <p className="py-4 text-center text-sm text-ink-500">Buscando…</p>}
      </div>
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Credenciales</h1>
        {equipo && vista === "tiendas" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className={clsx("cursor-pointer rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50", importando && "pointer-events-none opacity-60")}>
              {importando ? "Importando…" : "Importar Excel"}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importar(f);
                }}
              />
            </label>
            <button onClick={() => setForm({ inicial: borradorVacio(), id: null })} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              + Nueva credencial
            </button>
          </div>
        )}
      </div>

      {esAdmin && (
        <div className="mt-5 inline-flex rounded-lg border border-ink-200 p-0.5">
          {(
            [
              ["tiendas", "Tiendas"],
              ["master", "Usuarios master y códigos"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => setVista(id)} className={clsx("rounded-md px-3 py-1.5 text-xs font-medium", vista === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50")}>
              {label}
            </button>
          ))}
        </div>
      )}

      {aviso && (
        <div className={clsx("mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm", aviso.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700")} role="status">
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-xs font-medium underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="mt-5">
        {vista === "master" && esAdmin ? <PanelMaster /> : tiendas}
        {rol === "consulta" && (
          <div className="mt-8">
            <VerMasterKfc />
          </div>
        )}
      </div>

      {form && (
        <FormularioCred
          inicial={form.inicial}
          editandoId={form.id}
          onListo={() => {
            setForm(null);
            setRecargar((n) => n + 1);
          }}
          onCerrar={() => setForm(null)}
        />
      )}
    </div>
  );
}
