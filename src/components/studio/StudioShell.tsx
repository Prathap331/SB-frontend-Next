'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Menu, Search, Sparkles } from 'lucide-react';
import StudioSidebar from '@/components/studio/StudioSidebar';
import { Input } from '@/components/ui/input';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import { useRequireAuth } from '@/hooks/use-require-auth';

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

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(searchPath(trimmed));
  };

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search a topic (e.g. 'productivity for developers')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          className="pl-10 pr-4 py-5 rounded-full border-gray-200 bg-white text-sm"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        className="flex items-center gap-2 rounded-full bg-[#3d3d3a] hover:bg-[#1d1d1f] text-white text-sm font-semibold px-4 py-2.5 transition-colors flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Generate ideas</span>
        <span className="sm:hidden">Go</span>
      </button>
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
        <div className="flex-shrink-0 border-b border-gray-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 max-w-8xl mx-auto">
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
          className={`flex-1 min-h-0 ${
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
