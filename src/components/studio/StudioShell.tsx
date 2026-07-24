'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Menu, Search, Sparkles } from 'lucide-react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Input } from '@/components/ui/input';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  children: React.ReactNode;
  activeTopic?: string;
  refreshKey?: number;
  /** Optional top bar (e.g. search on topic page). Mobile menu button is always shown. */
  topBar?: React.ReactNode;
  /** When false, children fill the main area without the default padded wrapper */
  padded?: boolean;
  /** When false, the main area does not scroll — children manage their own scroll */
  contentScroll?: boolean;
  /**
   * Require a signed-in session (redirects to /auth).
   * Default true — pass false for public studio pages like pricing.
   */
  requireAuth?: boolean;
};

function DefaultStudioSearchBar() {
  const router = useRouter();
  const { searchPath } = useKeywordNavigation();
  const [query, setQuery] = useState('');
  const [searchWarning, setSearchWarning] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) {
      setSearchWarning(
        'For better AI responses, please describe your search using at least 4 words.',
      );
      return;
    }
    setSearchWarning(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      try {
        const dest = `${window.location.origin}${searchPath(trimmed)}`;
        localStorage.setItem('post_auth_redirect', dest);
      } catch { /* ignore */ }
      router.push('/auth');
      return;
    }

    router.push(searchPath(trimmed));
  };

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0 relative">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Describe your topic using at least 4 words for the best AI results."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (searchWarning) setSearchWarning(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            className="pl-10 pr-4 py-5 rounded-full border-gray-200 bg-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => { void submit(); }}
          className="flex items-center gap-2 rounded-full bg-[#3d3d3a] hover:bg-[#1d1d1f] text-white text-sm font-semibold px-4 py-2.5 transition-colors flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Generate ideas</span>
          <span className="sm:hidden">Go</span>
        </button>
      </div>
      {searchWarning && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50" role="alert">
          <div className="relative bg-[#1d1d1f] text-white text-[12px] sm:text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug max-w-sm">
            <div className="absolute -top-1.5 left-8 w-3 h-3 bg-[#1d1d1f] rotate-45" />
            {searchWarning}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared studio chrome: left StudioSidebar + scrollable main panel.
 * Used by /content-vault, /profile, /pricing, and the search topic workspace.
 */
export default function StudioShell({
  children,
  activeTopic,
  refreshKey = 0,
  topBar,
  padded = true,
  contentScroll = true,
  requireAuth = true,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { ready, allowed } = useRequireAuth(requireAuth);

  const sidebar = (
    <StudioSidebar
      activeTopic={activeTopic}
      refreshKey={refreshKey}
      onNavigate={() => setMobileNavOpen(false)}
    />
  );

  if (requireAuth && (!ready || !allowed)) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f5f6f8]">
        <Loader2 className="w-6 h-6 animate-spin text-[#6e6e73]" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f5f6f8] flex">
      <div className="hidden lg:flex h-full">
        <Suspense fallback={<div className="w-[260px] bg-[#f7f8fa] border-r border-gray-200/80" />}>
          {sidebar}
        </Suspense>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 h-full shadow-xl">
            <Suspense fallback={null}>{sidebar}</Suspense>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="relative z-40 flex-shrink-0 border-b border-gray-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3 overflow-visible">
          <div className="flex items-center gap-3 max-w-8xl mx-auto overflow-visible">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {topBar ?? <DefaultStudioSearchBar />}
          </div>
        </div>

        <div
          className={`relative z-0 flex-1 min-h-0 ${
            contentScroll ? 'overflow-y-auto' : 'overflow-hidden flex flex-col'
          }`}
        >
          {padded ? (
            <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
              {children}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
