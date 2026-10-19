"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import { useEsConsulta } from "@/components/Sesion";
import { movimientosDeLibro } from "@/lib/altas-bajas-excel";
import {
  ACTIVAS,
  DIAS_ENTRE_CAMBIOS,
  ESTADOS,
  PASOS,
  PRODUCTOS,
  TIPOS,
  agruparSucursales,
  claveMes,
  claveTienda,
  diasDesde,
  fechaCorta,
  mesDe,
  textoMovimiento,
  type Movimiento,
  type Sucursal,
  type TipoMov,
} from "@/lib/altas-bajas";

const campo =
  "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const COLOR_TIPO: Record<TipoMov, string> = {
  alta: "bg-emerald-50 text-emerald-700",
  cambio: "bg-indigo-50 text-indigo-700",
  baja: "bg-rose-50 text-rose-700",
};
const NOMBRE_TIPO: Record<TipoMov, string> = { alta: "Alta", cambio: "Cambio", baja: "Baja" };

function Etiqueta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

function EtiquetaActiva({ activa, baja }: { activa: string; baja?: boolean }) {
  if (baja) return <Etiqueta className="bg-rose-50 text-rose-700">Baja</Etiqueta>;
  return <Etiqueta className={activa === "En operación" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>{activa}</Etiqueta>;
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------
// Formulario (alta / edición)
// ---------------------------------------------------------------------
interface Borrador {
  tipo: TipoMov;
  sucursal: string;
  producto: string;
  producto_anterior: string;
  fecha_solicitud: string;
  estado: string;
  activa: string;
  fecha_inicio: string;
  fecha_confirmacion: string;
  motivo: string;
  comentarios: string;
  notas: string;
  pasos: Record<string, boolean>;
}

const borradorVacio = (): Borrador => ({
  tipo: "alta",
  sucursal: "",
  producto: "Delivery",
  producto_anterior: "",
  fecha_solicitud: hoyISO(),
  estado: "Pendiente",
  activa: "No iniciada",
  fecha_inicio: "",
  fecha_confirmacion: "",
  motivo: "",
  comentarios: "",
  notas: "",
  pasos: {},
});

const desdeMovimiento = (m: Movimiento): Borrador => ({
  tipo: m.tipo,
  sucursal: m.sucursal,
  producto: m.producto,
  producto_anterior: m.producto_anterior ?? "",
  fecha_solicitud: m.fecha_solicitud ?? "",
  estado: m.estado,
  activa: m.activa,
  fecha_inicio: m.fecha_inicio ?? "",
  fecha_confirmacion: m.fecha_confirmacion ?? "",
  motivo: m.motivo ?? "",
  comentarios: m.comentarios ?? "",
  notas: m.notas ?? "",
  pasos: m.pasos ?? {},
});

function Formulario({
  inicial,
  editandoId,
  sucursales,
  onGuardado,
  onBorrado,
  onCerrar,
}: {
  inicial: Borrador;
  editandoId: number | null;
  sucursales: Sucursal[];
  onGuardado: (m: Movimiento) => void;
  onBorrado: (id: number) => void;
  onCerrar: () => void;
}) {
  const [b, setB] = useState<Borrador>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));

  const claveEscrita = b.sucursal.trim() ? claveTienda({ tienda_num: (b.sucursal.match(/^\s*(\d{1,6})\b/) ?? [])[1] ?? null, sucursal: b.sucursal }) : "";
  const conocida = sucursales.find((s) => s.clave === claveEscrita);
  const ultimoCambioDias = conocida?.ultimoCambio ? diasDesde(conocida.ultimoCambio.fecha_solicitud) : null;
  const avisoCambio =
    b.tipo === "cambio" && ultimoCambioDias != null && ultimoCambioDias < DIAS_ENTRE_CAMBIOS && conocida?.ultimoCambio?.id !== editandoId
      ? `Esta sucursal ya tuvo un cambio de producto el ${fechaCorta(conocida?.ultimoCambio?.fecha_solicitud)} (hace ${ultimoCambioDias} días).`
      : null;

  // Al escribir una sucursal conocida en un cambio, propone su producto actual como "anterior"
  function elegirSucursal(valor: string) {
    set("sucursal", valor);
    const k = (valor.match(/^\s*(\d{1,6})\b/) ?? [])[1] ?? valor.trim().toUpperCase();
    const s = sucursales.find((x) => x.clave === k);
    if (s && b.tipo === "cambio" && !b.producto_anterior && !s.baja) set("producto_anterior", s.producto);
  }

  function cambiarTipo(t: TipoMov) {
    setB((x) => ({
      ...x,
      tipo: t,
      producto_anterior: t === "cambio" ? x.producto_anterior || (conocida && !conocida.baja ? conocida.producto : "") : "",
      producto: t === "baja" && conocida ? conocida.producto : x.producto,
    }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(editandoId ? `/api/altas-bajas/${editandoId}` : "/api/altas-bajas", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...b,
          producto_anterior: b.tipo === "cambio" ? b.producto_anterior : null,
          motivo: b.tipo === "baja" ? b.motivo : null,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo guardar.");
      onGuardado(d.movimiento);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!editandoId || !window.confirm("¿Borrar este movimiento?")) return;
    setGuardando(true);
    const res = await fetch(`/api/altas-bajas/${editandoId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) onBorrado(editandoId);
    else {
      setError("No se pudo borrar.");
      setGuardando(false);
    }
  }

  const etiqueta = "text-xs font-medium text-ink-500";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Movimiento">
      <form onSubmit={guardar} className="my-6 w-full max-w-2xl rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink-900">{editandoId ? "Editar movimiento" : "Nuevo movimiento"}</h2>
          <button type="button" onClick={onCerrar} className="text-sm text-ink-500 hover:text-ink-900" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-lg border border-ink-200 p-0.5">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiarTipo(t.id)}
              className={clsx("rounded-md px-3 py-1.5 text-xs font-medium", b.tipo === t.id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50")}
            >
              {t.nombre}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={etiqueta} htmlFor="ab-sucursal">
              Sucursal
            </label>
            <input id="ab-sucursal" list="ab-sucursales" required className={`${campo} mt-1`} value={b.sucursal} onChange={(e) => elegirSucursal(e.target.value)} placeholder="Ej. 371 KFC PLAZA CENTRAL" />
            <datalist id="ab-sucursales">
              {sucursales.map((s) => (
                <option key={s.clave} value={s.nombre} />
              ))}
            </datalist>
            {conocida && (
              <p className="mt-1 text-xs text-ink-500">
                Hoy: {conocida.baja ? "Baja" : conocida.producto} · {conocida.historial.length} {conocida.historial.length === 1 ? "movimiento" : "movimientos"}
              </p>
            )}
          </div>

          {b.tipo === "cambio" && (
            <div>
              <label className={etiqueta} htmlFor="ab-anterior">
                Producto anterior
              </label>
              <select id="ab-anterior" className={`${campo} mt-1`} value={b.producto_anterior} onChange={(e) => set("producto_anterior", e.target.value)} required>
                <option value="">Elegir…</option>
                {PRODUCTOS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={etiqueta} htmlFor="ab-producto">
              {b.tipo === "cambio" ? "Producto nuevo" : b.tipo === "baja" ? "Producto que tenía" : "Producto contratado"}
            </label>
            <select id="ab-producto" className={`${campo} mt-1`} value={b.producto} onChange={(e) => set("producto", e.target.value)}>
              {PRODUCTOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {avisoCambio && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{avisoCambio}</p>}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="ab-solicitud">
              Fecha de solicitud
            </label>
            <input id="ab-solicitud" type="date" className={`${campo} mt-1`} value={b.fecha_solicitud} onChange={(e) => set("fecha_solicitud", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="ab-confirmacion">
              Confirmación a KFC
            </label>
            <input id="ab-confirmacion" type="date" className={`${campo} mt-1`} value={b.fecha_confirmacion} onChange={(e) => set("fecha_confirmacion", e.target.value)} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="ab-estado">
              Estado
            </label>
            <select id="ab-estado" className={`${campo} mt-1`} value={b.estado} onChange={(e) => set("estado", e.target.value)}>
              {ESTADOS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          {b.tipo !== "baja" && (
            <>
              <div>
                <label className={etiqueta} htmlFor="ab-activa">
                  Activa
                </label>
                <select id="ab-activa" className={`${campo} mt-1`} value={b.activa} onChange={(e) => set("activa", e.target.value)}>
                  {ACTIVAS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={etiqueta} htmlFor="ab-inicio">
                  Inicio de operación
                </label>
                <input id="ab-inicio" type="date" className={`${campo} mt-1`} value={b.fecha_inicio} onChange={(e) => set("fecha_inicio", e.target.value)} />
              </div>
            </>
          )}
          {b.tipo === "baja" && (
            <div className="sm:col-span-2">
              <label className={etiqueta} htmlFor="ab-motivo">
                Motivo
              </label>
              <input id="ab-motivo" className={`${campo} mt-1`} value={b.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="Ej. Cierre de tienda" />
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className={etiqueta} htmlFor="ab-comentarios">
            Comentarios para KFC
          </label>
          <textarea id="ab-comentarios" rows={2} className={`${campo} mt-1`} value={b.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
        </div>

        <fieldset className="mt-4 rounded-lg border border-ink-100 p-3">
          <legend className="px-1 text-xs font-medium text-ink-500">Pasos internos</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PASOS[b.tipo].map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={!!b.pasos[p.id]}
                  onChange={(e) => set("pasos", { ...b.pasos, [p.id]: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
                />
                {p.nombre}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <label className={etiqueta} htmlFor="ab-notas">
            Notas internas
          </label>
          <textarea id="ab-notas" rows={2} className={`${campo} mt-1`} value={b.notas} onChange={(e) => set("notas", e.target.value)} />
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

// ---------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------
const COLOR_PRODUCTO: Record<string, string> = {
  Delivery: "bg-indigo-50 text-indigo-700",
  Flotilla: "bg-teal-50 text-teal-700",
  Franquicia: "bg-amber-50 text-amber-700",
};

function Producto({ p }: { p: string }) {
  return <Etiqueta className={COLOR_PRODUCTO[p] ?? "bg-ink-50 text-ink-700"}>{p}</Etiqueta>;
}

type Situacion = "" | "operando" | "porIniciar" | "baja";
const SITUACIONES: { id: Situacion; nombre: string }[] = [
  { id: "", nombre: "Todas" },
  { id: "operando", nombre: "En operación" },
  { id: "porIniciar", nombre: "Por iniciar" },
  { id: "baja", nombre: "Bajas" },
];

const mesGrupo = (iso: string | null | undefined) => (iso ? claveMes(iso) : "");
const nombreGrupo = (k: string) => (k ? mesDe(k + "-01") : "Sin fecha de solicitud");

function Grupo({
  titulo,
  resumen,
  abierto,
  onAlternar,
  children,
}: {
  titulo: string;
  resumen: React.ReactNode;
  abierto: boolean;
  onAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      <button type="button" onClick={onAlternar} aria-expanded={abierto} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="flex items-center gap-3">
          <span aria-hidden className={clsx("inline-block text-[10px] text-ink-500 transition-transform", abierto && "rotate-90")}>
            ▶
          </span>
          <span className="text-sm font-semibold text-ink-900">{titulo}</span>
        </span>
        <span className="flex flex-wrap items-center justify-end gap-2 text-xs text-ink-500">{resumen}</span>
      </button>
      {abierto && <div className="border-t border-ink-100">{children}</div>}
    </section>
  );
}

export default function AltasBajas() {
  const esConsulta = useEsConsulta();
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [vista, setVista] = useState<"sucursales" | "movimientos">("sucursales");
  const [buscar, setBuscar] = useState("");
  const [situacion, setSituacion] = useState<Situacion>("");
  const [fTipo, setFTipo] = useState("");
  const [fProducto, setFProducto] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fMes, setFMes] = useState("");
  const [soloCambios, setSoloCambios] = useState(false);
  const [recientesPrimero, setRecientesPrimero] = useState(false);
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [todoAbierto, setTodoAbierto] = useState<boolean | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState<{ inicial: Borrador; id: number | null } | null>(null);

  function cargar() {
    return fetch("/api/altas-bajas", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setMovs(d.movimientos);
      })
      .catch((e) => setError(e.message ?? "No se pudieron cargar los movimientos."));
  }
  useEffect(() => {
    cargar();
  }, []);

  const todas = useMemo(() => agruparSucursales(movs ?? []), [movs]);
  const meses = useMemo(() => {
    const s = new Set<string>();
    (movs ?? []).forEach((m) => m.fecha_solicitud && s.add(claveMes(m.fecha_solicitud)));
    return Array.from(s).sort().reverse();
  }, [movs]);

  const kpi = useMemo(() => {
    const vivas = todas.filter((s) => !s.baja);
    return {
      sucursales: vivas.length,
      operando: vivas.filter((s) => s.actual.activa === "En operación").length,
      porIniciar: vivas.filter((s) => s.actual.activa !== "En operación").length,
      cambios: (movs ?? []).filter((m) => m.tipo === "cambio").length,
      bajas: todas.filter((s) => s.baja).length,
    };
  }, [todas, movs]);

  const q = buscar.trim().toLowerCase();
  const hayFiltros = !!(q || situacion || fTipo || fProducto || fEstado || fMes || soloCambios);

  const sucursalesFiltradas = useMemo(
    () =>
      todas.filter((s) => {
        if (soloCambios && s.cambios === 0) return false;
        if (q && !s.nombre.toLowerCase().includes(q) && !s.historial.some((m) => (m.comentarios ?? "").toLowerCase().includes(q))) return false;
        if (fProducto && s.producto !== fProducto) return false;
        if (situacion === "baja" && !s.baja) return false;
        if (situacion === "operando" && (s.baja || s.actual.activa !== "En operación")) return false;
        if (situacion === "porIniciar" && (s.baja || s.actual.activa === "En operación")) return false;
        if (fEstado && s.actual.estado !== fEstado) return false;
        if (fMes && mesGrupo(s.fechaAlta) !== fMes) return false;
        return true;
      }),
    [todas, q, soloCambios, fProducto, situacion, fEstado, fMes]
  );

  const movsFiltrados = useMemo(
    () =>
      (movs ?? []).filter(
        (m) =>
          (!q || m.sucursal.toLowerCase().includes(q) || (m.comentarios ?? "").toLowerCase().includes(q)) &&
          (!fTipo || m.tipo === fTipo) &&
          (!fProducto || m.producto === fProducto || m.producto_anterior === fProducto) &&
          (!fEstado || m.estado === fEstado) &&
          (situacion !== "operando" || (m.tipo !== "baja" && m.activa === "En operación")) &&
          (situacion !== "porIniciar" || (m.tipo !== "baja" && m.activa !== "En operación")) &&
          (situacion !== "baja" || m.tipo === "baja") &&
          (!fMes || mesGrupo(m.fecha_solicitud) === fMes)
      ),
    [movs, q, fTipo, fProducto, fEstado, situacion, fMes]
  );

  // Grupos por mes de solicitud, en el orden elegido
  const grupos = useMemo(() => {
    const mapa = new Map<string, unknown[]>();
    const fuente: { clave: string; item: unknown; fecha: string | null; nombre: string }[] =
      vista === "sucursales"
        ? sucursalesFiltradas.map((s) => ({ clave: mesGrupo(s.fechaAlta), item: s, fecha: s.fechaAlta, nombre: s.nombre }))
        : movsFiltrados.map((m) => ({ clave: mesGrupo(m.fecha_solicitud), item: m, fecha: m.fecha_solicitud, nombre: m.sucursal }));
    const dir = recientesPrimero ? -1 : 1;
    fuente.sort((a, b) => dir * ((a.fecha ?? "9999").localeCompare(b.fecha ?? "9999") || a.nombre.localeCompare(b.nombre, "es", { numeric: true })));
    for (const f of fuente) mapa.set(f.clave, [...(mapa.get(f.clave) ?? []), f.item]);
    return Array.from(mapa.entries())
      .sort((a, b) => dir * (a[0] || "9999").localeCompare(b[0] || "9999"))
      .map(([clave, items]) => ({ clave, items }));
  }, [vista, sucursalesFiltradas, movsFiltrados, recientesPrimero]);

  // Abierto: lo que el usuario eligió; si no, solo el mes más reciente (o todo si hay filtros)
  const mesReciente = useMemo(() => grupos.map((g) => g.clave).filter(Boolean).sort().pop() ?? "", [grupos]);
  const estaAbierto = (k: string) => {
    if (k in abiertos) return abiertos[k];
    if (todoAbierto !== null) return todoAbierto;
    return hayFiltros || k === mesReciente;
  };
  const alternar = (k: string) => setAbiertos((a) => ({ ...a, [k]: !estaAbierto(k) }));
  const expandir = (v: boolean) => {
    setTodoAbierto(v);
    setAbiertos({});
  };

  // Al cambiar búsqueda o filtros, los grupos vuelven a su apertura automática
  useEffect(() => {
    setTodoAbierto(null);
    setAbiertos({});
  }, [q, situacion, fTipo, fProducto, fEstado, fMes, soloCambios, vista]);

  function guardado(m: Movimiento) {
    setMovs((prev) => {
      const lista = prev ?? [];
      return lista.some((x) => x.id === m.id) ? lista.map((x) => (x.id === m.id ? m : x)) : [m, ...lista];
    });
    setForm(null);
  }

  async function importar(file: File) {
    setImportando(true);
    setAviso(null);
    try {
      const XLSX = await import("xlsx");
      const libro = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const dos = (n: number) => String(n).padStart(2, "0");
      const hojas = libro.SheetNames.map((nombre) => ({
        nombre,
        filas: (XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: null }) as unknown[][]).map((fila) =>
          fila.map((c) => {
            if (!(c instanceof Date)) return c;
            const x = new Date(c.getTime() + 60000); // Excel a veces da 23:59:59 del día anterior
            return `${x.getFullYear()}-${dos(x.getMonth() + 1)}-${dos(x.getDate())}`;
          })
        ),
      }));
      const { movimientos, hojasUsadas } = movimientosDeLibro(hojas);
      if (movimientos.length === 0) throw new Error("No encontré altas ni bajas en el archivo. Revisa que tenga las columnas Sucursal y Solicitud alta (o Solicitud baja).");
      const res = await fetch("/api/altas-bajas/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movimientos }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "No se pudo importar.");
      await cargar();
      setAviso({ ok: true, texto: `Importado (${hojasUsadas.join(", ")}): ${d.nuevos} nuevos y ${d.actualizados} actualizados.` });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No se pudo importar el archivo." });
    } finally {
      setImportando(false);
    }
  }

  const limpiar = () => {
    setBuscar("");
    setSituacion("");
    setFTipo("");
    setFProducto("");
    setFEstado("");
    setFMes("");
    setSoloCambios(false);
  };
  const editar = (m: Movimiento) => setForm({ inicial: desdeMovimiento(m), id: m.id });
  const nuevoPara = (s: Sucursal) =>
    setForm({
      inicial: {
        ...borradorVacio(),
        sucursal: s.nombre,
        tipo: s.baja ? "alta" : "cambio",
        producto_anterior: s.baja ? "" : s.producto,
        producto: s.baja ? "Delivery" : s.producto === "Delivery" ? "Flotilla" : "Delivery",
      },
      id: null,
    });

  const total = vista === "sucursales" ? sucursalesFiltradas.length : movsFiltrados.length;

  function resumenSucursales(items: Sucursal[]) {
    const op = items.filter((s) => !s.baja && s.actual.activa === "En operación").length;
    const por = items.filter((s) => !s.baja && s.actual.activa !== "En operación").length;
    const baj = items.filter((s) => s.baja).length;
    return (
      <>
        <span className="font-medium text-ink-700">{items.length} {items.length === 1 ? "sucursal" : "sucursales"}</span>
        {op > 0 && <Etiqueta className="bg-emerald-50 text-emerald-700">{op} en operación</Etiqueta>}
        {por > 0 && <Etiqueta className="bg-amber-50 text-amber-700">{por} por iniciar</Etiqueta>}
        {baj > 0 && <Etiqueta className="bg-rose-50 text-rose-700">{baj} {baj === 1 ? "baja" : "bajas"}</Etiqueta>}
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Altas y bajas</h1>
        {!esConsulta && (
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
              + Nuevo movimiento
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {aviso && (
        <div className={clsx("mt-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm", aviso.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700")} role="status">
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-xs font-medium underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Sucursales dadas de alta" value={movs ? String(kpi.sucursales) : "…"} />
        <KpiCard label="En operación" value={movs ? String(kpi.operando) : "…"} accent="success" />
        <KpiCard label="Por iniciar" value={movs ? String(kpi.porIniciar) : "…"} accent="warning" />
        <KpiCard label="Cambios de producto" value={movs ? String(kpi.cambios) : "…"} />
        <KpiCard label="Bajas" value={movs ? String(kpi.bajas) : "…"} accent={kpi.bajas > 0 ? "danger" : "default"} />
      </div>

      {/* Controles */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-ink-200 p-0.5">
            {(
              [
                ["sucursales", "Por sucursal"],
                ["movimientos", "Movimientos"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setVista(id)} className={clsx("rounded-md px-3 py-1.5 text-xs font-medium", vista === id ? "bg-brand-500 text-white" : "text-ink-700 hover:bg-ink-50")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SITUACIONES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSituacion(s.id)}
                aria-pressed={situacion === s.id}
                className={clsx("rounded-full border px-3 py-1 text-xs font-medium", situacion === s.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50")}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <input type="search" aria-label="Buscar sucursal" placeholder="Buscar sucursal" value={buscar} onChange={(e) => setBuscar(e.target.value)} className={clsx(campo, "col-span-2 md:col-span-1")} />
          <select aria-label="Producto" className={campo} value={fProducto} onChange={(e) => setFProducto(e.target.value)}>
            <option value="">Producto: todos</option>
            {PRODUCTOS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select aria-label="Estado" className={campo} value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
            <option value="">Estado: todos</option>
            {ESTADOS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select aria-label="Mes de solicitud" className={campo} value={fMes} onChange={(e) => setFMes(e.target.value)}>
            <option value="">Mes de solicitud: todos</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesDe(m + "-01")}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            {vista === "sucursales" ? (
              <label className="inline-flex cursor-pointer items-center gap-2 text-ink-700">
                <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                Solo con cambios de producto
              </label>
            ) : (
              <select aria-label="Tipo" className={clsx(campo, "w-auto")} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                <option value="">Tipo: todos</option>
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            )}
            <button onClick={() => setRecientesPrimero((v) => !v)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Solicitud: {recientesPrimero ? "más reciente primero" : "más antigua primero"} ⇅
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="text-ink-500">
              {movs ? `${total} ${vista === "sucursales" ? "sucursales" : "movimientos"}` : ""}
            </span>
            <button onClick={() => expandir(true)} className="text-brand-600 hover:text-brand-700">
              Expandir todo
            </button>
            <button onClick={() => expandir(false)} className="text-brand-600 hover:text-brand-700">
              Contraer todo
            </button>
            {hayFiltros && (
              <button onClick={limpiar} className="text-brand-600 hover:text-brand-700">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista agrupada por mes de solicitud */}
      <div className="mt-4 space-y-3">
        {!movs && <p className="py-8 text-center text-sm text-ink-500">Cargando…</p>}
        {movs && grupos.length === 0 && <p className="py-8 text-center text-sm text-ink-500">Sin resultados con estos filtros.</p>}

        {vista === "sucursales" &&
          grupos.map((g) => {
            const items = g.items as Sucursal[];
            return (
              <Grupo key={g.clave || "sin"} titulo={nombreGrupo(g.clave)} resumen={resumenSucursales(items)} abierto={estaAbierto(g.clave)} onAlternar={() => alternar(g.clave)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[24%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-left text-xs text-ink-500">
                        <th className="px-5 py-2 font-medium">Sucursal</th>
                        <th className="px-3 py-2 font-medium">Producto</th>
                        <th className="px-3 py-2 font-medium">Situación</th>
                        <th className="px-3 py-2 font-medium">Inicio de operación</th>
                        <th className="px-3 py-2 font-medium">Último cambio de producto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => {
                        const ab = abierta === s.clave;
                        const dias = s.ultimoCambio ? diasDesde(s.ultimoCambio.fecha_solicitud) : null;
                        const reciente = dias != null && dias < DIAS_ENTRE_CAMBIOS;
                        return (
                          <Fragment key={s.clave}>
                            <tr className={clsx("cursor-pointer border-t border-ink-100 hover:bg-ink-50", ab && "bg-ink-50")} onClick={() => setAbierta(ab ? null : s.clave)}>
                              <td className="px-5 py-3 text-ink-900">
                                <button
                                  type="button"
                                  aria-expanded={ab}
                                  className="flex items-center gap-2 text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAbierta(ab ? null : s.clave);
                                  }}
                                >
                                  <span aria-hidden className={clsx("inline-block text-[10px] text-ink-300 transition-transform", ab && "rotate-90")}>
                                    ▶
                                  </span>
                                  <span>
                                    {s.nombre}
                                    {s.historial.length > 1 && <span className="ml-2 text-xs text-ink-500">{s.historial.length} movimientos</span>}
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-3">{s.baja ? <span className="text-ink-300">—</span> : <Producto p={s.producto} />}</td>
                              <td className="px-3 py-3">
                                <EtiquetaActiva activa={s.actual.activa} baja={s.baja} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-ink-700">{s.baja ? "—" : fechaCorta(s.actual.fecha_inicio)}</td>
                              <td className="px-3 py-3 text-ink-700">
                                {s.ultimoCambio ? (
                                  <span className="inline-flex flex-wrap items-center gap-2">
                                    {fechaCorta(s.ultimoCambio.fecha_solicitud)}
                                    {reciente && <Etiqueta className="bg-amber-50 text-amber-700">hace {dias} días</Etiqueta>}
                                  </span>
                                ) : (
                                  <span className="text-ink-300">—</span>
                                )}
                              </td>
                            </tr>
                            {ab && (
                              <tr className="bg-ink-50">
                                <td colSpan={5} className="px-5 pb-5 pt-1">
                                  <ol className="ml-1 space-y-4 border-l-2 border-ink-100 pl-5">
                                    {[...s.historial].reverse().map((m) => (
                                      <li key={m.id} className="relative">
                                        <span aria-hidden className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                          <span className="text-xs text-ink-500">{fechaCorta(m.fecha_solicitud)}</span>
                                          <Etiqueta className={COLOR_TIPO[m.tipo]}>{NOMBRE_TIPO[m.tipo]}</Etiqueta>
                                          <span className="font-medium text-ink-900">{textoMovimiento(m)}</span>
                                          {!esConsulta && (
                                            <button type="button" onClick={() => editar(m)} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
                                              Editar
                                            </button>
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs text-ink-500">
                                          {m.estado}
                                          {m.tipo !== "baja" ? ` · ${m.activa}${m.fecha_inicio ? ` desde ${fechaCorta(m.fecha_inicio)}` : ""}` : m.motivo ? ` · ${m.motivo}` : ""}
                                          {m.fecha_confirmacion ? ` · Confirmado a KFC el ${fechaCorta(m.fecha_confirmacion)}` : ""}
                                        </p>
                                        {m.comentarios && <p className="mt-1 text-xs text-ink-700">{m.comentarios}</p>}
                                        {!esConsulta && m.notas && <p className="mt-1 text-xs italic text-ink-500">{m.notas}</p>}
                                      </li>
                                    ))}
                                  </ol>
                                  {!esConsulta && (
                                    <button type="button" onClick={() => nuevoPara(s)} className="mt-4 text-xs font-medium text-brand-600 hover:text-brand-700">
                                      + Nuevo movimiento para esta sucursal
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Grupo>
            );
          })}

        {vista === "movimientos" &&
          grupos.map((g) => {
            const items = g.items as Movimiento[];
            return (
              <Grupo
                key={g.clave || "sin"}
                titulo={nombreGrupo(g.clave)}
                resumen={<span className="font-medium text-ink-700">{items.length} {items.length === 1 ? "movimiento" : "movimientos"}</span>}
                abierto={estaAbierto(g.clave)}
                onAlternar={() => alternar(g.clave)}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[11%]" />
                      <col className="w-[25%]" />
                      <col className="w-[19%]" />
                      <col className="w-[13%]" />
                      <col className="w-[14%]" />
                      <col className={esConsulta ? "w-[18%]" : "w-[12%]"} />
                      {!esConsulta && <col className="w-[6%]" />}
                    </colgroup>
                    <thead>
                      <tr className="text-left text-xs text-ink-500">
                        <th className="px-5 py-2 font-medium">Solicitud</th>
                        <th className="px-3 py-2 font-medium">Sucursal</th>
                        <th className="px-3 py-2 font-medium">Movimiento</th>
                        <th className="px-3 py-2 font-medium">Situación</th>
                        <th className="px-3 py-2 font-medium">Inicio de operación</th>
                        <th className="px-3 py-2 font-medium">Confirmación a KFC</th>
                        {!esConsulta && <th className="px-3 py-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <tr key={m.id} className="border-t border-ink-100 align-top">
                          <td className="whitespace-nowrap px-5 py-3 text-ink-700">{fechaCorta(m.fecha_solicitud)}</td>
                          <td className="px-3 py-3 text-ink-900">
                            {m.sucursal}
                            {(m.comentarios || m.motivo) && <span className="mt-0.5 block text-xs text-ink-500">{[m.motivo, m.comentarios].filter(Boolean).join(". ")}</span>}
                          </td>
                          <td className="px-3 py-3">
                            <Etiqueta className={COLOR_TIPO[m.tipo]}>{NOMBRE_TIPO[m.tipo]}</Etiqueta>
                            <span className="mt-1 block text-ink-700">{m.tipo === "cambio" ? textoMovimiento(m) : m.producto}</span>
                          </td>
                          <td className="px-3 py-3">
                            <EtiquetaActiva activa={m.activa} baja={m.tipo === "baja"} />
                            <span className="mt-1 block text-xs text-ink-500">{m.estado}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink-700">
                            {fechaCorta(m.fecha_inicio)}
                            {m.fecha_inicio && <span className="block text-xs text-ink-500">{mesDe(m.fecha_inicio)}</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink-700">{fechaCorta(m.fecha_confirmacion)}</td>
                          {!esConsulta && (
                            <td className="px-3 py-3 text-right">
                              <button type="button" onClick={() => editar(m)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                                Editar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Grupo>
            );
          })}
      </div>

      {form && (
        <Formulario
          inicial={form.inicial}
          editandoId={form.id}
          sucursales={todas}
          onGuardado={guardado}
          onBorrado={(id) => {
            setMovs((prev) => (prev ?? []).filter((x) => x.id !== id));
            setForm(null);
          }}
          onCerrar={() => setForm(null)}
        />
      )}
    </div>
  );
}
