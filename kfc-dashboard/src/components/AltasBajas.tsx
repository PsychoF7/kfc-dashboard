"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import KpiCard from "@/components/KpiCard";
import { useEsConsulta } from "@/components/Sesion";
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
export default function AltasBajas() {
  const esConsulta = useEsConsulta();
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"sucursales" | "movimientos">("sucursales");
  const [buscar, setBuscar] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fProducto, setFProducto] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fActiva, setFActiva] = useState("");
  const [fMes, setFMes] = useState("");
  const [soloCambios, setSoloCambios] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState<{ inicial: Borrador; id: number | null } | null>(null);

  useEffect(() => {
    fetch("/api/altas-bajas", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error);
        setMovs(d.movimientos);
      })
      .catch((e) => setError(e.message ?? "No se pudieron cargar los movimientos."));
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
  const coincide = (m: Movimiento) =>
    (!q || m.sucursal.toLowerCase().includes(q) || (m.comentarios ?? "").toLowerCase().includes(q)) &&
    (!fTipo || m.tipo === fTipo) &&
    (!fProducto || m.producto === fProducto || m.producto_anterior === fProducto) &&
    (!fEstado || m.estado === fEstado) &&
    (!fActiva || m.activa === fActiva) &&
    (!fMes || claveMes(m.fecha_solicitud) === fMes);

  const movsFiltrados = useMemo(() => (movs ?? []).filter(coincide), [movs, q, fTipo, fProducto, fEstado, fActiva, fMes]); // eslint-disable-line react-hooks/exhaustive-deps

  const sucursalesFiltradas = useMemo(() => {
    return todas.filter((s) => {
      if (soloCambios && s.cambios === 0) return false;
      if (q && !s.nombre.toLowerCase().includes(q) && !s.historial.some((m) => (m.comentarios ?? "").toLowerCase().includes(q))) return false;
      if (fProducto && s.producto !== fProducto) return false;
      if (fTipo === "baja" && !s.baja) return false;
      if (fTipo === "alta" && s.baja) return false;
      if (fActiva === "En operación" && (s.baja || s.actual.activa !== "En operación")) return false;
      if (fActiva === "No iniciada" && (s.baja || s.actual.activa === "En operación")) return false;
      if (fEstado && s.actual.estado !== fEstado) return false;
      if (fMes && !s.historial.some((m) => claveMes(m.fecha_solicitud) === fMes)) return false;
      return true;
    });
  }, [todas, q, soloCambios, fProducto, fTipo, fActiva, fEstado, fMes]);

  function guardado(m: Movimiento) {
    setMovs((prev) => {
      const lista = prev ?? [];
      return lista.some((x) => x.id === m.id) ? lista.map((x) => (x.id === m.id ? m : x)) : [m, ...lista];
    });
    setForm(null);
  }

  const hayFiltros = !!(buscar || fTipo || fProducto || fEstado || fActiva || fMes || soloCambios);
  const limpiar = () => {
    setBuscar("");
    setFTipo("");
    setFProducto("");
    setFEstado("");
    setFActiva("");
    setFMes("");
    setSoloCambios(false);
  };

  const editar = (m: Movimiento) => setForm({ inicial: desdeMovimiento(m), id: m.id });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">Altas y bajas</h1>
        {!esConsulta && (
          <button onClick={() => setForm({ inicial: borradorVacio(), id: null })} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + Nuevo movimiento
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Sucursales dadas de alta" value={movs ? String(kpi.sucursales) : "…"} />
        <KpiCard label="En operación" value={movs ? String(kpi.operando) : "…"} accent="success" />
        <KpiCard label="Por iniciar" value={movs ? String(kpi.porIniciar) : "…"} accent="warning" />
        <KpiCard label="Cambios de producto" value={movs ? String(kpi.cambios) : "…"} />
        <KpiCard label="Bajas" value={movs ? String(kpi.bajas) : "…"} accent={kpi.bajas > 0 ? "danger" : "default"} />
      </div>

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
          {hayFiltros && (
            <button onClick={limpiar} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <input type="search" aria-label="Buscar sucursal" placeholder="Buscar sucursal" value={buscar} onChange={(e) => setBuscar(e.target.value)} className={clsx(campo, "col-span-2 md:col-span-3")} />
          <select aria-label="Tipo" className={campo} value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Tipo: todos</option>
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
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
          <select aria-label="Activa" className={campo} value={fActiva} onChange={(e) => setFActiva(e.target.value)}>
            <option value="">Activa: todas</option>
            {ACTIVAS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select aria-label="Mes de solicitud" className={campo} value={fMes} onChange={(e) => setFMes(e.target.value)}>
            <option value="">Mes: todos</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {mesDe(m + "-01")}
              </option>
            ))}
          </select>
        </div>
        {vista === "sucursales" && (
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
            Solo con cambios de producto
          </label>
        )}
      </div>

      {/* ---------- Por sucursal ---------- */}
      {vista === "sucursales" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Producto actual</th>
                  <th className="px-4 py-3 font-medium">Situación</th>
                  <th className="px-4 py-3 font-medium">Inicio de operación</th>
                  <th className="px-4 py-3 text-right font-medium">Movimientos</th>
                  <th className="px-4 py-3 font-medium">Último cambio de producto</th>
                </tr>
              </thead>
              <tbody>
                {!movs && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                      Cargando…
                    </td>
                  </tr>
                )}
                {sucursalesFiltradas.map((s) => {
                  const abiertaAhora = abierta === s.clave;
                  const dias = s.ultimoCambio ? diasDesde(s.ultimoCambio.fecha_solicitud) : null;
                  const reciente = dias != null && dias < DIAS_ENTRE_CAMBIOS;
                  return (
                    <Fragment key={s.clave}>
                      <tr className="cursor-pointer border-b border-ink-100 hover:bg-ink-50" onClick={() => setAbierta(abiertaAhora ? null : s.clave)}>
                        <td className="px-4 py-2 text-ink-900">
                          <button type="button" aria-expanded={abiertaAhora} className="flex items-center gap-2 text-left" onClick={(e) => { e.stopPropagation(); setAbierta(abiertaAhora ? null : s.clave); }}>
                            <span aria-hidden className={clsx("inline-block text-[10px] text-ink-500 transition-transform", abiertaAhora && "rotate-90")}>
                              ▶
                            </span>
                            {s.nombre}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-ink-700">{s.baja ? "—" : s.producto}</td>
                        <td className="px-4 py-2">
                          <EtiquetaActiva activa={s.actual.activa} baja={s.baja} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-ink-700">{s.baja ? "—" : fechaCorta(s.actual.fecha_inicio)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-ink-700">{s.historial.length}</td>
                        <td className="px-4 py-2 text-ink-700">
                          {s.ultimoCambio ? (
                            <span className="inline-flex items-center gap-2">
                              {fechaCorta(s.ultimoCambio.fecha_solicitud)}
                              {reciente && <Etiqueta className="bg-amber-50 text-amber-700">hace {dias} días</Etiqueta>}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                      {abiertaAhora && (
                        <tr className="border-b border-ink-100 bg-ink-50/50">
                          <td colSpan={6} className="px-4 py-4">
                            <ol className="space-y-3">
                              {s.historial.map((m) => (
                                <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1">
                                  <span className="w-28 flex-shrink-0 text-xs text-ink-500">{fechaCorta(m.fecha_solicitud)}</span>
                                  <Etiqueta className={COLOR_TIPO[m.tipo]}>{NOMBRE_TIPO[m.tipo]}</Etiqueta>
                                  <span className="font-medium text-ink-900">{textoMovimiento(m)}</span>
                                  <span className="text-xs text-ink-500">
                                    {m.estado}
                                    {m.tipo !== "baja" ? ` · ${m.activa}${m.fecha_inicio ? ` desde ${fechaCorta(m.fecha_inicio)}` : ""}` : m.motivo ? ` · ${m.motivo}` : ""}
                                  </span>
                                  {m.fecha_confirmacion && <span className="text-xs text-ink-500">Confirmado a KFC el {fechaCorta(m.fecha_confirmacion)}</span>}
                                  {m.comentarios && <span className="w-full pl-32 text-xs text-ink-700">{m.comentarios}</span>}
                                  {!esConsulta && m.notas && <span className="w-full pl-32 text-xs italic text-ink-500">{m.notas}</span>}
                                  {!esConsulta && (
                                    <button type="button" onClick={() => editar(m)} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">
                                      Editar
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ol>
                            {!esConsulta && (
                              <button
                                type="button"
                                onClick={() => setForm({ inicial: { ...borradorVacio(), sucursal: s.nombre, tipo: s.baja ? "alta" : "cambio", producto_anterior: s.baja ? "" : s.producto, producto: s.baja ? "Delivery" : s.producto === "Delivery" ? "Flotilla" : "Delivery" }, id: null })}
                                className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
                              >
                                + Nuevo movimiento para esta sucursal
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {movs && sucursalesFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                      Sin sucursales con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Movimientos ---------- */}
      {vista === "movimientos" && (
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                  <th className="px-4 py-3 font-medium">Solicitud</th>
                  <th className="px-4 py-3 font-medium">Sucursal</th>
                  <th className="px-4 py-3 font-medium">Movimiento</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Activa</th>
                  <th className="px-4 py-3 font-medium">Inicio de operación</th>
                  <th className="px-4 py-3 font-medium">Mes de operación</th>
                  <th className="px-4 py-3 font-medium">Confirmación a KFC</th>
                  <th className="px-4 py-3 font-medium">Comentarios</th>
                  {!esConsulta && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {!movs && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-ink-500">
                      Cargando…
                    </td>
                  </tr>
                )}
                {movsFiltrados.map((m) => (
                  <tr key={m.id} className="border-b border-ink-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-700">{fechaCorta(m.fecha_solicitud)}</td>
                    <td className="px-4 py-2 text-ink-900">{m.sucursal}</td>
                    <td className="px-4 py-2">
                      <Etiqueta className={COLOR_TIPO[m.tipo]}>{NOMBRE_TIPO[m.tipo]}</Etiqueta>
                      <span className="ml-2 whitespace-nowrap text-ink-700">{m.tipo === "alta" ? m.producto : m.tipo === "baja" ? m.producto : textoMovimiento(m)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-700">{m.estado}</td>
                    <td className="px-4 py-2">{m.tipo === "baja" ? <EtiquetaActiva activa={m.activa} baja /> : <EtiquetaActiva activa={m.activa} />}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-700">{fechaCorta(m.fecha_inicio)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-700">{mesDe(m.fecha_inicio)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-700">{fechaCorta(m.fecha_confirmacion)}</td>
                    <td className="max-w-xs px-4 py-2 text-ink-700">{m.motivo ? `${m.motivo}. ` : ""}{m.comentarios ?? ""}</td>
                    {!esConsulta && (
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => editar(m)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {movs && movsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-ink-500">
                      Sin movimientos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
