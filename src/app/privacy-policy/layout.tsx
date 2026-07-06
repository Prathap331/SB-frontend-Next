import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Privacy Policy',
  description:
    'Read how Storio collects, uses, and protects your personal information in compliance with applicable data protection laws.',
  path: '/privacy-policy',
});

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
