export const LANDING_KEYWORD_SLUGS = [
  'ai-youtube-content-generator',
  'ai-script-generator',
  'youtube-script-generator',
  'ai-script-writer',
  'video-script-generator',
  'script-writing-ai',
  'script-generator',
] as const;

export const SEARCH_KEYWORD_SLUGS = [
  'content-writing-ai',
  'ai-generated-ideas',
  'content-ideas',
  'search',
  'trend-research',
] as const;

export type LandingKeywordSlug = (typeof LANDING_KEYWORD_SLUGS)[number];
export type SearchKeywordSlug = (typeof SEARCH_KEYWORD_SLUGS)[number];

export const DEFAULT_LANDING_SLUG: LandingKeywordSlug = 'ai-youtube-content-generator';
export const DEFAULT_SEARCH_SLUG: SearchKeywordSlug = 'content-ideas';

const LANDING_SET = new Set<string>(LANDING_KEYWORD_SLUGS);
const SEARCH_SET = new Set<string>(SEARCH_KEYWORD_SLUGS);

/** Routes that never get a landing-keyword prefix */
const EXEMPT_PREFIX_PATHS = ['/search', '/script', '/api'];

/** Top-level app routes redirected to /{landingSlug}/... when visited without a keyword */
export const BARE_APP_SEGMENTS = new Set([
  'pricing',
  'blog',
  'scripts',
  'content-vault',
  'auth',
  'profile',
  'checkout',
  'teleprompter',
  'forgot-password',
  'privacy-policy',
  'terms-and-conditions',
  'cancellation-policy',
  'cancellation-and-refund-policy',
]);

export function isLandingKeywordSlug(value: string): value is LandingKeywordSlug {
  return LANDING_SET.has(value);
}

export function isSearchKeywordSlug(value: string): value is SearchKeywordSlug {
  return SEARCH_SET.has(value);
}

export function isKeywordSlug(value: string): boolean {
  return isLandingKeywordSlug(value) || isSearchKeywordSlug(value);
}

export function isExemptFromLandingPrefix(path: string): boolean {
  return EXEMPT_PREFIX_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function getLandingSlugFromPathname(pathname: string): LandingKeywordSlug {
  const first = pathname.split('/').filter(Boolean)[0];
  if (first && isLandingKeywordSlug(first)) return first;
  return DEFAULT_LANDING_SLUG;
}

export function getSearchSlugFromPathname(pathname: string): SearchKeywordSlug {
  const first = pathname.split('/').filter(Boolean)[0];
  if (first && isSearchKeywordSlug(first)) return first;
  return DEFAULT_SEARCH_SLUG;
}

export function buildLandingPath(
  path: string,
  landingSlug: string = DEFAULT_LANDING_SLUG,
): string {
  if (isExemptFromLandingPrefix(path)) return path;

  if (path === '/' || path === '') return `/${landingSlug}`;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length > 0 && isLandingKeywordSlug(segments[0])) {
    return normalized;
  }

  return `/${landingSlug}${normalized}`;
}

export function buildSearchPath(
  topic: string,
  searchSlug: string = DEFAULT_SEARCH_SLUG,
): string {
  const encoded = encodeURIComponent(topic);
  return `/${searchSlug}/${encoded}`;
}

export function stripKeywordPrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '/';

  if (isKeywordSlug(segments[0])) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }

  return pathname;
}
