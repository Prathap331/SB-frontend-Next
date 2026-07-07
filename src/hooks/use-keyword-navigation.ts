'use client';

import { usePathname } from 'next/navigation';
import {
  buildLandingPath,
  buildSearchPath,
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
    landingPath: (path: string) => buildLandingPath(path, landingSlug),
    searchPath: (topic: string) => buildSearchPath(topic, searchSlug),
  };
}
