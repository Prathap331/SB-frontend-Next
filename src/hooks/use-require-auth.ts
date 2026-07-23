'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

/**
 * Redirects unauthenticated users to /auth and stores the current URL
 * so they can return after login.
 */
export function useRequireAuth(enabled = true): {
  ready: boolean;
  allowed: boolean;
} {
  const router = useRouter();
  const [ready, setReady] = useState(!enabled);
  const [allowed, setAllowed] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      setAllowed(true);
      return;
    }

    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        try {
          localStorage.setItem('post_auth_redirect', window.location.href);
        } catch { /* ignore */ }
        router.replace('/auth');
        return;
      }

      setAllowed(true);
      setReady(true);
    };

    void check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session) {
        try {
          localStorage.setItem('post_auth_redirect', window.location.href);
        } catch { /* ignore */ }
        setAllowed(false);
        router.replace('/auth');
        return;
      }
      setAllowed(true);
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [enabled, router]);

  return { ready, allowed };
}
