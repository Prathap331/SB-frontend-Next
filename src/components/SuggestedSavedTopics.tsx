'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchSavedIdeaCategories,
  fetchSuggestedTopicsForCategory,
  parseProfileCategories,
} from '@/lib/suggested-saved-topics';

type Props = {
  onPickTopic: (topic: string) => void;
};

export function SuggestedSavedTopics({ onPickTopic }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCats(true);
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      let profileCats: string[] = [];
      if (uid) {
        const { data } = await supabase
          .from('user_profiles')
          .select('categories')
          .eq('id', uid)
          .maybeSingle();
        profileCats = parseProfileCategories(data?.categories);
      }
      const savedCats = await fetchSavedIdeaCategories();
      if (cancelled) return;

      const preferred = profileCats[0] || '';
      const list = [...savedCats];
      if (preferred) {
        const preferredIdx = list.findIndex(
          (cat) => cat.toLowerCase() === preferred.toLowerCase(),
        );
        if (preferredIdx > 0) {
          const [picked] = list.splice(preferredIdx, 1);
          list.unshift(picked);
        }
      }

      const initial =
        (preferred && list.find((c) => c.toLowerCase() === preferred.toLowerCase())) ||
        list[0] ||
        '';

      setUserId(uid);
      setCategories(list);
      setSelectedCategory(initial);
      setLoadingCats(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTopics = useCallback(async (category: string, uid: string | null) => {
    if (!category.trim()) {
      setTopics([]);
      setLoadingTopics(false);
      return;
    }
    setLoadingTopics(true);
    setTopics([]);
    const list = await fetchSuggestedTopicsForCategory({
      category,
      userId: uid,
      limit: 20,
    });
    setTopics(list);
    setLoadingTopics(false);
  }, []);

  useEffect(() => {
    if (loadingCats) return;
    void loadTopics(selectedCategory, userId);
  }, [selectedCategory, userId, loadTopics, loadingCats]);

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [filterOpen]);

  return (
    <div className="relative overflow-visible">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[#1d1d1f]">Suggested topics</h2>

        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
            disabled={loadingCats}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label="Filter topics by category"
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              filterOpen
                ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-gray-300'
            }`}
          >
            <ListFilter className="h-4 w-4 flex-shrink-0" />
            <span>Filter</span>
            {selectedCategory ? (
              <span
                className={`max-w-[140px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  filterOpen ? 'bg-white/15 text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'
                }`}
              >
                {selectedCategory}
              </span>
            ) : null}
            <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-2.5rem,280px)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <p className="border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#86868b]">
                Categories
              </p>
              <ul
                role="listbox"
                aria-label="Categories"
                className="max-h-80 overflow-y-auto overflow-x-hidden overscroll-contain py-1 [scrollbar-width:thin]"
              >
                {categories.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[#86868b]">No categories in saved ideas yet.</li>
                ) : (
                  categories.map((cat) => {
                    const active = cat.toLowerCase() === selectedCategory.toLowerCase();
                    return (
                      <li key={cat} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#f5f5f7] ${
                            active ? 'font-semibold text-[#1d1d1f] bg-[#f5f5f7]' : 'text-[#1d1d1f]'
                          }`}
                        >
                          <span className="min-w-0 truncate">{cat}</span>
                          {active ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {loadingCats || loadingTopics ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[#86868b]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingCats ? 'Loading categories…' : 'Finding topics…'}
        </div>
      ) : topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-[#fafafa] px-4 py-8 text-center text-sm text-[#86868b]">
          {selectedCategory
            ? `No topics from other users in ${selectedCategory} yet.`
            : 'No topics to suggest yet.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => onPickTopic(topic)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-left text-sm font-medium text-[#1d1d1f] transition-colors hover:border-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              <span className="min-w-0 break-words">{topic}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
