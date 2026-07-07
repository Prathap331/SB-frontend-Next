import type { BlogArticle, BlogCategory } from './types';
import { BLOG_ARTICLES } from './articles';

export function getAllArticles(): BlogArticle[] {
  return [...BLOG_ARTICLES].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((article) => article.slug === slug);
}

export function getArticlesByCategory(category: BlogCategory): BlogArticle[] {
  return getAllArticles().filter((article) => article.category === category);
}

export function getFeaturedArticle(): BlogArticle {
  return getAllArticles().find((article) => article.featured) ?? getAllArticles()[0];
}

export function getRecommendedArticles(limit = 4): BlogArticle[] {
  const recommended = getAllArticles().filter((article) => article.recommended);
  if (recommended.length >= limit) return recommended.slice(0, limit);
  return getAllArticles().slice(0, limit);
}

export function getRelatedArticles(slug: string, limit = 3): BlogArticle[] {
  const current = getArticleBySlug(slug);
  if (!current) return getAllArticles().slice(0, limit);

  const sameCategory = getAllArticles().filter(
    (article) => article.slug !== slug && article.category === current.category,
  );

  const fallback = getAllArticles().filter((article) => article.slug !== slug);
  const pool = sameCategory.length > 0 ? sameCategory : fallback;

  return pool.slice(0, limit);
}

export function getAllArticleSlugs(): string[] {
  return BLOG_ARTICLES.map((article) => article.slug);
}

export function formatArticleDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}
