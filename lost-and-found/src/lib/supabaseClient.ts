import { createClient } from "@supabase/supabase-js";

// Supabase client configured for browser usage.
//
// These env vars must be defined (typically in `.env.local`) and are exposed
// to the client because they are prefixed with `NEXT_PUBLIC_`.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The anon key is safe to use in the client as long as your Supabase RLS
// policies are correctly configured.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
