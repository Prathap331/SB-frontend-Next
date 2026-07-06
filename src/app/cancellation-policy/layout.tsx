import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Cancellation Policy',
  description:
    'Learn how to cancel your Storio subscription, billing cycle rules, and what happens after cancellation.',
  path: '/cancellation-policy',
});

export default function CancellationPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
