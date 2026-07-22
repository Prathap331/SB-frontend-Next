'use client';

import { usePathname } from 'next/navigation';
import {
  buildLandingPath,
  buildSearchPath,
  DEFAULT_SEARCH_SLUG,
  getLandingSlugFromPathname,
  getSearchSlugFromPathname,
} from '@/lib/keyword-routes';

export function useKeywordNavigation() {
  const pathname = usePathname();
  const landingSlug = getLandingSlugFromPathname(pathname);
  const searchSlug = getSearchSlugFromPathname(pathname);

  return {
    landingSlug,
    searchSlug,
    homePath: `/${landingSlug}`,
    /** Studio compose home — /content-ideas (no topic selected) */
    studioHomePath: `/${DEFAULT_SEARCH_SLUG}`,
    landingPath: (path: string) => buildLandingPath(path, landingSlug),
    searchPath: (topic: string) => buildSearchPath(topic, searchSlug),
  };
}
