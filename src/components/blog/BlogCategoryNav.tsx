'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { BlogCategory } from '@/lib/blog/types';
import { BLOG_CATEGORIES } from '@/lib/blog/types';

type BlogCategoryNavProps = {
  activeCategory?: BlogCategory | 'all';
  onCategoryChange?: (category: BlogCategory | 'all') => void;
  variant?: 'sidebar' | 'pills';
};

const CATEGORY_ORDER: BlogCategory[] = [
  'scriptwriting',
  'creator-tips',
  'ai-tools',
  'youtube-growth',
];

export default function BlogCategoryNav({
  activeCategory = 'all',
  onCategoryChange,
  variant = 'sidebar',
}: BlogCategoryNavProps) {
  const [internal, setInternal] = useState<BlogCategory | 'all'>(activeCategory);
  const current = onCategoryChange ? activeCategory : internal;

  const select = (category: BlogCategory | 'all') => {
    if (onCategoryChange) onCategoryChange(category);
    else setInternal(category);
  };

  if (variant === 'pills') {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => select('all')}
          className={`text-sm font-medium px-4 py-1.5 rounded-full transition-all ${
            current === 'all'
              ? 'bg-[#1d1d1f] text-white'
              : 'bg-white border border-gray-200 text-[#1d1d1f] hover:bg-[#f5f5f7]'
          }`}
        >
          All articles
        </button>
        {CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => select(key)}
            className={`text-sm font-medium px-4 py-1.5 rounded-full transition-all ${
              current === key
                ? 'bg-[#1d1d1f] text-white'
                : 'bg-white border border-gray-200 text-[#1d1d1f] hover:bg-[#f5f5f7]'
            }`}
          >
            {BLOG_CATEGORIES[key].label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <nav className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a1a1a6] mb-3">
          Categories
        </h2>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => select('all')}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                current === 'all'
                  ? 'bg-[#1d1d1f] text-white font-medium'
                  : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              All articles
            </button>
          </li>
          {CATEGORY_ORDER.map((key) => (
            <li key={key}>
              <button
                onClick={() => select(key)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  current === key
                    ? 'bg-[#1d1d1f] text-white font-medium'
                    : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                }`}
              >
                {BLOG_CATEGORIES[key].label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden lg:block pt-4 border-t border-gray-200">
        <p className="text-xs text-[#6e6e73] leading-relaxed font-light">
          Guides on scriptwriting, AI workflows, and YouTube growth for digital creators.
        </p>
        <Link
          href="/"
          className="inline-block mt-4 text-sm font-medium text-[#1d1d1f] hover:underline underline-offset-2"
        >
          Try Storio free →
        </Link>
      </div>
    </nav>
  );
}

export { CATEGORY_ORDER };
