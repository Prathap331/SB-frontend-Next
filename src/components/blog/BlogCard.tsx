import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { BlogArticle } from '@/lib/blog/types';
import { BLOG_CATEGORIES } from '@/lib/blog/types';
import { formatArticleDate } from '@/lib/blog/utils';

type BlogCardProps = {
  article: BlogArticle;
  variant?: 'default' | 'featured' | 'compact';
};

export default function BlogCard({ article, variant = 'default' }: BlogCardProps) {
  const category = BLOG_CATEGORIES[article.category];

  if (variant === 'featured') {
    return (
      <Link
        href={`/blog/${article.slug}`}
        className="group grid lg:grid-cols-2 gap-6 lg:gap-10 items-center rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 hover:shadow-lg hover:shadow-black/[0.06] transition-all duration-300"
      >
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#f5f5f7]">
          <Image
            src={article.image}
            alt={article.imageAlt}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        </div>
        <div>
          <span className="inline-flex text-[11px] font-semibold uppercase tracking-widest text-[#6e6e73] mb-3">
            Featured · {category.label}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-3 group-hover:underline decoration-2 underline-offset-4">
            {article.title}
          </h2>
          <p className="text-[#6e6e73] text-base sm:text-lg font-light leading-relaxed mb-5">
            {article.description}
          </p>
          <div className="flex items-center gap-3 text-sm text-[#6e6e73]">
            <span>By {article.author}</span>
            <span aria-hidden>·</span>
            <span>{formatArticleDate(article.publishedAt)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.readTimeMinutes} min read
            </span>
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link
        href={`/blog/${article.slug}`}
        className="group block py-4 border-b border-gray-100 last:border-0"
      >
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6e6e73]">
          {category.label}
        </span>
        <h3 className="mt-1 text-base sm:text-lg font-semibold text-[#1d1d1f] group-hover:underline underline-offset-2">
          {article.title}
        </h3>
        <p className="mt-1 text-sm text-[#6e6e73] font-light line-clamp-2">
          {article.description}
        </p>
        <p className="mt-2 text-xs text-[#a1a1a6]">
          {formatArticleDate(article.publishedAt)} · {article.readTimeMinutes} min read
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg hover:shadow-black/[0.06] transition-all duration-300 h-full"
    >
      <div className="relative aspect-[16/10] bg-[#f5f5f7] overflow-hidden">
        <Image
          src={article.image}
          alt={article.imageAlt}
          fill
          className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#6e6e73] mb-2">
          {category.label}
        </span>
        <h3 className="text-lg font-semibold text-[#1d1d1f] mb-2 group-hover:underline underline-offset-2 line-clamp-2">
          {article.title}
        </h3>
        <p className="text-sm text-[#6e6e73] font-light leading-relaxed line-clamp-3 flex-1">
          {article.description}
        </p>
        <p className="mt-4 text-xs text-[#a1a1a6]">
          {formatArticleDate(article.publishedAt)} · {article.readTimeMinutes} min read
        </p>
      </div>
    </Link>
  );
}
