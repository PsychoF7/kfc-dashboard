import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";
import {
  AjusteFactura,
  CalculoFactura,
  OrdenesDia,
  TiendaBase,
  TipoTienda,
  calcularFactura,
  mesAnterior,
  mesSiguiente,
  ultimoDia,
} from "@/lib/facturacion";

async function ordenesDelMes(mesOperado: string): Promise<OrdenesDia[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() =>
    supabase.rpc("get_fact_ordenes_mes", { p_desde: mesOperado, p_hasta: ultimoDia(mesOperado) })
  );
  if (error) throw new Error(error.message);
  const lista: OrdenesDia[] = [];
  for (const t of (data ?? []) as { restaurant: string; dias: Record<string, number> }[]) {
    for (const [dia, n] of Object.entries(t.dias ?? {})) lista.push({ restaurant: t.restaurant, dia: Number(dia), ordenes: Number(n) });
  }
  return lista;
}

export interface FacturaRespuesta {
  calculo: CalculoFactura;
  cerrada: boolean;
  cerradaEl: string | null;
  baseMes: string | null; // factura anterior que se tomó como base
  mesesCerrados: string[];
  sugerido: string; // siguiente mes por facturar
  ordenesMesAnterior: number | null;
  hayFacturaPosteriorCerrada: boolean;
}

/** Calcula la factura de un mes de pago (ej. "2026-10-01" = órdenes de septiembre). */
export async function obtenerFactura(mesPago: string): Promise<FacturaRespuesta> {
  const supabase = getSupabaseAdmin();
  const mesOperado = mesAnterior(mesPago);

  const [cerradasRes, ajustesRes, costoRes, ordenes, ordenesPrevias] = await Promise.all([
    withRetryResult(() => supabase.from("fact_facturas").select("mes_pago, cerrada_at").order("mes_pago", { ascending: false })),
    withRetryResult(() => supabase.from("fact_ajustes").select("codigo, tienda, accion, nota").eq("mes_pago", mesPago)),
    withRetryResult(() => supabase.from("app_settings").select("value").eq("key", "costo_mensual_por_tienda").maybeSingle()),
    ordenesDelMes(mesOperado),
    ordenesDelMes(mesAnterior(mesOperado)).catch(() => [] as OrdenesDia[]),
  ]);
  if (cerradasRes.error) throw new Error(cerradasRes.error.message);
  if (ajustesRes.error) throw new Error(ajustesRes.error.message);

  const cerradas = (cerradasRes.data ?? []) as { mes_pago: string; cerrada_at: string }[];
  const mesesCerrados = cerradas.map((c) => c.mes_pago.slice(0, 10));
  const baseMes = mesesCerrados.find((m) => m < mesPago) ?? null;
  const propia = cerradas.find((c) => c.mes_pago.slice(0, 10) === mesPago);

  let base: TiendaBase[] = [];
  if (baseMes) {
    const { data, error } = await withRetryResult(() =>
      supabase.from("fact_tiendas").select("tienda, codigo, tipo, estado").eq("mes_pago", baseMes).neq("estado", "baja").limit(5000)
    );
    if (error) throw new Error(error.message);
    base = ((data ?? []) as { tienda: string; codigo: string; tipo: TipoTienda }[]).map((t) => ({
      tienda: t.tienda,
      codigo: t.codigo,
      tipo: t.tipo,
    }));
  }

  const calculo = calcularFactura({
    mesPago,
    ordenes,
    base,
    ajustes: (ajustesRes.data ?? []) as AjusteFactura[],
    costoMensual: Number(costoRes.data?.value ?? 2000) || 2000,
    iva: 0.16,
  });

  return {
    calculo,
    cerrada: !!propia,
    cerradaEl: propia?.cerrada_at ?? null,
    baseMes,
    mesesCerrados,
    sugerido: mesesCerrados.length ? mesSiguiente(mesesCerrados[0]) : mesPago,
    ordenesMesAnterior: ordenesPrevias.length ? ordenesPrevias.reduce((s, o) => s + o.ordenes, 0) : null,
    hayFacturaPosteriorCerrada: mesesCerrados.some((m) => m > mesPago),
  };
}

/** "2026-10" o "2026-10-01" -> "2026-10-01" (o null si no es válido) */
export function leerMes(valor: string | null) {
  if (!valor || !/^\d{4}-\d{2}/.test(valor)) return null;
  return `${valor.slice(0, 7)}-01`;
}
