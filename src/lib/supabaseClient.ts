import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Store session (incl. refresh token) in localStorage
    autoRefreshToken: true,    // Silently refresh the access token before it expires
    detectSessionInUrl: true,  // Parse tokens from URL hash on OAuth callback
  },
});
