import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  BARE_APP_SEGMENTS,
  DEFAULT_LANDING_SLUG,
  DEFAULT_SEARCH_SLUG,
  isLandingKeywordSlug,
  isSearchKeywordSlug,
} from '@/lib/keyword-routes';

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon_io') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.webmanifest' ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
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

  // Legacy /search/... → /{searchSlug}/...
  if (first === 'search') {
    const topicPath = segments.slice(1).join('/');
    const target = topicPath
      ? `/${DEFAULT_SEARCH_SLUG}/${topicPath}`
      : `/${DEFAULT_SEARCH_SLUG}`;
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  // /script stays unprefixed
  if (first === 'script') {
    return NextResponse.next();
  }

  // Bare app routes → /{landingSlug}/...
  if (BARE_APP_SEGMENTS.has(first)) {
    const target = `/${DEFAULT_LANDING_SLUG}${pathname}`;
    return NextResponse.redirect(new URL(`${target}${search}`, request.url));
  }

  // Landing keyword slug
  if (first && isLandingKeywordSlug(first)) {
    const rest = segments.slice(1);

    // Block search/script under landing slug — send to correct URL shape
    if (rest[0] === 'search') {
      const topicPath = rest.slice(1).join('/');
      const target = topicPath
        ? `/${DEFAULT_SEARCH_SLUG}/${topicPath}`
        : `/${DEFAULT_SEARCH_SLUG}`;
      return NextResponse.redirect(new URL(`${target}${search}`, request.url));
    }
    if (rest[0] === 'script') {
      const target = rest.length > 1 ? `/script/${rest.slice(1).join('/')}` : '/script';
      return NextResponse.redirect(new URL(`${target}${search}`, request.url));
    }

    const rewritePath = rest.length > 0 ? `/${rest.join('/')}` : '/';
    const url = request.nextUrl.clone();
    url.pathname = rewritePath;
    const response = NextResponse.rewrite(url);
    response.headers.set('x-landing-slug', first);
    return response;
  }

  // Search keyword slug
  if (first && isSearchKeywordSlug(first)) {
    const rest = segments.slice(1);

    // Bare /content-ideas → /content-ideas/app (compose / search home)
    if (rest.length === 0) {
      return NextResponse.redirect(
        new URL(`/${first}/app${search}`, request.url),
      );
    }

    // Legacy compose placeholder → /content-ideas/app
    const firstTopic = decodeURIComponent(rest[0] || '');
    if (rest.length === 1 && firstTopic === '__compose__') {
      return NextResponse.redirect(
        new URL(`/${first}/app${search}`, request.url),
      );
    }

    const topic = rest.join('/');
    const url = request.nextUrl.clone();
    url.pathname = `/search/${decodeURIComponent(topic)}`;
    const response = NextResponse.rewrite(url);
    response.headers.set('x-search-slug', first);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
