import type { SupabaseClient } from "@supabase/supabase-js";
import { withRetryResult } from "@/lib/supabase/retry";
import { COLUMNAS_REPORTE, type Reporte } from "@/lib/reportes";
import { ErrorSlack, leerHilo, leerLinkSlack, slackConfigurado } from "@/lib/slack";

/** Revisa el hilo de Slack de un reporte y guarda el resumen. Nunca lanza: si falla, guarda el motivo. */
export async function revisarSlack(supabase: SupabaseClient, r: Pick<Reporte, "id" | "slack_url">) {
  const ahora = new Date().toISOString();
  let cambios: Record<string, unknown>;
  const ref = r.slack_url ? leerLinkSlack(r.slack_url) : null;
  if (!r.slack_url) {
    cambios = { slack_error: null };
  } else if (!ref) {
    cambios = { slack_error: "El link no parece ser de un mensaje de Slack (debe verse como …slack.com/archives/…/p…).", slack_revisado_en: ahora };
  } else if (!slackConfigurado()) {
    cambios = { slack_error: "Slack todavía no está conectado al tablero.", slack_revisado_en: ahora };
  } else {
    try {
      const h = await leerHilo(ref);
      cambios = {
        slack_respuestas: h.respuestas,
        slack_ultima_respuesta: h.ultimaRespuesta,
        slack_ultimo_autor: h.ultimoAutor,
        slack_ultimo_texto: h.ultimoTexto,
        slack_resuelto: h.resuelto,
        slack_error: null,
        slack_revisado_en: ahora,
      };
    } catch (err) {
      cambios = {
        slack_error: err instanceof ErrorSlack ? err.message : "No se pudo revisar Slack.",
        slack_revisado_en: ahora,
      };
    }
  }
  const { data, error } = await withRetryResult(() =>
    supabase.from("reportes").update(cambios).eq("id", r.id).select(COLUMNAS_REPORTE).single()
  );
  if (error) throw new Error(error.message);
  return data as unknown as Reporte;
}
