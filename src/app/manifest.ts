import type { MetadataRoute } from 'next';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI YouTube Script Generator`,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d1d1f',
    orientation: 'portrait-primary',
    lang: 'en',
    categories: ['productivity', 'business'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    id: SITE_URL,
  };
}
