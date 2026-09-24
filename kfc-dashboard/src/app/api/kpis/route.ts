import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function param(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key);
  return v && v !== "" ? v : null;
}

function arrayParam(searchParams: URLSearchParams, key: string): string[] | null {
  const values = searchParams.getAll(key);
  return values.length > 0 ? values : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const supabase = getSupabaseAdmin();

  const orden_planeada = param(searchParams, "orden_planeada");

  const { data, error } = await supabase
    .rpc("get_ops_summary", {
      p_date_from: param(searchParams, "date_from"),
      p_date_to: param(searchParams, "date_to"),
      p_ciudad: arrayParam(searchParams, "ciudad"),
      p_restaurant: arrayParam(searchParams, "restaurant"),
      p_zona: arrayParam(searchParams, "zona"),
      p_estatus: arrayParam(searchParams, "estatus"),
      p_repartido_por: arrayParam(searchParams, "repartido_por"),
      p_orden_planeada: orden_planeada === null ? null : orden_planeada === "true",
      p_price_min: param(searchParams, "price_min"),
      p_price_max: param(searchParams, "price_max"),
    })
    .single();

  if (error) {
    console.error("Error en /api/kpis:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
