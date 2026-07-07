import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Blog — Creator Guides & Scriptwriting Tips',
  description:
    'Read Storio’s blog for YouTube scriptwriting tips, AI workflow guides, and creator growth strategies.',
  path: '/blog',
  keywords:
    'YouTube scriptwriting blog, AI script tips, content creator guides, storio blog',
});

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
