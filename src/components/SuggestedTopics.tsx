'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileText, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type ScriptRow = {
  id: string;
  title: string | null;
  topic: string | null;
  script: string | null;
  duration: number | null;
};

const CARD_GAP = 16;

export default function SuggestedTopics() {
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('universal_scripts')
        .select('id, title, topic, script, duration')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setScripts(data as ScriptRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [scripts]);

  const scroll = (dir: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const cardW = el.querySelector('button')?.offsetWidth ?? 288;
    el.scrollBy({ left: dir === 'right' ? cardW + CARD_GAP : -(cardW + CARD_GAP), behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="max-w-8xl mx-auto relative">
        <div className="flex gap-4 pb-3 pt-1 overflow-x-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64 sm:w-72 bg-white border border-gray-200/80 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded mb-3 w-4/5" />
              <div className="h-2.5 bg-gray-100 rounded mb-2 w-full" />
              <div className="h-2.5 bg-gray-100 rounded mb-2 w-5/6" />
              <div className="h-2.5 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="max-w-8xl mx-auto flex flex-col items-center gap-2 py-12 text-center">
        <FileText className="w-8 h-8 text-gray-200" />
        <p className="text-sm text-[#6e6e73]">No scripts yet — generate one to see it here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto relative">
      {/* Left arrow */}
      <button
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:scale-105 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft className="w-4 h-4 text-[#1d1d1f]" />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:scale-105 ${
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight className="w-4 h-4 text-[#1d1d1f]" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 pb-3 pt-1 overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {scripts.map(s => (
          <button
            key={s.id}
            onClick={() => router.push(`/script?scriptId=${s.id}`)}
            className="group flex-shrink-0 snap-start w-64 sm:w-72 text-left bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
          >
            <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-2 group-hover:text-black line-clamp-2">
              {s.title || s.topic || 'Untitled Script'}
            </p>
            <p className="text-[11px] text-[#6e6e73] font-light leading-relaxed line-clamp-4 mb-3">
              {s.script ? s.script.slice(0, 200).replace(/\*+/g, '').trim() + '…' : 'No preview available.'}
            </p>
            {s.duration && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />
                {s.duration} min
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
