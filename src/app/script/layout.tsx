import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'AI Script Generator',
  description:
    'Generate, edit, and export research-backed YouTube Content with Storio’s AI scriptwriting workspace.',
  path: '/script',
  noIndex: true,
});

export default function ScriptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
