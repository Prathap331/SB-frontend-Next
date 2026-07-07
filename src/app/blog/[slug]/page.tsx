import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarkdownContent from '@/components/blog/MarkdownContent';
import BlogCard from '@/components/blog/BlogCard';
import JsonLd from '@/components/seo/JsonLd';
import { BLOG_CATEGORIES } from '@/lib/blog/types';
import {
  formatArticleDate,
  getAllArticleSlugs,
  getArticleBySlug,
  getRelatedArticles,
} from '@/lib/blog/utils';
import { absoluteUrl, SITE_NAME } from '@/lib/seo';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const { createPageMetadata } = await import('@/lib/seo');
  return createPageMetadata({
    title: article.title,
    description: article.description,
    path: `/blog/${article.slug}`,
    ogImage: article.image,
    keywords: `${article.title}, ${BLOG_CATEGORIES[article.category].label}, YouTube scriptwriting`,
  });
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) notFound();

  const category = BLOG_CATEGORIES[article.category];
  const related = getRelatedArticles(slug, 3);

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: article.image,
    datePublished: article.publishedAt,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/header-logo.png'),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${article.slug}`),
  };

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={articleJsonLd} />
      <Header />

      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-[#fafafa]">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm text-[#6e6e73]">
            <Link href="/blog" className="hover:text-[#1d1d1f] transition-colors">
              Blog
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link
              href={`/blog?category=${article.category}`}
              className="hover:text-[#1d1d1f] transition-colors"
            >
              {category.label}
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#1d1d1f] font-medium line-clamp-1">{article.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero image */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[2.4/1] max-h-[420px] bg-[#f5f5f7]">
        <Image
          src={article.image}
          alt={article.imageAlt}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Article header */}
      <header className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 pb-8">
        <span className="inline-flex text-[11px] font-semibold uppercase tracking-widest text-[#6e6e73] mb-4">
          {category.label}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f] leading-[1.1] mb-5">
          {article.title}
        </h1>
        <p className="text-lg sm:text-xl text-[#6e6e73] font-light leading-relaxed mb-6">
          {article.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#6e6e73] pb-6 border-b border-gray-200">
          <span className="font-medium text-[#1d1d1f]">By {article.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {article.readTimeMinutes} min read
          </span>
        </div>
      </header>

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-5 sm:px-8 pb-12">
        <MarkdownContent content={article.content} />
      </article>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 pb-14">
        <div className="rounded-2xl bg-[#f5f5f7] border border-gray-200 p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] mb-2">
            Write your next script in 3 minutes
          </h2>
          <p className="text-[#6e6e73] font-light mb-5 text-sm sm:text-base">
            Put these ideas into practice—generate a research-backed YouTube script with Storio.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-[#1d1d1f] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-black transition-colors"
          >
            Try Storio free
          </Link>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="bg-[#f5f5f7] border-t border-gray-100 py-12 sm:py-14 px-5 sm:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] mb-6">
              Related reading
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((item) => (
                <BlogCard key={item.slug} article={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
