'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'storio_studio_sidebar_collapsed';

type StudioChromeContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
};

const StudioChromeContext = createContext<StudioChromeContextValue | null>(null);

function StudioChromeProviderInner({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '1') setSidebarCollapsedState(true);
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch { /* ignore */ }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed: hydrated ? sidebarCollapsed : false,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
    }),
    [hydrated, sidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed],
  );

  return (
    <StudioChromeContext.Provider value={value}>
      {children}
    </StudioChromeContext.Provider>
  );
}

/** Nested-safe: reuses an existing chrome context when already provided higher up. */
export function StudioChromeProvider({ children }: { children: ReactNode }) {
  const existing = useContext(StudioChromeContext);
  if (existing) return <>{children}</>;
  return <StudioChromeProviderInner>{children}</StudioChromeProviderInner>;
}

export function useStudioChrome() {
  const ctx = useContext(StudioChromeContext);
  if (!ctx) {
    return {
      sidebarCollapsed: false,
      setSidebarCollapsed: (_: boolean) => {},
      toggleSidebarCollapsed: () => {},
    };
  }
  return ctx;
}
