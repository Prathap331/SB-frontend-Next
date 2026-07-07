import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import BlogCard from '@/components/blog/BlogCard';
import { getRecommendedArticles } from '@/lib/blog/utils';

type RecommendedArticlesProps = {
  limit?: number;
  showViewAll?: boolean;
};

export default function RecommendedArticles({
  limit = 4,
  showViewAll = true,
}: RecommendedArticlesProps) {
  const articles = getRecommendedArticles(limit);

  return (
    <section className="bg-[#f5f5f7] py-10 sm:py-14 md:py-16 px-5 sm:px-8 border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
              Recommended articles
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#6e6e73] font-light">
              Scriptwriting tips and creator workflows from the Storio team
            </p>
          </div>
          {showViewAll && (
            <Link
              href="/blog"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] bg-white border border-gray-200 hover:border-gray-400 hover:bg-white px-4 py-2 rounded-full transition-all duration-200 flex-shrink-0"
            >
              View all <ArrowUpRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {articles.map((article) => (
            <BlogCard key={article.slug} article={article} />
          ))}
        </div>

        {showViewAll && (
          <div className="sm:hidden mt-6 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1d1d1f] bg-white border border-gray-200 px-4 py-2 rounded-full"
            >
              View all articles <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
