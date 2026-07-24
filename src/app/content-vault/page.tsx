'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';
import StudioShell from '@/components/studio/StudioShell';
import { supabase } from '@/lib/supabaseClient';
import {
  normalizeScriptCategory,
  normalizeScriptSubcategories,
} from '@/lib/script-persistence';

type ScriptRow = {
  id: string;
  title: string | null;
  topic: string | null;
  script: string | null;
  created_at: string;
  youtube_metadata?: unknown;
  thumbnail?: unknown;
  metrics?: { videoLength?: number; totalWords?: number } | null;
  sources?: string[] | null;
  books?: Array<{ title?: string; author?: string }> | null;
  structure?: Array<{ name: string; percentage: number }> | null;
  category?: unknown;
  sub_category?: unknown;
};

const PAGE_SIZE = 20;
/** Supabase/PostgREST default max rows per request — page through to get everything */
const FETCH_PAGE = 1000;

const DURATION_RANGES = [
  { label: '0 – 5 min',  min: 0,  max: 5  },
  { label: '5 – 10 min', min: 5,  max: 10 },
  { label: '10 – 15 min',min: 10, max: 15 },
  { label: '15+ min',    min: 15, max: Infinity },
];

function rowDuration(s: ScriptRow): number {
  return s.metrics?.videoLength ?? 0;
}

function rowCategory(s: ScriptRow): string | null {
  return normalizeScriptCategory(s.category);
}

function rowSubcategories(s: ScriptRow): string[] {
  return normalizeScriptSubcategories(s.sub_category);
}

async function fetchAllUniversalScripts(): Promise<ScriptRow[]> {
  const all: ScriptRow[] = [];
  let from = 0;

  for (;;) {
    const to = from + FETCH_PAGE - 1;
    const { data, error } = await supabase
      .from('scripts_universal')
      .select(
        `id, title, topic, script, youtube_metadata, thumbnail, metrics, sources, books, structure, created_at, category, sub_category, "thumbnail-generated"`,
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[content-vault] scripts_universal fetch failed:', error.message);
      throw error;
    }

    const batch = (data ?? []) as ScriptRow[];
    all.push(...batch);

    if (batch.length < FETCH_PAGE) break;
    from += FETCH_PAGE;
  }

  return all;
}

export function ContentVaultPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [scripts, setScripts]   = useState<ScriptRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage]         = useState(1);
  const [durationFilter, setDurationFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const rows = await fetchAllUniversalScripts();
        if (!cancelled) setScripts(rows);
      } catch (e: any) {
        if (!cancelled) {
          setScripts([]);
          setFetchError(e?.message || 'Failed to load scripts from Content Vault.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of scripts) {
      const c = rowCategory(s);
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scripts]);

  const subCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of scripts) {
      const cat = rowCategory(s);
      if (categoryFilter && cat !== categoryFilter) continue;
      for (const sub of rowSubcategories(s)) set.add(sub);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [scripts, categoryFilter]);

  const filtered = useMemo(() => {
    return scripts.filter((s) => {
      if (durationFilter) {
        const range = DURATION_RANGES.find((r) => r.label === durationFilter);
        if (range) {
          const d = rowDuration(s);
          if (!(d >= range.min && d < range.max)) return false;
        }
      }
      if (categoryFilter) {
        if (rowCategory(s) !== categoryFilter) return false;
      }
      if (subCategoryFilter) {
        if (!rowSubcategories(s).includes(subCategoryFilter)) return false;
      }
      return true;
    });
  }, [scripts, durationFilter, categoryFilter, subCategoryFilter]);

  useEffect(() => { setPage(1); }, [durationFilter, categoryFilter, subCategoryFilter]);

  useEffect(() => {
    if (subCategoryFilter && !subCategoryOptions.includes(subCategoryFilter)) {
      setSubCategoryFilter('');
    }
  }, [subCategoryOptions, subCategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount =
    (durationFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (subCategoryFilter ? 1 : 0);
  const clearFilters = () => {
    setDurationFilter('');
    setCategoryFilter('');
    setSubCategoryFilter('');
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className={`${embedded ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl md:text-4xl'} font-semibold tracking-tight text-[#1d1d1f] mb-1`}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          Content Vault
        </h1>
        <p className={`${embedded ? 'text-base sm:text-lg' : 'text-sm'} text-[#6e6e73] font-light`}>
          Create Faster with Ready Scripts
          {!loading && !fetchError && scripts.length > 0 && (
            <span className="text-[#a1a1a6]"> · {filtered.length} shown</span>
          )}
        </p>
      </div>

      {fetchError && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15 min-w-[140px]"
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Sub-category</label>
            <select
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15 min-w-[160px]"
            >
              <option value="">All sub-categories</option>
              {subCategoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">Duration</label>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-[#f5f5f7] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15"
            >
              <option value="">All lengths</option>
              {DURATION_RANGES.map((r) => (
                <option key={r.label} value={r.label}>{r.label}</option>
              ))}
            </select>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6e6e73] hover:text-[#1d1d1f] px-3 py-2 rounded-xl border border-gray-200 bg-white"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${embedded ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-4`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/80 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded mb-3 w-4/5" />
              <div className="h-2.5 bg-gray-100 rounded mb-2 w-full" />
              <div className="h-2.5 bg-gray-100 rounded mb-2 w-5/6" />
              <div className="h-2.5 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FileText className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-[#6e6e73]">
            {activeFilterCount > 0 ? 'No scripts match your filters.' : 'No scripts yet — generate one to see it here.'}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs font-medium text-[#1d1d1f] underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${embedded ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4'} gap-4`}>
          {paginated.map((s) => {
            const duration = rowDuration(s);
            const category = rowCategory(s);
            const subs = rowSubcategories(s);
            return (
              <button
                key={s.id}
                onClick={() => router.push(`/script?scriptId=${s.id}`)}
                className="group text-left bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
              >
                {s.topic && (
                  <span className="inline-flex max-w-full items-center mb-2.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-[10px] font-bold tracking-wide text-amber-800 uppercase line-clamp-1">
                    {s.topic}
                  </span>
                )}
                <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-2 group-hover:text-black line-clamp-2">
                  {s.title || 'Untitled Script'}
                </p>
                <p className="text-[11px] text-[#6e6e73] font-light leading-relaxed line-clamp-4 mb-3">
                  {s.script ? s.script.slice(0, 200).replace(/\*+/g, '').trim() + '…' : 'No preview available.'}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {duration > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {Math.round(duration * 10) / 10} min
                    </span>
                  )}
                  {category && (
                    <span className="inline-flex items-center text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {category}
                    </span>
                  )}
                  {subs.slice(0, 3).map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] border border-gray-200 px-2 py-0.5 rounded-full"
                    >
                      {sub}
                    </span>
                  ))}
                  {subs.length > 3 && (
                    <span className="text-[10px] text-[#a1a1a6]">+{subs.length - 3}</span>
                  )}
                </div>
                <span className="text-[10px] text-[#a1a1a6] font-light">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
            .reduce<(number | '…')[]>((acc, n, idx, arr) => {
              if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
              acc.push(n);
              return acc;
            }, [])
            .map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} className="text-xs text-[#6e6e73] px-1">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={`w-9 h-9 rounded-xl text-xs font-semibold transition-colors ${
                    page === n
                      ? 'bg-[#1d1d1f] text-white'
                      : 'border border-gray-200 bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  {n}
                </button>
              ),
            )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AllScriptsPage() {
  return (
    <StudioShell requireAuth={false}>
      <ContentVaultPanel embedded />
    </StudioShell>
  );
}
