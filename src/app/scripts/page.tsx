'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabaseClient';

type ScriptRow = {
  id: string;
  title: string | null;
  topic: string | null;
  script: string | null;
  duration: number | null;
  created_at: string;
  category: string | null;
  subcategories: string[] | null;
};

const PAGE_SIZE = 20;

const DURATION_RANGES = [
  { label: '0 – 5 min',  min: 0,  max: 5  },
  { label: '5 – 10 min', min: 5,  max: 10 },
  { label: '10 – 15 min',min: 10, max: 15 },
  { label: '15+ min',    min: 15, max: Infinity },
];

export default function AllScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts]   = useState<ScriptRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);

  // Filter state
  const [durationFilter, setDurationFilter]     = useState<string>('');
  const [categoryFilter, setCategoryFilter]     = useState<string>('');
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('');

  // Fetch all rows once — filtering/pagination done client-side
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('scripts_universal')
        .select('id, title, topic, script, duration, created_at, category, subcategories')
        .order('created_at', { ascending: false });
      if (!error && data) setScripts(data as ScriptRow[]);
      setLoading(false);
    };
    load();
  }, []);

  // Derive unique category + subcategory lists from fetched data
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    scripts.forEach(r => { if (r.category) s.add(r.category); });
    return [...s].sort();
  }, [scripts]);

  const allSubcategories = useMemo(() => {
    const s = new Set<string>();
    scripts.forEach(r => { (r.subcategories ?? []).forEach(sub => s.add(sub)); });
    return [...s].sort();
  }, [scripts]);

  // Apply filters
  const filtered = useMemo(() => {
    return scripts.filter(s => {
      if (durationFilter) {
        const range = DURATION_RANGES.find(r => r.label === durationFilter);
        if (range) {
          const d = s.duration ?? 0;
          if (d < range.min || d >= range.max) return false;
        }
      }
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (subcategoryFilter && !(s.subcategories ?? []).includes(subcategoryFilter)) return false;
      return true;
    });
  }, [scripts, durationFilter, categoryFilter, subcategoryFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [durationFilter, categoryFilter, subcategoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [durationFilter, categoryFilter, subcategoryFilter].filter(Boolean).length;
  const clearFilters = () => { setDurationFilter(''); setCategoryFilter(''); setSubcategoryFilter(''); };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <main className="max-w-screen-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="mb-6">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-1"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Script Vault
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">
          Create Faster with Ready Scripts
          </p>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm px-5 py-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">


            {/* Category */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-semibold tracking-widest text-[#6e6e73] uppercase mb-1.5">Category</label>
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]"
              >
                <option value="">All categories</option>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Subcategory */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-semibold tracking-widests text-[#6e6e73] uppercase mb-1.5">Subcategory</label>
              <select
                value={subcategoryFilter}
                onChange={e => setSubcategoryFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]"
              >
                <option value="">All subcategories</option>
                {allSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Duration */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-semibold tracking-widest text-[#6e6e73] uppercase mb-1.5">Duration</label>
              <select
                value={durationFilter}
                onChange={e => setDurationFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#f5f5f7] text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f]"
              >
                <option value="">All durations</option>
                {DURATION_RANGES.map(r => (
                  <option key={r.label} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>
            
            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Result count */}
          {!loading && (
            <p className="text-[11px] text-[#6e6e73] mt-3 font-light">
              {filtered.length} script{filtered.length !== 1 ? 's' : ''} found
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active` : ''}
            </p>
          )}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginated.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/script?scriptId=${s.id}`)}
                className="group text-left bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
              >
                <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-2 group-hover:text-black line-clamp-2">
                  {s.title || s.topic || 'Untitled Script'}
                </p>
                <p className="text-[11px] text-[#6e6e73] font-light leading-relaxed line-clamp-4 mb-3">
                  {s.script ? s.script.slice(0, 200).replace(/\*+/g, '').trim() + '…' : 'No preview available.'}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {s.duration && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {s.duration} min
                    </span>
                  )}
                  {s.category && (
                    <span className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] border border-gray-200 px-2 py-0.5 rounded-full">
                      {s.category}
                    </span>
                  )}
                  {(s.subcategories ?? []).slice(0, 2).map(sub => (
                    <span key={sub} className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] border border-gray-200 px-2 py-0.5 rounded-full">
                      {sub}
                    </span>
                  ))}
                </div>
                <span className="text-[10px] text-[#a1a1a6] font-light">
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
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
                    className={`w-9 h-9 rounded-xl text-xs font-medium transition-colors ${
                      page === n
                        ? 'bg-[#1d1d1f] text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
