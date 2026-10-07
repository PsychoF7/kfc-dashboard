/** Reintenta una llamada a Supabase si falla por una razón transitoria:
 * problemas de red (ECONNRESET/"fetch failed") o un desfase de reloj de
 * Supabase ("JWT issued at future"), que se corrigen solos en uno o dos
 * segundos.
 *
 * Un timeout de consulta (57014 - statement timeout) es distinto: si la
 * consulta ya tardó lo máximo permitido, repetirla 3 veces solo triplica
 * la espera antes de ver el error. Se reintenta UNA sola vez (a veces la
 * segunda corre más rápido porque la base ya "calentó") y luego se avisa. */
const RE_RED = /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|JWT issued at future|PGRST303/i;
const RE_TIMEOUT = /57014|statement timeout/i;

/** ¿Cuántos intentos en total se permiten para este error? */
function intentosPermitidos(msg: string, retries: number): number {
  if (RE_RED.test(msg)) return retries;
  if (RE_TIMEOUT.test(msg)) return Math.min(2, retries);
  return 1;
}

export async function withRetry<T>(
  fn: () => PromiseLike<T>,
  retries = 3,
  baseDelayMs = 800
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const anyErr = err as any;
      const msg = `${anyErr?.message ?? ""} ${anyErr?.code ?? ""} ${String(anyErr?.cause ?? "")}`;
      if (attempt + 1 >= intentosPermitidos(msg, retries)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Para llamadas que regresan {data, error} en vez de lanzar una excepción
 * (como .rpc de supabase-js) — reintenta con las mismas reglas de arriba. */
export async function withRetryResult<T>(
  fn: () => PromiseLike<{ data: T; error: any }>,
  retries = 3,
  baseDelayMs = 800
): Promise<{ data: T; error: any }> {
  let last: { data: T; error: any } | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    const result = await fn();
    if (!result.error) return result;
    const msg = `${result.error?.message ?? ""} ${result.error?.code ?? ""}`;
    last = result;
    if (attempt + 1 >= intentosPermitidos(msg, retries)) return result;
    await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
  }
  return last as { data: T; error: any };
}
