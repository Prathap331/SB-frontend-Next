'use client';

import { Suspense, useState } from 'react';
import { Menu } from 'lucide-react';
import StudioSidebar from '@/components/studio/StudioSidebar';

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
};

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
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const sidebar = (
    <StudioSidebar
      activeTopic={activeTopic}
      refreshKey={refreshKey}
      onNavigate={() => setMobileNavOpen(false)}
    />
  );

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
            {topBar ?? (
              <p className="text-sm font-medium text-[#6e6e73] truncate">AI Creator Studio</p>
            )}
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
