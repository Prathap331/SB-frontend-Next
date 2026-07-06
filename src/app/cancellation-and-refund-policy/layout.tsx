import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Cancellation & Refund Policy',
  description:
    'Storio cancellation and refund policy for subscriptions, billing disputes, and exceptional refund cases.',
  path: '/cancellation-and-refund-policy',
});

export default function CancellationRefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
