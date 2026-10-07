import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// Guarda los resultados pesados de la base de datos y los reutiliza mientras
// no se haya subido data nueva. Así la segunda vez que alguien abre una
// pantalla (con los mismos filtros) carga al instante.
//
// "Versión de los datos" = huella de la tabla de cargas (uploads): cambia al
// iniciar una carga y otra vez al cerrarla (cuando se actualiza row_count).
// Si cambia la huella, los resultados guardados dejan de usarse solos.

let memo: { v: string; t: number } | null = null;
let memoNotas: { v: string; t: number } | null = null;
const VIGENCIA_MS = 5000;

export async function versionDatos(): Promise<string> {
  if (memo && Date.now() - memo.t < VIGENCIA_MS) return memo.v;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("uploads")
      .select("created_at,row_count")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error || !data) return "sin-version-" + Date.now();
    const v = data.length + ":" + data.map((r) => `${r.created_at}/${r.row_count}`).join("|");
    memo = { v, t: Date.now() };
    return v;
  } catch {
    // Sin versión confiable: que NO use caché (clave distinta cada vez).
    return "sin-version-" + Date.now();
  }
}

/** Versión de las notas del reporte de devoluciones (van dentro del reporte). */
export async function versionNotas(): Promise<string> {
  if (memoNotas && Date.now() - memoNotas.t < VIGENCIA_MS) return memoNotas.v;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("dev_notas")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) return "sin-version-" + Date.now();
    const v = data?.[0]?.updated_at ?? "vacio";
    memoNotas = { v, t: Date.now() };
    return v;
  } catch {
    return "sin-version-" + Date.now();
  }
}

/**
 * Ejecuta `fn` y guarda el resultado. `params` identifica la consulta
 * (filtros, fechas). Si `fn` lanza error, NO se guarda nada.
 */
export async function conCache<T>(
  nombre: string,
  params: unknown,
  fn: () => Promise<T>,
  opciones: { notas?: boolean; segundos?: number } = {}
): Promise<T> {
  const [v, vn] = await Promise.all([versionDatos(), opciones.notas ? versionNotas() : Promise.resolve("")]);
  const llave = JSON.stringify(params ?? null);
  const guardada = unstable_cache(async () => fn(), ["kfc", nombre, v, vn, llave], {
    revalidate: opciones.segundos ?? 6 * 3600,
  });
  return guardada();
}
