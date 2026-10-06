import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Agrega o actualiza una tienda Turbo: { picking_point_id, nombre?, store_id?,
 * restaurant_id?, fecha_activacion?, activa? } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const id = Number(b.picking_point_id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Falta el Picking point ID de Rappi." }, { status: 400 });
    }
    const fila: Record<string, unknown> = { picking_point_id: id, updated_at: new Date().toISOString() };
    if (typeof b.nombre === "string" && b.nombre.trim()) fila.nombre = b.nombre.trim();
    if (typeof b.store_id === "string") fila.store_id = b.store_id.trim() || null;
    if (typeof b.restaurant_id === "string") fila.restaurant_id = b.restaurant_id.trim() || null;
    if (typeof b.fecha_activacion === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_activacion)) fila.fecha_activacion = b.fecha_activacion;
    if (typeof b.activa === "boolean") fila.activa = b.activa;

    const supabase = getSupabaseAdmin();
    const { data: existe } = await supabase.from("rappi_turbo_tiendas").select("picking_point_id").eq("picking_point_id", id).maybeSingle();
    if (!existe && !fila.nombre) {
      return NextResponse.json({ error: "Para una tienda nueva escribe también su nombre." }, { status: 400 });
    }
    const { error } = await withRetryResult(() =>
      existe
        ? supabase.from("rappi_turbo_tiendas").update(fila).eq("picking_point_id", id)
        : supabase.from("rappi_turbo_tiendas").insert(fila)
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
