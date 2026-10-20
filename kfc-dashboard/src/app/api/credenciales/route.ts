import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import { sesionActual } from "@/lib/auth-server";
import { COLUMNAS_PUBLICAS, type Movimiento } from "@/lib/altas-bajas";
import { COLUMNAS_CRED, agruparCredenciales, coincide, limpiarCredencial, type Credencial } from "@/lib/credenciales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, max-age=0" };
const MAX_KFC = 20;

/**
 * Credenciales por tienda. KFC (consulta) solo recibe lo que coincide con su
 * búsqueda (mínimo 2 letras o números); el equipo puede ver todo.
 */
export async function GET(req: Request) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const esConsulta = sesion.rol === "consulta";
  if (esConsulta && q.length < 2) return NextResponse.json({ grupos: [], total: 0, requiereBusqueda: true }, { headers: NO_CACHE });

  const supabase = getSupabaseAdmin();
  const [cred, altas] = await Promise.all([
    withRetryResult(() => supabase.from("credenciales").select(COLUMNAS_CRED).order("sucursal").limit(5000)),
    withRetryResult(() => supabase.from("altas_bajas").select(COLUMNAS_PUBLICAS).limit(5000)),
  ]);
  if (cred.error) {
    console.error("Error en GET /api/credenciales:", cred.error);
    return NextResponse.json({ error: cred.error.message }, { status: 500 });
  }
  // Si todavía no existe Altas y bajas, todo se considera vigente
  const movs = (altas.error ? [] : altas.data ?? []) as unknown as Movimiento[];
  let grupos = agruparCredenciales((cred.data ?? []) as unknown as Credencial[], movs);
  if (q) grupos = grupos.filter((g) => coincide(g, q));
  const total = grupos.length;
  if (esConsulta) grupos = grupos.slice(0, MAX_KFC);
  return NextResponse.json({ grupos, total, requiereBusqueda: false }, { headers: NO_CACHE });
}

/** Agrega una credencial (equipo). */
export async function POST(req: Request) {
  try {
    const sesion = await sesionActual();
    if (!sesion || sesion.rol === "consulta") return NextResponse.json({ error: "Sin permiso." }, { status: 403 });
    const { fila, error: invalido } = limpiarCredencial((await req.json()) as Record<string, unknown>, false);
    if (invalido || !fila) return NextResponse.json({ error: invalido }, { status: 400 });
    const { data, error } = await withRetryResult(() =>
      getSupabaseAdmin().from("credenciales").insert({ ...fila, creado_por: sesion.nombre ?? null }).select(COLUMNAS_CRED).single()
    );
    if (error?.code === "23505") return NextResponse.json({ error: "Ya existe ese usuario para ese producto." }, { status: 409 });
    if (error) throw new Error(error.message);
    return NextResponse.json({ credencial: data });
  } catch (err) {
    console.error("Error en POST /api/credenciales:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}
