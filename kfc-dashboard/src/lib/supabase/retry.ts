/** Reintenta una llamada a Supabase si falla por una razón transitoria:
 * problemas de red (ECONNRESET/"fetch failed") o un timeout de consulta
 * (57014 - statement timeout, común en momentos de carga en el plan
 * gratuito). No son errores de la app — es la infraestructura teniendo
 * un hipo momentáneo, así que vale la pena intentarlo de nuevo antes de
 * mostrarle un error a la persona. */
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
      const isTransient = /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|57014|statement timeout/i.test(
        msg
      );
      if (!isTransient || attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Para llamadas que regresan {data, error} en vez de lanzar una excepción
 * (como .rpc de supabase-js) — reintenta también cuando error.code es un
 * timeout, sin necesidad de convertirlo primero en throw/catch. */
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
    const isTransient = /fetch failed|ECONNRESET|ETIMEDOUT|UND_ERR|57014|statement timeout/i.test(
      msg
    );
    last = result;
    if (!isTransient || attempt === retries - 1) return result;
    await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
  }
  return last as { data: T; error: any };
}
