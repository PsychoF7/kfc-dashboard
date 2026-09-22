import { createClient } from "@supabase/supabase-js";

// Cliente de navegador: usa la anon key (solo lectura pública controlada
// por RLS). Nunca se le pasa la service role key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey);
