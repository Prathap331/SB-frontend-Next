import type { Metadata } from 'next';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  createPageMetadata,
} from '@/lib/seo';
import { isStudioComposeTopic, DEFAULT_LANDING_SLUG } from '@/lib/keyword-routes';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ topic: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { topic } = await params;
  const decodedTopic = decodeURIComponent(topic).trim();

  if (isStudioComposeTopic(decodedTopic)) {
    return createPageMetadata({
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      path: `/${DEFAULT_LANDING_SLUG}`,
      keywords: 'YouTube content ideas, AI script generator, topic research',
    });
  }

  return createPageMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: `/search/${encodeURIComponent(decodedTopic)}`,
    keywords: `${decodedTopic}, YouTube script ideas, AI script generator, ${decodedTopic} video script`,
  });
}

export default function SearchTopicLayout({ children }: LayoutProps) {
  return children;
}
