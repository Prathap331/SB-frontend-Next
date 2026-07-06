import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Terms & Conditions',
  description:
    'Terms and conditions governing your access to and use of the Storio AI scriptwriting platform and related services.',
  path: '/terms-and-conditions',
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
