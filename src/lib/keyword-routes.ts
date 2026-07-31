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

/** Studio compose / search-home topic segment (internal rewrite target) */
export const STUDIO_HOME_TOPIC = 'app';

/** Public studio base — all new-interface routes live under /app */
export const APP_BASE = '/app';

/** Cookie so /app/script/{idea} can rewrite onto the correct /search/{topic} */
export const STUDIO_TOPIC_COOKIE = 'storio_studio_topic';

export type StudioTabId = 'ideas' | 'script' | 'metadata' | 'thumbnails' | 'broll' | 'audio';

export function isStudioComposeTopic(topic: string): boolean {
  const t = decodeURIComponent(topic || '').trim();
  return t === STUDIO_HOME_TOPIC || t === '__compose__';
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

export function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Studio compose home — /app/content-ideas */
export function buildStudioHomePath(): string {
  return `${APP_BASE}/content-ideas`;
}

/** Topic workspace — /app/content-ideas/{topic} */
export function buildSearchPath(topic: string): string {
  const trimmed = topic.trim();
  if (!trimmed || isStudioComposeTopic(trimmed)) {
    return buildStudioHomePath();
  }
  return `${APP_BASE}/content-ideas/${encodePathSegment(trimmed)}`;
}

export function studioTabFromPathname(pathname: string): StudioTabId | null {
  const path = pathname.split('?')[0];
  const lower = path.toLowerCase();

  if (lower === `${APP_BASE}/content-ideas` || lower.startsWith(`${APP_BASE}/content-ideas/`)) {
    return 'ideas';
  }
  if (lower.startsWith(`${APP_BASE}/script/`)) return 'script';
  if (lower.startsWith(`${APP_BASE}/metadata/`)) return 'metadata';
  if (lower.startsWith(`${APP_BASE}/thumbnail`)) return 'thumbnails';
  if (lower === `${APP_BASE}/b-roll` || lower.startsWith(`${APP_BASE}/b-roll/`)) {
    return 'broll';
  }
  if (lower === `${APP_BASE}/audio` || lower.startsWith(`${APP_BASE}/audio/`)) {
    return 'audio';
  }
  return null;
}

/** Idea name (or topic) segment after the tab in /app/{tab}/{segment} */
export function studioPathSegmentFromPathname(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'app' || segments.length < 3) return null;
  const tab = segments[1].toLowerCase();
  if (
    tab === 'content-ideas' ||
    tab === 'script' ||
    tab === 'metadata' ||
    tab === 'thumbnail' ||
    tab === 'thumbnails'
  ) {
    return decodePathSegment(segments.slice(2).join('/'));
  }
  return null;
}

/**
 * Build studio tab URL:
 * - ideas → /app/content-ideas/{topic}
 * - script/metadata/thumbnails → /app/{tab}/{ideaName}
 * - broll → /app/B-roll
 * - audio → /app/audio
 */
export function buildStudioTabPath(
  tab: StudioTabId,
  opts?: {
    topic?: string | null;
    ideaTitle?: string | null;
    scriptId?: string | null;
  },
): string {
  const topic = opts?.topic?.trim() || '';
  const ideaTitle = opts?.ideaTitle?.trim() || '';
  const scriptId = opts?.scriptId || null;

  let path: string;
  switch (tab) {
    case 'ideas':
      path =
        topic && !isStudioComposeTopic(topic)
          ? `${APP_BASE}/content-ideas/${encodePathSegment(topic)}`
          : buildStudioHomePath();
      break;
    case 'script':
      path = `${APP_BASE}/script/${encodePathSegment(ideaTitle || 'script')}`;
      break;
    case 'metadata':
      path = `${APP_BASE}/metadata/${encodePathSegment(ideaTitle || 'script')}`;
      break;
    case 'thumbnails':
      path = `${APP_BASE}/thumbnail/${encodePathSegment(ideaTitle || 'script')}`;
      break;
    case 'broll':
      path = `${APP_BASE}/B-roll`;
      break;
    case 'audio':
      path = `${APP_BASE}/audio`;
      break;
  }

  if (scriptId) {
    return `${path}?scriptId=${encodeURIComponent(scriptId)}`;
  }
  return path;
}

/** Library / profile routes under /app */
export function buildAppPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/' || normalized === '') return buildStudioHomePath();
  if (normalized === APP_BASE || normalized.startsWith(`${APP_BASE}/`)) {
    return normalized;
  }
  return `${APP_BASE}${normalized}`;
}

export function setStudioTopicCookie(topic: string) {
  if (typeof document === 'undefined') return;
  const trimmed = topic.trim();
  if (!trimmed || isStudioComposeTopic(trimmed)) {
    document.cookie = `${STUDIO_TOPIC_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${STUDIO_TOPIC_COOKIE}=${encodeURIComponent(trimmed)}; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function readStudioTopicCookie(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STUDIO_TOPIC_COOKIE}=`));
  if (!match) return null;
  const raw = match.slice(STUDIO_TOPIC_COOKIE.length + 1);
  try {
    const value = decodeURIComponent(raw).trim();
    return value && !isStudioComposeTopic(value) ? value : null;
  } catch {
    return null;
  }
}

const LANDING_SET = new Set<string>(LANDING_KEYWORD_SLUGS);
const SEARCH_SET = new Set<string>(SEARCH_KEYWORD_SLUGS);

/** Routes that never get a landing-keyword prefix */
const EXEMPT_PREFIX_PATHS = ['/search', '/script', '/api', '/app', '/auth'];

/** Top-level marketing / legal routes redirected to /{landingSlug}/... when bare */
export const BARE_APP_SEGMENTS = new Set([
  'pricing',
  'blog',
  'scripts',
  'auth',
  'checkout',
  'teleprompter',
  'forgot-password',
  'privacy-policy',
  'terms-and-conditions',
  'cancellation-policy',
  'cancellation-and-refund-policy',
]);

/** Studio library routes that live under /app (not landing-prefixed) */
export const APP_LIBRARY_SEGMENTS = new Set([
  'content-vault',
  'my-scripts',
  'profile',
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

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const segments = normalized.split('/').filter(Boolean);
  if (segments[0] && APP_LIBRARY_SEGMENTS.has(segments[0])) {
    return buildAppPath(normalized);
  }

  if (path === '/' || path === '') return `/${landingSlug}`;

  if (segments.length > 0 && isLandingKeywordSlug(segments[0])) {
    return normalized;
  }

  return `/${landingSlug}${normalized}`;
}

export function stripKeywordPrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return '/';

  if (segments[0] === 'app') {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }

  if (isKeywordSlug(segments[0])) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }

  return pathname;
}
