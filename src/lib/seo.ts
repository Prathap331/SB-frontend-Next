import type { Metadata } from 'next';

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.storio.tech').replace(/\/$/, '');

export const SITE_NAME = 'Storio';

export const DEFAULT_TITLE =
  'Storio — Automated Youtube Script and Metadata, Thumbnail Generator ';

export const DEFAULT_DESCRIPTION =
  'Generate YouTube scripts, SEO-optimized titles/tags from search intelligence, and Thumbnails — all in one tool. Storio helps creators publish faster and rank higher.';

export const DEFAULT_KEYWORDS = [
  'AI scriptwriter',
  'AI script generator',
  'YouTube script generator',
  'video scriptwriting tool',
  'content creator tools',
  'AI writing assistant',
  'storio',
  'AI storytelling platform',
  'scriptwriting software',
  'video content automation',
].join(', ');

/**
 * Cache-bust query so WhatsApp / Facebook re-fetch after OG asset changes.
 * Bump when replacing share images.
 */
export const OG_IMAGE_VERSION = '3';

/** Primary landscape OG — 1200×630 JPEG (WhatsApp large preview / mobile) */
export const OG_IMAGE_PATH = `/og-image.jpg?v=${OG_IMAGE_VERSION}`;
/** Square OG — 1200×1200 (WhatsApp desktop compact thumbnail; no side-crop) */
export const OG_IMAGE_SQUARE_PATH = `/og-image-square.jpg?v=${OG_IMAGE_VERSION}`;
export const OG_IMAGE_PNG_PATH = `/og-image.png?v=${OG_IMAGE_VERSION}`;

export const OG_IMAGE = `${SITE_URL}${OG_IMAGE_PATH}`;
export const OG_IMAGE_SQUARE = `${SITE_URL}${OG_IMAGE_SQUARE_PATH}`;
export const OG_IMAGE_PNG = `${SITE_URL}${OG_IMAGE_PNG_PATH}`;

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_SQUARE_SIZE = 1200;

export const COMPANY = {
  name: 'Morpho Technologies Pvt Ltd',
  email: 'Support@storio.tech',
  phone: '+91-9000449855',
};

export const PUBLIC_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/blog', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/app/content-vault', priority: 0.85, changeFrequency: 'daily' as const },
  { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/terms-and-conditions', priority: 0.3, changeFrequency: 'yearly' as const },
  { path: '/cancellation-policy', priority: 0.3, changeFrequency: 'yearly' as const },
  {
    path: '/cancellation-and-refund-policy',
    priority: 0.3,
    changeFrequency: 'yearly' as const,
  },
];

export function absoluteUrl(path = '/'): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export function ogImages(alt: string = DEFAULT_TITLE) {
  return [
    // Square first: WhatsApp Desktop/Web often uses a square thumbnail and
    // center-crops landscape banners (cuts off logo/text). Letterboxed square
    // keeps the full creative sharp and readable.
    {
      url: OG_IMAGE_SQUARE,
      secureUrl: OG_IMAGE_SQUARE,
      width: OG_IMAGE_SQUARE_SIZE,
      height: OG_IMAGE_SQUARE_SIZE,
      alt,
      type: 'image/jpeg',
    },
    {
      url: OG_IMAGE,
      secureUrl: OG_IMAGE,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt,
      type: 'image/jpeg',
    },
    {
      url: OG_IMAGE_PNG,
      secureUrl: OG_IMAGE_PNG,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt,
      type: 'image/png',
    },
  ];
}

type PageMetadataOptions = {
  title: string;
  description?: string;
  path: string;
  noIndex?: boolean;
  ogImage?: string;
  keywords?: string;
};

export function createPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noIndex = false,
  ogImage,
  keywords,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);
  const images = ogImage
    ? [
        {
          url: ogImage.startsWith('http') ? ogImage : absoluteUrl(ogImage),
          secureUrl: ogImage.startsWith('http') ? ogImage : absoluteUrl(ogImage),
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: title,
          type: ogImage.endsWith('.png') ? 'image/png' : 'image/jpeg',
        },
      ]
    : ogImages(title);

  return {
    title,
    description,
    keywords: keywords ?? DEFAULT_KEYWORDS,
    alternates: {
      canonical: url,
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((img) => img.url),
    },
  };
}

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  legalName: COMPANY.name,
  url: SITE_URL,
  logo: absoluteUrl('/header-logo.png'),
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: COMPANY.email,
    telephone: COMPANY.phone,
    contactType: 'customer support',
    availableLanguage: ['English'],
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Plot no. MIG 891, KPHB Phase 3, Kukatpally',
    addressLocality: 'Hyderabad',
    addressRegion: 'Telangana',
    postalCode: '500072',
    addressCountry: 'IN',
  },
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  publisher: {
    '@type': 'Organization',
    name: COMPANY.name,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/header-logo.png'),
    },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search/{search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
    url: absoluteUrl('/pricing'),
  },
  creator: {
    '@type': 'Organization',
    name: COMPANY.name,
  },
};

