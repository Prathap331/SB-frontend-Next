import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://xncfghdikiqknuruurfh.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuY2ZnaGRpa2lxa251cnV1cmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTcwNTUsImV4cCI6MjA3NTg3MzA1NX0.9emUGvDrV8e8jYy6TMnPMiV7Hiw5qaCyeT6Vdc1yCAM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
