import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Content Vault — Ready-to-Use youtube contents',
  description:
    'Browse Storio’s Content Vault of AI-generated youtube contents across categories. Discover topics and generate your next video script faster.',
  path: '/app/content-vault',
  keywords:
    'youtube content examples, AI Content Vault, video script templates, storio scripts library',
});

export default function ScriptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
