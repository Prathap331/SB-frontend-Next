import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/seo';
import { isStudioComposeTopic, DEFAULT_SEARCH_SLUG } from '@/lib/keyword-routes';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ topic: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { topic } = await params;
  const decodedTopic = decodeURIComponent(topic).trim();

  if (isStudioComposeTopic(decodedTopic)) {
    return createPageMetadata({
      title: 'Content Ideas — AI YouTube Topic Research',
      description:
        'Search a topic and generate research-backed YouTube content ideas with Storio AI.',
      path: `/${DEFAULT_SEARCH_SLUG}/app`,
      keywords: 'YouTube content ideas, AI script generator, topic research',
    });
  }

  return createPageMetadata({
    title: `${decodedTopic} — YouTube Script Ideas & AI Generator`,
    description: `Generate research-backed YouTube Content about "${decodedTopic}" with Storio AI. Explore topic insights, trends, and script ideas in minutes.`,
    path: `/search/${encodeURIComponent(decodedTopic)}`,
    keywords: `${decodedTopic}, YouTube script ideas, AI script generator, ${decodedTopic} video script`,
  });
}

export default function SearchTopicLayout({ children }: LayoutProps) {
  return children;
}
