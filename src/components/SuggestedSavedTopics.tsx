'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ListFilter, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  SUGGESTED_TOPICS_MAX,
  fetchSavedIdeaCategories,
  fetchSuggestedTopicsAll,
  fetchSuggestedTopicsForCategories,
  fetchSuggestedTopicsForCategory,
  parseProfileCategories,
} from '@/lib/suggested-saved-topics';

type Props = {
  onPickTopic: (topic: string) => void;
};

/** Filter value for "the categories the user picked at sign-up" (user_profiles.categories). */
const MY_CATEGORIES = '__my_categories__';
/** Filter value for topics from every category. */
const ALL_CATEGORIES = '__all_categories__';
/** "My categories" is the default only when it has at least this many topics; otherwise All. */
const MY_CATEGORIES_MIN_TOPICS = 30;

function fetchTopicsFor(selection: string, profileCategories: string[], userId: string | null) {
  if (selection === MY_CATEGORIES) {
    return fetchSuggestedTopicsForCategories({ categories: profileCategories, userId, limit: SUGGESTED_TOPICS_MAX });
  }
  if (selection === ALL_CATEGORIES) {
    return fetchSuggestedTopicsAll({ userId, limit: SUGGESTED_TOPICS_MAX });
  }
  return fetchSuggestedTopicsForCategory({ category: selection, userId, limit: SUGGESTED_TOPICS_MAX });
}

export function SuggestedSavedTopics({ onPickTopic }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [profileCategories, setProfileCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  /** Topics per filter value — switching back to a filter does not refetch. */
  const topicsCacheRef = useRef(new Map<string, string[]>());

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

      // Sign-up categories first (spelled as saved_ideas spells them), then everything else.
      const mine = profileCats.map(
        (cat) => savedCats.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? cat,
      );
      const mineKeys = new Set(mine.map((c) => c.toLowerCase()));
      const list = [...mine, ...savedCats.filter((c) => !mineKeys.has(c.toLowerCase()))];

      // Default filter: the user's own categories when they have enough topics, else All.
      let initial = ALL_CATEGORIES;
      if (mine.length) {
        const mineTopics = await fetchTopicsFor(MY_CATEGORIES, mine, uid);
        if (cancelled) return;
        topicsCacheRef.current.set(MY_CATEGORIES, mineTopics);
        if (mineTopics.length >= MY_CATEGORIES_MIN_TOPICS) initial = MY_CATEGORIES;
      }

      setUserId(uid);
      setCategories(list);
      setProfileCategories(mine);
      setSelectedCategory(initial);
      setLoadingCats(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingCats) return;
    if (!selectedCategory.trim()) {
      setTopics([]);
      setLoadingTopics(false);
      return;
    }
    const cached = topicsCacheRef.current.get(selectedCategory);
    if (cached) {
      setTopics(cached);
      setLoadingTopics(false);
      return;
    }
    let cancelled = false;
    setLoadingTopics(true);
    setTopics([]);
    void (async () => {
      const list = await fetchTopicsFor(selectedCategory, profileCategories, userId);
      topicsCacheRef.current.set(selectedCategory, list);
      // A quicker answer for an older pick must not replace the current one.
      if (cancelled) return;
      setTopics(list);
      setLoadingTopics(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, profileCategories, userId, loadingCats]);

  const showingMine = selectedCategory === MY_CATEGORIES;
  const showingAll = selectedCategory === ALL_CATEGORIES;
  const selectedLabel = showingMine ? 'My categories' : showingAll ? 'All' : selectedCategory;

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
            {selectedLabel ? (
              <span
                className={`max-w-[140px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  filterOpen ? 'bg-white/15 text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]'
                }`}
              >
                {selectedLabel}
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
                <li role="option" aria-selected={showingAll}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(ALL_CATEGORIES);
                      setFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#f5f5f7] ${
                      showingAll ? 'font-semibold text-[#1d1d1f] bg-[#f5f5f7]' : 'text-[#1d1d1f]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">All</span>
                      <span className="block truncate text-[11px] font-normal text-[#86868b]">Topics from every category</span>
                    </span>
                    {showingAll ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                  </button>
                </li>
                {profileCategories.length > 0 && (
                  <li role="option" aria-selected={showingMine}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(MY_CATEGORIES);
                        setFilterOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[#f5f5f7] ${
                        showingMine ? 'font-semibold text-[#1d1d1f] bg-[#f5f5f7]' : 'text-[#1d1d1f]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">My categories</span>
                        <span className="block truncate text-[11px] font-normal text-[#86868b]">
                          {profileCategories.join(', ')}
                        </span>
                      </span>
                      {showingMine ? <Check className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                    </button>
                  </li>
                )}
                <li aria-hidden className="my-1 border-t border-gray-100" />
                {categories.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-[#86868b]">No categories in saved ideas yet.</li>
                ) : (
                  categories.map((cat) => {
                    const active = cat.toLowerCase() === selectedCategory.toLowerCase();
                    return (
                      <li key={cat} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setFilterOpen(false);
                          }}
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
          {loadingCats ? 'Finding topics for you…' : 'Finding topics…'}
        </div>
      ) : topics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-[#fafafa] px-4 py-8 text-center text-sm text-[#86868b]">
          {showingMine
            ? 'No topics from other users in your categories yet. Try All or another category in Filter.'
            : showingAll
              ? 'No topics from other users yet.'
              : selectedCategory
              ? `No topics from other users in ${selectedCategory} yet.`
              : 'No topics to suggest yet.'}
        </p>
      ) : (
        <>
        {showingMine && (
          <p className="mb-2.5 text-xs text-[#86868b]">
            Based on your categories:{' '}
            <span className="font-medium text-[#6e6e73]">{profileCategories.join(', ')}</span>
          </p>
        )}
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
        </>
      )}
    </div>
  );
}
