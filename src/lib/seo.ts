import type { Metadata } from 'next';

export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.storio.tech').replace(/\/$/, '');

export const SITE_NAME = 'Storio';

export const DEFAULT_TITLE = 'Storio — Write Your YouTube Script in 3 Minutes';

export const DEFAULT_DESCRIPTION =
  'AI that transforms your ideas into engaging, factual, research-backed YouTube Content. Generate scripts in 3 minutes with Storio.';

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

export const OG_IMAGE_PATH = '/og-image.png';

export const OG_IMAGE = `${SITE_URL}${OG_IMAGE_PATH}`;

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
  ogImage = OG_IMAGE,
  keywords,
}: PageMetadataOptions): Metadata {
  const url = absoluteUrl(path);

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
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
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
