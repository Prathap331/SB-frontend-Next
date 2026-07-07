export type BlogCategory =
  | 'scriptwriting'
  | 'creator-tips'
  | 'ai-tools'
  | 'youtube-growth';

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  category: BlogCategory;
  author: string;
  publishedAt: string;
  readTimeMinutes: number;
  image: string;
  imageAlt: string;
  featured?: boolean;
  recommended?: boolean;
  content: string;
};

export const BLOG_CATEGORIES: Record<
  BlogCategory,
  { label: string; description: string }
> = {
  scriptwriting: {
    label: 'Scriptwriting',
    description: 'Structure, pacing, and storytelling for video scripts',
  },
  'creator-tips': {
    label: 'Creator Tips',
    description: 'Practical advice for YouTube creators',
  },
  'ai-tools': {
    label: 'AI & Tools',
    description: 'AI workflows and tools for content creation',
  },
  'youtube-growth': {
    label: 'YouTube Growth',
    description: 'Ideas, trends, and strategies to grow your channel',
  },
};
