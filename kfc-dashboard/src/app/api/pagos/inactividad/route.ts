import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { withRetryResult } from "@/lib/supabase/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const asOf = searchParams.get("as_of");

  if (!asOf) {
    return NextResponse.json({ error: "Falta as_of." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await withRetryResult(() =>
    supabase.rpc("get_stores_last_activity", { p_as_of: asOf })
  );

  if (error) {
    console.error("Error en /api/pagos/inactividad:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { tiendas: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
