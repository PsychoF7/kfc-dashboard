"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ESTATUS,
  PANTALLAS,
  PRIORIDADES,
  type Comentario,
  type EstatusReporte,
  type PrioridadReporte,
  type Reporte,
  type TipoReporte,
} from "@/lib/reportes";

const campo =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const botonPrimario =
  "rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50";
const botonSecundario =
  "rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50";

const TEXTOS: Record<TipoReporte, { titulo: string; subtitulo: string; nuevo: string; vacio: string; singular: string }> = {
  bug: {
    titulo: "Bugs",
    subtitulo: "Fallas o errores que se han encontrado en el tablero, con su estatus y seguimiento.",
    nuevo: "Nuevo bug",
    vacio: "Aún no hay bugs registrados.",
    singular: "bug",
  },
  desarrollo: {
    titulo: "Solicitudes de desarrollo",
    subtitulo: "Mejoras y cosas nuevas que se han pedido para el tablero, con su estatus y seguimiento.",
    nuevo: "Nueva solicitud",
    vacio: "Aún no hay solicitudes registradas.",
    singular: "solicitud",
  },
};

const ETIQUETA_ESTATUS: Record<EstatusReporte, string> = Object.fromEntries(ESTATUS.map((e) => [e.id, e.label])) as Record<
  EstatusReporte,
  string
>;

const CLASE_ESTATUS: Record<EstatusReporte, string> = {
  nuevo: "bg-brand-50 text-brand-700",
  en_proceso: "bg-peri-50 text-ink-800",
  en_espera: "bg-warning-bg text-warning",
  resuelto: "bg-success-bg text-success",
};

const CLASE_PRIORIDAD: Record<PrioridadReporte, string> = {
  alta: "bg-danger-bg text-danger",
  media: "bg-warning-bg text-warning",
  baja: "bg-ink-50 text-ink-500",
};

function hace(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

async function llamar<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "No se pudo completar la acción.");
  return json as T;
}

const nuevasRespuestas = (r: Reporte) => Math.max(0, (r.slack_respuestas ?? 0) - (r.slack_visto_respuestas ?? 0));

// ---------------------------------------------------------------------
// Formulario de reporte nuevo
// ---------------------------------------------------------------------
function FormularioNuevo({
  tipo,
  autor,
  onAutor,
  onCreado,
  onCancelar,
}: {
  tipo: TipoReporte;
  autor: string;
  onAutor: (v: string) => void;
  onCreado: (r: Reporte) => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pantalla, setPantalla] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadReporte>("media");
  const [slack, setSlack] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const { reporte } = await llamar<{ reporte: Reporte }>("/api/reportes", {
        method: "POST",
        body: JSON.stringify({ tipo, titulo, descripcion, pantalla, prioridad, slack_url: slack, reportado_por: autor }),
      });
      onCreado(reporte);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setGuardando(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-ink-100 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink-900">{TEXTOS[tipo].nuevo}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-xs text-ink-500">Título *</span>
          <input className={clsx(campo, "mt-1 w-full")} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Una frase corta que se entienda sola" />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs text-ink-500">Descripción</span>
          <textarea className={clsx(campo, "mt-1 w-full")} rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={tipo === "bug" ? "Qué pasó, en qué pantalla, qué esperabas que pasara" : "Qué se necesita y para qué"} />
        </label>
        <label>
          <span className="text-xs text-ink-500">Pantalla</span>
          <select className={clsx(campo, "mt-1 w-full")} value={pantalla} onChange={(e) => setPantalla(e.target.value)}>
            <option value="">Sin especificar</option>
            {PANTALLAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-ink-500">Prioridad</span>
          <select className={clsx(campo, "mt-1 w-full")} value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadReporte)}>
            {PRIORIDADES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-ink-500">Link de Slack (donde se reportó)</span>
          <input className={clsx(campo, "mt-1 w-full")} value={slack} onChange={(e) => setSlack(e.target.value)} placeholder="https://…slack.com/archives/…" />
        </label>
        <label>
          <span className="text-xs text-ink-500">Tu nombre</span>
          <input className={clsx(campo, "mt-1 w-full")} value={autor} onChange={(e) => onAutor(e.target.value)} maxLength={100} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button className={botonPrimario} onClick={guardar} disabled={guardando || !titulo.trim()}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button className={botonSecundario} onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Detalle de un reporte (se abre al dar clic)
// ---------------------------------------------------------------------
function Detalle({
  r,
  slackOk,
  autor,
  onAutor,
  onCambio,
  onBorrado,
}: {
  r: Reporte;
  slackOk: boolean;
  autor: string;
  onAutor: (v: string) => void;
  onCambio: (r: Reporte, comentariosN?: number) => void;
  onBorrado: (id: number) => void;
}) {
  const [titulo, setTitulo] = useState(r.titulo);
  const [descripcion, setDescripcion] = useState(r.descripcion ?? "");
  const [pantalla, setPantalla] = useState(r.pantalla ?? "");
  const [slackUrl, setSlackUrl] = useState(r.slack_url ?? "");
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [nuevoCom, setNuevoCom] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sucio =
    titulo.trim() !== r.titulo ||
    descripcion.trim() !== (r.descripcion ?? "") ||
    pantalla !== (r.pantalla ?? "") ||
    slackUrl.trim() !== (r.slack_url ?? "");

  useEffect(() => {
    let vigente = true;
    llamar<{ comentarios: Comentario[] }>(`/api/reportes/${r.id}/comentarios`)
      .then((j) => vigente && setComentarios(j.comentarios))
      .catch(() => vigente && setComentarios([]));
    return () => {
      vigente = false;
    };
  }, [r.id]);

  async function accion<T>(nombre: string, fn: () => Promise<T>): Promise<T | undefined> {
    setOcupado(nombre);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(null);
    }
  }

  const patch = (cuerpo: Record<string, unknown>) =>
    llamar<{ reporte: Reporte }>(`/api/reportes/${r.id}`, { method: "PATCH", body: JSON.stringify(cuerpo) });

  async function guardarCambios() {
    const j = await accion("guardar", () => patch({ titulo, descripcion, pantalla, slack_url: slackUrl }));
    if (j) onCambio(j.reporte);
  }
  async function revisar() {
    const j = await accion("slack", () => llamar<{ reporte: Reporte }>(`/api/reportes/${r.id}/slack`, { method: "POST" }));
    if (j) onCambio(j.reporte);
  }
  async function marcarVisto() {
    const j = await accion("visto", () => patch({ marcar_visto: true }));
    if (j) onCambio(j.reporte);
  }
  async function marcarResuelto() {
    const j = await accion("resuelto", () => patch({ estatus: "resuelto" }));
    if (j) onCambio(j.reporte);
  }
  async function comentar() {
    const j = await accion("comentar", () =>
      llamar<{ comentario: Comentario }>(`/api/reportes/${r.id}/comentarios`, {
        method: "POST",
        body: JSON.stringify({ texto: nuevoCom, autor }),
      })
    );
    if (j) {
      const lista = [...(comentarios ?? []), j.comentario];
      setComentarios(lista);
      setNuevoCom("");
      onCambio(r, lista.length);
    }
  }
  async function borrar() {
    if (!window.confirm("¿Borrar este reporte y sus comentarios? No se puede deshacer.")) return;
    const j = await accion("borrar", () => llamar<{ ok: boolean }>(`/api/reportes/${r.id}`, { method: "DELETE" }));
    if (j) onBorrado(r.id);
  }

  const nuevas = nuevasRespuestas(r);

  return (
    <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-xs text-ink-500">Título</span>
          <input className={clsx(campo, "mt-1 w-full")} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs text-ink-500">Descripción</span>
          <textarea className={clsx(campo, "mt-1 w-full")} rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <label>
          <span className="text-xs text-ink-500">Pantalla</span>
          <select className={clsx(campo, "mt-1 w-full")} value={pantalla} onChange={(e) => setPantalla(e.target.value)}>
            <option value="">Sin especificar</option>
            {PANTALLAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-ink-500">Link de Slack</span>
          <input className={clsx(campo, "mt-1 w-full")} value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://…slack.com/archives/…" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className={botonPrimario} onClick={guardarCambios} disabled={!sucio || ocupado !== null || !titulo.trim()}>
          {ocupado === "guardar" ? "Guardando…" : "Guardar cambios"}
        </button>
        <p className="text-xs text-ink-500">
          Reportado {hace(r.created_at)}
          {r.reportado_por ? ` por ${r.reportado_por}` : ""}
          {r.resuelto_en ? ` · resuelto ${hace(r.resuelto_en)}` : ""}
        </p>
      </div>

      {/* Seguimiento en Slack */}
      {r.slack_url && (
        <div className="mt-5 rounded-lg border border-ink-100 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-900">Seguimiento en Slack</p>
            <div className="flex flex-wrap gap-2">
              <a href={r.slack_url} target="_blank" rel="noreferrer" className={clsx(botonSecundario, "inline-block")}>
                Abrir en Slack ↗
              </a>
              {slackOk && (
                <button className={botonSecundario} onClick={revisar} disabled={ocupado !== null || sucio}>
                  {ocupado === "slack" ? "Revisando…" : "Revisar ahora"}
                </button>
              )}
              {nuevas > 0 && (
                <button className={botonSecundario} onClick={marcarVisto} disabled={ocupado !== null}>
                  Ya vi las respuestas
                </button>
              )}
            </div>
          </div>
          {!slackOk && (
            <p className="mt-2 text-xs text-ink-500">
              Slack aún no está conectado al tablero, así que aquí no se pueden ver las respuestas. El link sí se guarda y abre en un clic.
            </p>
          )}
          {slackOk && r.slack_error && <p className="mt-2 text-sm text-danger">{r.slack_error}</p>}
          {slackOk && !r.slack_error && r.slack_revisado_en && (
            <div className="mt-2 text-sm text-ink-700">
              <p>
                💬 <span className="font-medium">{r.slack_respuestas ?? 0}</span> {r.slack_respuestas === 1 ? "respuesta" : "respuestas"}
                {nuevas > 0 && <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">+{nuevas} nuevas</span>}
                <span className="ml-2 text-xs text-ink-500">revisado {hace(r.slack_revisado_en)}</span>
              </p>
              {r.slack_ultimo_texto && (
                <p className="mt-1 text-ink-500">
                  Última {hace(r.slack_ultima_respuesta)}
                  {r.slack_ultimo_autor ? ` · ${r.slack_ultimo_autor}` : ""}: «{r.slack_ultimo_texto}»
                </p>
              )}
              {r.slack_resuelto && r.estatus !== "resuelto" && (
                <p className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-success-bg px-3 py-2 text-success">
                  ✅ En Slack lo marcaron como listo.
                  <button className="font-semibold underline" onClick={marcarResuelto} disabled={ocupado !== null}>
                    Marcar como resuelto aquí
                  </button>
                </p>
              )}
            </div>
          )}
          {slackOk && !r.slack_error && !r.slack_revisado_en && (
            <p className="mt-2 text-xs text-ink-500">Todavía no se ha revisado. Da clic en «Revisar ahora».</p>
          )}
        </div>
      )}

      {/* Comentarios */}
      <div className="mt-5">
        <p className="text-sm font-medium text-ink-900">Comentarios</p>
        {comentarios === null ? (
          <p className="mt-2 text-xs text-ink-500">Cargando…</p>
        ) : comentarios.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">Sin comentarios todavía.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {comentarios.map((c) => (
              <li key={c.id} className="rounded-lg bg-white px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap text-ink-900">{c.texto}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {c.autor ?? "Sin nombre"} · {hace(c.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <textarea className={clsx(campo, "flex-1")} rows={2} value={nuevoCom} onChange={(e) => setNuevoCom(e.target.value)} placeholder="Escribe un comentario o una actualización…" />
          <div className="flex flex-col gap-2 sm:w-44">
            <input className={campo} value={autor} onChange={(e) => onAutor(e.target.value)} placeholder="Tu nombre" maxLength={100} />
            <button className={botonPrimario} onClick={comentar} disabled={!nuevoCom.trim() || ocupado !== null}>
              {ocupado === "comentar" ? "Enviando…" : "Comentar"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 text-right">
        <button className="text-xs text-danger hover:underline" onClick={borrar} disabled={ocupado !== null}>
          Borrar reporte
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Pantalla completa
// ---------------------------------------------------------------------
type FiltroEstatus = "abiertos" | "todos" | EstatusReporte;

export default function Reportes({ tipo }: { tipo: TipoReporte }) {
  const t = TEXTOS[tipo];
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [conteoCom, setConteoCom] = useState<Record<number, number>>({});
  const [slackOk, setSlackOk] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstatus>("abiertos");
  const [busqueda, setBusqueda] = useState("");
  const [fPantalla, setFPantalla] = useState("");
  const [fPrioridad, setFPrioridad] = useState("");
  const [abierto, setAbierto] = useState<number | null>(null);
  const [creando, setCreando] = useState(false);
  const [autor, setAutor] = useState("");
  const [revisandoTodos, setRevisandoTodos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Reportes que acabas de cambiar de estatus: se quedan a la vista hasta que cambies de filtro
  const [mantener, setMantener] = useState<number[]>([]);

  // El nombre se recuerda en este navegador para no escribirlo cada vez
  useEffect(() => {
    try {
      setAutor(localStorage.getItem("kfc-autor") ?? "");
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const cambiarAutor = useCallback((v: string) => {
    setAutor(v);
    try {
      localStorage.setItem("kfc-autor", v);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const j = await llamar<{ reportes: Reporte[]; comentarios: Record<number, number>; slack_configurado: boolean }>(
        `/api/reportes?tipo=${tipo}`
      );
      setReportes(j.reportes);
      setConteoCom(j.comentarios);
      setSlackOk(j.slack_configurado);
    } catch (e) {
      setError(
        e instanceof Error && /relation|does not exist|schema cache/i.test(e.message)
          ? "Falta crear las tablas en Supabase. Corre el archivo reportes.sql en el SQL Editor."
          : e instanceof Error
            ? e.message
            : "No se pudo cargar."
      );
    } finally {
      setCargando(false);
    }
  }, [tipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const conteo = useMemo(() => {
    const c = { abiertos: 0, todos: reportes.length, nuevo: 0, en_proceso: 0, en_espera: 0, resuelto: 0 };
    for (const r of reportes) {
      c[r.estatus]++;
      if (r.estatus !== "resuelto") c.abiertos++;
    }
    return c;
  }, [reportes]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const peso = { alta: 0, media: 1, baja: 2 } as const;
    return reportes
      .filter(
        (r) =>
          mantener.includes(r.id) ||
          r.id === abierto ||
          (filtro === "todos" ? true : filtro === "abiertos" ? r.estatus !== "resuelto" : r.estatus === filtro)
      )
      .filter((r) => !fPantalla || r.pantalla === fPantalla)
      .filter((r) => !fPrioridad || r.prioridad === fPrioridad)
      .filter((r) => !q || `${r.titulo} ${r.descripcion ?? ""} ${r.reportado_por ?? ""}`.toLowerCase().includes(q))
      // Abiertos: lo más urgente primero; el resto, lo más reciente primero
      .sort((a, b) =>
        filtro === "abiertos" || filtro === "nuevo" || filtro === "en_proceso" || filtro === "en_espera"
          ? peso[a.prioridad] - peso[b.prioridad] || b.created_at.localeCompare(a.created_at)
          : b.created_at.localeCompare(a.created_at)
      );
  }, [reportes, filtro, busqueda, fPantalla, fPrioridad, mantener, abierto]);

  function reemplazar(r: Reporte, comentariosN?: number) {
    setReportes((lista) => lista.map((x) => (x.id === r.id ? r : x)));
    if (comentariosN != null) setConteoCom((c) => ({ ...c, [r.id]: comentariosN }));
  }

  async function cambiarEstatus(r: Reporte, estatus: EstatusReporte) {
    reemplazar({ ...r, estatus });
    setMantener((m) => (m.includes(r.id) ? m : [...m, r.id]));
    try {
      const j = await llamar<{ reporte: Reporte }>(`/api/reportes/${r.id}`, { method: "PATCH", body: JSON.stringify({ estatus }) });
      reemplazar(j.reporte);
    } catch (e) {
      reemplazar(r);
      setAviso(e instanceof Error ? e.message : "No se pudo cambiar el estatus.");
    }
  }
  async function cambiarPrioridad(r: Reporte, prioridad: PrioridadReporte) {
    reemplazar({ ...r, prioridad });
    try {
      const j = await llamar<{ reporte: Reporte }>(`/api/reportes/${r.id}`, { method: "PATCH", body: JSON.stringify({ prioridad }) });
      reemplazar(j.reporte);
    } catch (e) {
      reemplazar(r);
      setAviso(e instanceof Error ? e.message : "No se pudo cambiar la prioridad.");
    }
  }

  async function revisarTodos() {
    setRevisandoTodos(true);
    setAviso(null);
    try {
      const j = await llamar<{ revisados: number }>("/api/reportes/slack", { method: "POST", body: JSON.stringify({ tipo }) });
      await cargar();
      setAviso(j.revisados === 0 ? "No hay reportes abiertos con link de Slack." : `Listo: se revisaron ${j.revisados} en Slack.`);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo revisar Slack.");
    } finally {
      setRevisandoTodos(false);
    }
  }

  const chips: { id: FiltroEstatus; label: string; n: number }[] = [
    { id: "abiertos", label: "Abiertos", n: conteo.abiertos },
    { id: "nuevo", label: "Nuevos", n: conteo.nuevo },
    { id: "en_proceso", label: "En proceso", n: conteo.en_proceso },
    { id: "en_espera", label: "En espera", n: conteo.en_espera },
    { id: "resuelto", label: "Resueltos", n: conteo.resuelto },
    { id: "todos", label: "Todos", n: conteo.todos },
  ];
  const conLink = reportes.some((r) => r.slack_url && r.estatus !== "resuelto");

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">{t.titulo}</h1>
          <p className="mt-1 text-sm text-ink-500">{t.subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {slackOk && conLink && (
            <button className={clsx(botonSecundario, "py-2.5")} onClick={revisarTodos} disabled={revisandoTodos}>
              {revisandoTodos ? "Revisando Slack…" : "Revisar Slack de los abiertos"}
            </button>
          )}
          <button className={botonPrimario} onClick={() => setCreando(true)} disabled={creando}>
            + {t.nuevo}
          </button>
        </div>
      </div>

      {aviso && (
        <p className="mt-4 rounded-lg bg-ink-50 px-4 py-2 text-sm text-ink-700">
          {aviso}{" "}
          <button className="ml-2 text-xs text-ink-500 underline" onClick={() => setAviso(null)}>
            cerrar
          </button>
        </p>
      )}

      {creando && (
        <FormularioNuevo
          tipo={tipo}
          autor={autor}
          onAutor={cambiarAutor}
          onCancelar={() => setCreando(false)}
          onCreado={(r) => {
            setReportes((l) => [r, ...l]);
            setCreando(false);
            setFiltro("abiertos");
            setAbierto(r.id);
          }}
        />
      )}

      {error && <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {!error && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setFiltro(c.id);
                  setMantener([]);
                }}
                className={clsx(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filtro === c.id ? "border-brand-500 bg-brand-500 text-white" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
                )}
              >
                {c.label} <span className={clsx("ml-1 text-xs", filtro === c.id ? "text-white/80" : "text-ink-500")}>{c.n}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <input className={clsx(campo, "w-full sm:w-72")} placeholder="Buscar por título o descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <select className={campo} value={fPantalla} onChange={(e) => setFPantalla(e.target.value)}>
              <option value="">Todas las pantallas</option>
              {PANTALLAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select className={campo} value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)}>
              <option value="">Toda prioridad</option>
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
            {cargando ? (
              <p className="px-5 py-8 text-sm text-ink-500">Cargando…</p>
            ) : visibles.length === 0 ? (
              <p className="px-5 py-8 text-sm text-ink-500">
                {reportes.length === 0 ? t.vacio : "Ningún reporte coincide con estos filtros."}
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {visibles.map((r) => {
                  const nuevas = nuevasRespuestas(r);
                  const abiertoEste = abierto === r.id;
                  return (
                    <li key={r.id}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                        <button className="min-w-0 flex-1 basis-64 text-left" onClick={() => setAbierto(abiertoEste ? null : r.id)} aria-expanded={abiertoEste}>
                          <p className={clsx("truncate text-sm font-semibold", r.estatus === "resuelto" ? "text-ink-500 line-through" : "text-ink-900")}>{r.titulo}</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {[r.pantalla, r.reportado_por, hace(r.created_at)].filter(Boolean).join(" · ")}
                            {(conteoCom[r.id] ?? 0) > 0 && ` · 💬 ${conteoCom[r.id]} comentario${conteoCom[r.id] === 1 ? "" : "s"}`}
                          </p>
                        </button>
                        {nuevas > 0 && (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700" title="Respuestas nuevas en Slack">
                            Slack +{nuevas}
                          </span>
                        )}
                        {r.slack_resuelto && r.estatus !== "resuelto" && (
                          <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success" title="En Slack lo marcaron como listo">
                            ✅ listo en Slack
                          </span>
                        )}
                        <select
                          aria-label="Prioridad"
                          value={r.prioridad}
                          onChange={(e) => cambiarPrioridad(r, e.target.value as PrioridadReporte)}
                          className={clsx("rounded-full border-0 px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500", CLASE_PRIORIDAD[r.prioridad])}
                        >
                          {PRIORIDADES.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Estatus"
                          value={r.estatus}
                          onChange={(e) => cambiarEstatus(r, e.target.value as EstatusReporte)}
                          className={clsx("rounded-full border-0 px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500", CLASE_ESTATUS[r.estatus])}
                        >
                          {ESTATUS.map((e) => (
                            <option key={e.id} value={e.id}>
                              {ETIQUETA_ESTATUS[e.id]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {abiertoEste && <Detalle r={r} slackOk={slackOk} autor={autor} onAutor={cambiarAutor} onCambio={reemplazar} onBorrado={(id) => { setReportes((l) => l.filter((x) => x.id !== id)); setAbierto(null); }} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
