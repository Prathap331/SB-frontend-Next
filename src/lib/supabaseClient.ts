import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session across page reloads via localStorage
    persistSession: true,
    // Automatically refresh the access token before it expires
    autoRefreshToken: true,
    // Detect session from URL hash (needed for OAuth + magic-link callbacks)
    detectSessionInUrl: true,
  },
});
