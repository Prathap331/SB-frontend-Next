'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import { isExemptFromLandingPrefix } from '@/lib/keyword-routes';

type PrefixedLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  /** Skip landing-keyword prefix (e.g. external or script routes) */
  raw?: boolean;
};

export default function PrefixedLink({
  href,
  raw = false,
  ...props
}: PrefixedLinkProps) {
  const { landingPath } = useKeywordNavigation();
  const resolved =
    raw || href.startsWith('http') || isExemptFromLandingPrefix(href)
      ? href
      : landingPath(href);

  return <Link href={resolved} {...props} />;
}
