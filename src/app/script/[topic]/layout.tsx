import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ topic: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { topic } = await params;
  const decodedTopic = decodeURIComponent(topic).trim();

  return createPageMetadata({
    title: `${decodedTopic} — AI YouTube Script`,
    description: `Read and generate a complete YouTube script for "${decodedTopic}" using Storio’s multi-agent AI scriptwriting pipeline.`,
    path: `/script/${encodeURIComponent(decodedTopic)}`,
    keywords: `${decodedTopic}, YouTube script, AI generated script, video scriptwriting`,
  });
}

export default function ScriptTopicLayout({ children }: LayoutProps) {
  return children;
}
