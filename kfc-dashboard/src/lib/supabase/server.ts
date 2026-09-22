import { createClient } from "@supabase/supabase-js";

// Cliente de servidor: usa la service_role key, que puede saltarse RLS.
// SOLO se importa desde código que corre en el servidor (API routes).
// Si algún día ves esta key en el bundle del navegador, algo está mal.
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
