import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Script Vault — Ready-to-Use YouTube Scripts',
  description:
    'Browse Storio’s script vault of AI-generated YouTube scripts across categories. Discover topics and generate your next video script faster.',
  path: '/scripts',
  keywords:
    'YouTube script examples, AI script vault, video script templates, storio scripts library',
});

export default function ScriptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
