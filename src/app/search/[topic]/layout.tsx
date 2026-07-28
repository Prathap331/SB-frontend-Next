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
      title: 'Storio AI - Automated Youtube Script and Metadata, Thumbnail Generator ',
      description:
        'Generate YouTube scripts, SEO-optimized titles/tags from search intelligence, and Thumbnails — all in one tool. Storio helps creators publish faster and rank higher.',
      path: `/${DEFAULT_SEARCH_SLUG}/app`,
      keywords: 'YouTube content ideas, AI script generator, topic research',
    });
  }

  return createPageMetadata({
    title: `Storio AI - Automated Youtube Script and Metadata, Thumbnail Generator `,
    description: `Generate YouTube scripts, SEO-optimized titles/tags from search intelligence, and Thumbnails — all in one tool. Storio helps creators publish faster and rank higher.`,
    path: `/search/${encodeURIComponent(decodedTopic)}`,
    keywords: `${decodedTopic}, YouTube script ideas, AI script generator, ${decodedTopic} video script`,
  });
}

export default function SearchTopicLayout({ children }: LayoutProps) {
  return children;
}
