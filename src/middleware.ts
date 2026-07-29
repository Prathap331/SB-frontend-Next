import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  APP_BASE,
  APP_LIBRARY_SEGMENTS,
  BARE_APP_SEGMENTS,
  DEFAULT_LANDING_SLUG,
  STUDIO_HOME_TOPIC,
  decodePathSegment,
  isLandingKeywordSlug,
  isSearchKeywordSlug,
  isStudioComposeTopic,
  readStudioTopicCookie,
} from '@/lib/keyword-routes';

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon_io') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/og-image.jpg' ||
    pathname === '/og-image.png' ||
    pathname === '/og-image-square.jpg' ||
    pathname === '/opengraph-image' ||
    pathname.startsWith('/opengraph-image') ||
    pathname.startsWith('/twitter-image') ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function rewriteToSearch(request: NextRequest, topic: string) {
  const url = request.nextUrl.clone();
  url.pathname = `/search/${encodeURIComponent(topic)}`;
  return NextResponse.rewrite(url);
}

function topicForStudioTabs(request: NextRequest): string {
  const fromCookie = readStudioTopicCookie(request.headers.get('cookie'));
  if (fromCookie) return fromCookie;
  return STUDIO_HOME_TOPIC;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];

  // Root → default landing keyword
  if (segments.length === 0) {
    return NextResponse.redirect(
      new URL(`/${DEFAULT_LANDING_SLUG}${search}`, request.url),
    );
  }

  // ── New studio interface under /app ──────────────────────────────────────
  if (first === 'app') {
    const rest = segments.slice(1);
    const restLower = rest.map((s) => s.toLowerCase());

    // /app → /app/content-ideas
    if (rest.length === 0) {
      return NextResponse.redirect(
        new URL(`${APP_BASE}/content-ideas${search}`, request.url),
      );
    }

    // Library pages
    if (APP_LIBRARY_SEGMENTS.has(rest[0])) {
      const url = request.nextUrl.clone();
      url.pathname = `/${rest.join('/')}`;
      return NextResponse.rewrite(url);
    }

    // /app/content-ideas or /app/content-ideas/{topic}
    if (restLower[0] === 'content-ideas') {
      const topicSeg = rest.slice(1).map(decodePathSegment).join('/');
      const topic =
        topicSeg && !isStudioComposeTopic(topicSeg) ? topicSeg : STUDIO_HOME_TOPIC;
      return rewriteToSearch(request, topic);
    }

    // /app/script/{ideaName} | /app/metadata/{ideaName} | /app/thumbnail/{ideaName}
    if (
      restLower[0] === 'script' ||
      restLower[0] === 'metadata' ||
      restLower[0] === 'thumbnail' ||
      restLower[0] === 'thumbnails'
    ) {
      return rewriteToSearch(request, topicForStudioTabs(request));
    }

    // /app/B-roll
    if (restLower[0] === 'b-roll') {
      return rewriteToSearch(request, topicForStudioTabs(request));
    }

    if (rest[0] === 'pricing') {
      const url = request.nextUrl.clone();
      url.pathname = '/pricing';
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // Bare library routes → /app/...
  if (APP_LIBRARY_SEGMENTS.has(first)) {
    return NextResponse.redirect(
      new URL(`${APP_BASE}${pathname}${search}`, request.url),
    );
  }

  // Legacy /search/... → /app/content-ideas/{topic}
  if (first === 'search') {
    const topicPath = segments.slice(1).map(decodePathSegment).join('/');
    if (!topicPath || isStudioComposeTopic(topicPath)) {
      return NextResponse.redirect(
        new URL(`${APP_BASE}/content-ideas${search}`, request.url),
      );
    }
    return NextResponse.redirect(
      new URL(
        `${APP_BASE}/content-ideas/${encodeURIComponent(topicPath)}${search}`,
        request.url,
      ),
    );
  }

  // /script?scriptId=... → open in new studio interface
  if (first === 'script' && segments.length === 1) {
    const scriptId = request.nextUrl.searchParams.get('scriptId');
    if (scriptId) {
      return NextResponse.redirect(
        new URL(
          `${APP_BASE}/script/script?scriptId=${encodeURIComponent(scriptId)}`,
          request.url,
        ),
      );
    }
    return NextResponse.next();
  }

  // Bare marketing / legal routes → /{landingSlug}/...
  if (BARE_APP_SEGMENTS.has(first)) {
    const target = `/${DEFAULT_LANDING_SLUG}${pathname}`;
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  // Landing keyword slug
  if (first && isLandingKeywordSlug(first)) {
    const rest = segments.slice(1);

    if (rest[0] && APP_LIBRARY_SEGMENTS.has(rest[0])) {
      return NextResponse.redirect(
        new URL(`${APP_BASE}/${rest.join('/')}${search}`, request.url),
      );
    }

    if (rest[0] === 'search') {
      const topicPath = rest.slice(1).map(decodePathSegment).join('/');
      if (!topicPath || isStudioComposeTopic(topicPath)) {
        return NextResponse.redirect(
          new URL(`${APP_BASE}/content-ideas${search}`, request.url),
        );
      }
      return NextResponse.redirect(
        new URL(
          `${APP_BASE}/content-ideas/${encodeURIComponent(topicPath)}${search}`,
          request.url,
        ),
      );
    }
    if (rest[0] === 'script') {
      const scriptId = request.nextUrl.searchParams.get('scriptId');
      if (scriptId) {
        return NextResponse.redirect(
          new URL(
            `${APP_BASE}/script/script?scriptId=${encodeURIComponent(scriptId)}`,
            request.url,
          ),
        );
      }
      const topicPath = rest.slice(1).map(decodePathSegment).join('/');
      if (topicPath) {
        return NextResponse.redirect(
          new URL(
            `${APP_BASE}/content-ideas/${encodeURIComponent(topicPath)}${search}`,
            request.url,
          ),
        );
      }
      return NextResponse.redirect(
        new URL(`${APP_BASE}/content-ideas${search}`, request.url),
      );
    }

    const rewritePath = rest.length > 0 ? `/${rest.join('/')}` : '/';
    const url = request.nextUrl.clone();
    url.pathname = rewritePath;
    const response = NextResponse.rewrite(url);
    response.headers.set('x-landing-slug', first);
    return response;
  }

  // Legacy search keyword slug → /app/content-ideas/{topic}
  if (first && isSearchKeywordSlug(first)) {
    const rest = segments.slice(1);

    if (rest.length === 0) {
      return NextResponse.redirect(
        new URL(`${APP_BASE}/content-ideas${search}`, request.url),
      );
    }

    const firstTopic = decodePathSegment(rest[0] || '');
    if (rest.length === 1 && isStudioComposeTopic(firstTopic)) {
      return NextResponse.redirect(
        new URL(`${APP_BASE}/content-ideas${search}`, request.url),
      );
    }

    const topic = rest.map(decodePathSegment).join('/');
    return NextResponse.redirect(
      new URL(
        `${APP_BASE}/content-ideas/${encodeURIComponent(topic)}${search}`,
        request.url,
      ),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
