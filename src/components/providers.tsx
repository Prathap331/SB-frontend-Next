'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Mounts a global Supabase auth listener so the client keeps the session
 * alive across tab visibility changes, page navigations, and token expiry.
 *
 * - TOKEN_REFRESHED  → Supabase already updated localStorage; nothing extra needed.
 * - SIGNED_OUT       → The refresh token was revoked server-side; redirect to /auth.
 */
function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.info('[auth] Token refreshed automatically — session valid until', session?.expires_at);
      }
      if (event === 'SIGNED_OUT') {
        // Supabase invalidated the refresh token server-side; force re-login
        window.location.href = '/auth';
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseAuthProvider>
        {children}
      </SupabaseAuthProvider>
    </QueryClientProvider>
  );
}
