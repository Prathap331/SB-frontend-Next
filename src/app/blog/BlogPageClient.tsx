'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import PrefixedLink from '@/components/PrefixedLink';
import Header from '@/components/Header';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import Footer from '@/components/Footer';
import BlogCard from '@/components/blog/BlogCard';
import BlogCategoryNav, { CATEGORY_ORDER } from '@/components/blog/BlogCategoryNav';
import type { BlogCategory } from '@/lib/blog/types';
import { BLOG_CATEGORIES } from '@/lib/blog/types';
import {
  getAllArticles,
  getArticlesByCategory,
  getFeaturedArticle,
} from '@/lib/blog/utils';

export default function BlogPageClient() {
  const { homePath } = useKeywordNavigation();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const initialCategory =
    categoryParam && categoryParam in BLOG_CATEGORIES
      ? (categoryParam as BlogCategory)
      : 'all';

  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'all'>(initialCategory);

  useEffect(() => {
    if (categoryParam && categoryParam in BLOG_CATEGORIES) {
      setActiveCategory(categoryParam as BlogCategory);
    }
  }, [categoryParam]);

  const featured = getFeaturedArticle();
  const allArticles = getAllArticles().filter((a) => a.slug !== featured.slug);

  const filteredArticles = useMemo(() => {
    if (activeCategory === 'all') return allArticles;
    return getArticlesByCategory(activeCategory).filter((a) => a.slug !== featured.slug);
  }, [activeCategory, allArticles, featured.slug]);

  const clusters = useMemo(() => {
    if (activeCategory !== 'all') return [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      articles: getArticlesByCategory(category)
        .filter((a) => a.slug !== featured.slug)
        .slice(0, 3),
    })).filter((cluster) => cluster.articles.length > 0);
  }, [activeCategory, featured.slug]);

  return (
    <div className="min-h-screen bg-white">
      <Header />

     

      <div className="max-w-8xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] gap-10 lg:gap-14">
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <BlogCategoryNav
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </div>
          </aside>

          <div>
            <div className="lg:hidden mb-8">
              <BlogCategoryNav
                variant="pills"
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
              />
            </div>

            {activeCategory === 'all' && (
              <div className="mb-12">
                <BlogCard article={featured} variant="featured" />
              </div>
            )}

            {activeCategory !== 'all' ? (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] mb-6">
                  {BLOG_CATEGORIES[activeCategory].label}
                </h2>
                <p className="text-[#6e6e73] font-light mb-8 -mt-4">
                  {BLOG_CATEGORIES[activeCategory].description}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {filteredArticles.map((article) => (
                    <BlogCard key={article.slug} article={article} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-14">
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] mb-6">
                    Latest articles
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {allArticles.slice(0, 4).map((article) => (
                      <BlogCard key={article.slug} article={article} />
                    ))}
                  </div>
                </div>

                {clusters.map(({ category, articles }) => (
                  <div key={category} className="mb-14 last:mb-0">
                    <div className="flex items-end justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f]">
                          {BLOG_CATEGORIES[category].label}
                        </h2>
                        <p className="text-sm text-[#6e6e73] font-light mt-1">
                          {BLOG_CATEGORIES[category].description}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveCategory(category)}
                        className="text-sm font-medium text-[#1d1d1f] hover:underline underline-offset-2 flex-shrink-0"
                      >
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {articles.map((article) => (
                        <BlogCard key={article.slug} article={article} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <section className="bg-[#1d1d1f] text-white py-14 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            Ready to script your next video?
          </h2>
          <p className="text-[#a1a1a6] font-light mb-6">
            Turn any topic into a research-backed YouTube script in minutes with Storio.
          </p>
          <PrefixedLink
            href={homePath}
            className="inline-flex items-center justify-center bg-white text-[#1d1d1f] text-sm font-medium px-6 py-3 rounded-full hover:bg-[#f5f5f7] transition-colors"
          >
            Start writing free
          </PrefixedLink>
        </div>
      </section>

      <Footer />
    </div>
  );
}
