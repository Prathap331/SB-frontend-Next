'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ApiService } from "@/services/api";

/**
 * Mounts a global Supabase auth listener so the client keeps the session
 * alive across tab visibility changes, page navigations, and token expiry.
 *
 * - TOKEN_REFRESHED  → Supabase already updated localStorage; nothing extra needed.
 * - SIGNED_OUT       → The refresh token was revoked server-side; redirect to /auth.
 * - SIGNED_IN / visit → POST /check-credits so expired credit purchases are pruned.
 */
function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lastCheckedUserId: string | null = null;
    let inFlight = false;

    const runCheckCredits = async (userId: string) => {
      if (!userId || inFlight) return;
      // Once per user per page-load session (avoid TOKEN_REFRESHED spam)
      if (lastCheckedUserId === userId) return;
      inFlight = true;
      try {
        await ApiService.checkCredits(userId);
        lastCheckedUserId = userId;
        try {
          window.dispatchEvent(new Event('creditsUpdated'));
        } catch { /* ignore */ }
      } catch (err) {
        console.warn('[check-credits]', err);
      } finally {
        inFlight = false;
      }
    };

    // Purge legacy client-side script/idea caches (full scripts must not live in localStorage)
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (
          key.startsWith('script_') ||
          (key.startsWith('studio_') && key.endsWith('_unlocked')) ||
          key.startsWith('topic_ideas_')
        ) {
          localStorage.removeItem(key);
        }
      }
      localStorage.removeItem('script_latest_key');
    } catch { /* ignore */ }

    // Visit: logged-in user already has a session
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) void runCheckCredits(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.info('[auth] Token refreshed automatically — session valid until', session?.expires_at);
      }
      if (event === 'SIGNED_IN' && session?.user?.id) {
        lastCheckedUserId = null; // allow check after fresh login
        void runCheckCredits(session.user.id);
      }
      if (event === 'SIGNED_OUT') {
        lastCheckedUserId = null;
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
