import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Sign In',
  description: 'Sign in to your Storio account to generate AI-powered YouTube Content.',
  path: '/auth',
  noIndex: true,
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
