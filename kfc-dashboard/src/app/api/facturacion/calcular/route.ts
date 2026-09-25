import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Movimiento {
  sucursal: string;
  tipo_movimiento: string;
  fecha_solicitud: string | null;
  fecha_inicio_operacion: string | null;
}

interface FilaFactura {
  codigo: string;
  restaurant: string;
  tipo: "delivery" | "flotilla";
  ordenes_mes: number;
  es_nueva: boolean;
  fecha_inicio: string | null;
  dias_a_cobrar: number | null;
  monto_a_cobrar: number | null;
  posible_baja: boolean;
  sin_seguimiento: boolean; // tuvo órdenes pero no aparece en el historial de altas
}

const codigoDe = (nombre: string) => nombre.match(/^\d+/)?.[0] ?? nombre.trim();

function diasEnMes(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!year || !month) {
      return NextResponse.json({ error: "Faltan year y month." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [ordenesRes, movimientosRes, costoRes] = await Promise.all([
      withRetryResult(() =>
        supabase.rpc("get_month_orders_by_store", { p_year: year, p_month: month })
      ),
      withRetryResult(() =>
        supabase
          .from("movimientos_tiendas")
          .select("sucursal, tipo_movimiento, fecha_solicitud, fecha_inicio_operacion")
      ),
      withRetryResult(() =>
        supabase.from("app_settings").select("value").eq("key", "costo_mensual_por_tienda").single()
      ),
    ]);

    if (ordenesRes.error) throw ordenesRes.error;
    if (movimientosRes.error) throw movimientosRes.error;

    const costoMensual = Number(costoRes.data?.value ?? 2000);
    const dias = diasEnMes(year, month);
    const costoDiario = costoMensual / dias;
    const inicioMes = new Date(year, month - 1, 1);
    const finMes = new Date(year, month - 1, dias);

    const ordenesPorCodigo = new Map<string, { restaurant: string; ordenes: number }>();
    for (const row of (ordenesRes.data ?? []) as { restaurant: string; ordenes: number }[]) {
      ordenesPorCodigo.set(codigoDe(row.restaurant), { restaurant: row.restaurant, ordenes: row.ordenes });
    }

    const movsPorCodigo = new Map<string, Movimiento[]>();
    for (const m of (movimientosRes.data ?? []) as Movimiento[]) {
      const cod = codigoDe(m.sucursal);
      if (!movsPorCodigo.has(cod)) movsPorCodigo.set(cod, []);
      movsPorCodigo.get(cod)!.push(m);
    }

    const todosLosCodigos = new Set([...ordenesPorCodigo.keys(), ...movsPorCodigo.keys()]);
    const filas: FilaFactura[] = [];

    for (const codigo of todosLosCodigos) {
      const movs = movsPorCodigo.get(codigo) ?? [];
      const ordenData = ordenesPorCodigo.get(codigo);

      const altas = movs
        .filter((m) => ["alta_delivery", "alta_flotilla"].includes(m.tipo_movimiento) && m.fecha_inicio_operacion)
        .sort((a, b) => (a.fecha_inicio_operacion! < b.fecha_inicio_operacion! ? -1 : 1));
      const primeraAlta = altas[0]?.fecha_inicio_operacion ?? null;

      const clasificaciones = movs
        .filter(
          (m) =>
            ["alta_delivery", "alta_flotilla", "cambio_a_delivery", "cambio_a_flotilla"].includes(
              m.tipo_movimiento
            ) &&
            m.fecha_inicio_operacion &&
            m.fecha_inicio_operacion <= finMes.toISOString().slice(0, 10)
        )
        .sort((a, b) => (a.fecha_inicio_operacion! > b.fecha_inicio_operacion! ? -1 : 1));
      const ultimaClasificacion = clasificaciones[0]?.tipo_movimiento;
      const tipo: "delivery" | "flotilla" =
        ultimaClasificacion === "alta_flotilla" || ultimaClasificacion === "cambio_a_flotilla"
          ? "flotilla"
          : "delivery";

      const tieneBaja = movs.some(
        (m) => m.tipo_movimiento === "baja" && (m.fecha_solicitud ?? "") <= finMes.toISOString().slice(0, 10)
      );

      const inicioMesStr = inicioMes.toISOString().slice(0, 10);
      const finMesStr = finMes.toISOString().slice(0, 10);
      const esNueva = !!primeraAlta && primeraAlta >= inicioMesStr && primeraAlta <= finMesStr;
      const esActivaPrevia = !!primeraAlta && primeraAlta < inicioMesStr && !tieneBaja;

      let diasACobrar: number | null = null;
      let monto: number | null = null;
      if (esNueva && primeraAlta) {
        const diaDelMes = Number(primeraAlta.slice(8, 10));
        diasACobrar = dias + 1 - diaDelMes;
        monto = Math.round(diasACobrar * costoDiario * 100) / 100;
      }

      if (!esNueva && !esActivaPrevia && !ordenData) continue; // sin relevancia para este mes

      filas.push({
        codigo,
        restaurant: ordenData?.restaurant ?? movs[0]?.sucursal ?? codigo,
        tipo,
        ordenes_mes: ordenData?.ordenes ?? 0,
        es_nueva: esNueva,
        fecha_inicio: primeraAlta,
        dias_a_cobrar: diasACobrar,
        monto_a_cobrar: monto,
        posible_baja: esActivaPrevia && !ordenData && !esNueva,
        sin_seguimiento: !!ordenData && movs.length === 0,
      });
    }

    const activasInicioMes = filas.filter(
      (f) => f.fecha_inicio && f.fecha_inicio < inicioMes.toISOString().slice(0, 10) && !f.posible_baja
    );
    // Cuenta también las que están activas previas aunque este mes no tengan orden (posible baja) — siguen facturándose hasta que se confirme la baja.
    const sucursalesActivasInicioMes = filas.filter(
      (f) => f.fecha_inicio && f.fecha_inicio < inicioMes.toISOString().slice(0, 10)
    ).length;

    const altasNuevas = filas.filter((f) => f.es_nueva);
    const altasDelivery = altasNuevas.filter((f) => f.tipo === "delivery");
    const altasFlotilla = altasNuevas.filter((f) => f.tipo === "flotilla");
    const posiblesBajas = filas.filter((f) => f.posible_baja);
    const sinSeguimiento = filas.filter((f) => f.sin_seguimiento);

    const facturacionFlat = Math.round(sucursalesActivasInicioMes * costoMensual * 100) / 100;
    const proporcionalDelivery =
      Math.round(altasDelivery.reduce((s, f) => s + (f.monto_a_cobrar ?? 0), 0) * 100) / 100;
    const proporcionalFlotilla =
      Math.round(altasFlotilla.reduce((s, f) => s + (f.monto_a_cobrar ?? 0), 0) * 100) / 100;
    const totalAFacturar =
      Math.round((facturacionFlat + proporcionalDelivery + proporcionalFlotilla) * 100) / 100;

    return NextResponse.json(
      {
        year,
        month,
        dias_en_mes: dias,
        costo_mensual: costoMensual,
        costo_diario: Math.round(costoDiario * 100) / 100,
        sucursales_activas_inicio_mes: sucursalesActivasInicioMes,
        altas_nuevas: altasNuevas,
        posibles_bajas: posiblesBajas,
        sin_seguimiento: sinSeguimiento,
        resumen: {
          facturacion_flat: facturacionFlat,
          proporcional_delivery: proporcionalDelivery,
          proporcional_flotilla: proporcionalFlotilla,
          total_a_facturar: totalAFacturar,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    console.error("Error en /api/facturacion/calcular:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
