import { headers } from 'next/headers';
import {
  DEFAULT_LANDING_SLUG,
  isLandingKeywordSlug,
  type LandingKeywordSlug,
} from '@/lib/keyword-routes';

export async function getRequestLandingSlug(): Promise<LandingKeywordSlug> {
  const headersList = await headers();
  const slug = headersList.get('x-landing-slug');
  if (slug && isLandingKeywordSlug(slug)) return slug;
  return DEFAULT_LANDING_SLUG;
}
