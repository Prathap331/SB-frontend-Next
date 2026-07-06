import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Teleprompter',
  description: 'Practice and record your YouTube scripts with the Storio teleprompter.',
  path: '/teleprompter',
  noIndex: true,
});

export default function TeleprompterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
