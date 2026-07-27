'use client';

import { usePathname } from 'next/navigation';
import {
  buildAppPath,
  buildLandingPath,
  buildSearchPath,
  buildStudioHomePath,
  buildStudioTabPath,
  getLandingSlugFromPathname,
  getSearchSlugFromPathname,
  type StudioTabId,
} from '@/lib/keyword-routes';

export function useKeywordNavigation() {
  const pathname = usePathname();
  const landingSlug = getLandingSlugFromPathname(pathname);
  const searchSlug = getSearchSlugFromPathname(pathname);

  return {
    landingSlug,
    searchSlug,
    homePath: `/${landingSlug}`,
    /** Studio compose home — /app/content-ideas */
    studioHomePath: buildStudioHomePath(),
    landingPath: (path: string) => buildLandingPath(path, landingSlug),
    searchPath: (topic: string) => buildSearchPath(topic),
    appPath: (path: string) => buildAppPath(path),
    studioTabPath: (
      tab: StudioTabId,
      opts?: { topic?: string | null; scriptId?: string | null },
    ) => buildStudioTabPath(tab, opts),
  };
}
