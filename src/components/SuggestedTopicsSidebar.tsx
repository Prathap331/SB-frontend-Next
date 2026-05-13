'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, FileText, Clock, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type ScriptRow = {
  id: string;
  title: string | null;
  script: string | null;
  topic: string | null;
  duration: number | null;
};

const SCROLL_STEP = 160;

export default function SuggestedTopicsSidebar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch scripts from Supabase
  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from('scripts_universal')
        .select('id, title, script, topic, duration')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) setScripts(data as ScriptRow[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    return () => el.removeEventListener('scroll', updateArrows);
  }, [scripts]);

  const scroll = (dir: 'up' | 'down') => {
    trackRef.current?.scrollBy({ top: dir === 'down' ? SCROLL_STEP : -SCROLL_STEP, behavior: 'smooth' });
  };

  const handleClick = (id: string) => {
    router.push(`/script?scriptId=${id}`);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Label */}
      <div className="flex items-center justify-between px-0.5 mb-1">
        <p className="text-[10px] font-semibold tracking-widest text-[#6e6e73] uppercase">
          Suggested Scripts
        </p>
        <button
          onClick={() => router.push('/scripts')}
          className="flex items-center gap-1 text-[10px] font-medium text-[#1d1d1f] hover:text-black transition-colors"
        >
          View all <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Up arrow */}
      <button
        onClick={() => scroll('up')}
        aria-label="Scroll up"
        className={`w-full h-7 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
          canScrollUp ? 'opacity-100' : 'opacity-30 pointer-events-none'
        }`}
      >
        <ChevronUp className="w-3.5 h-3.5 text-[#1d1d1f]" />
      </button>

      {/* Cards track */}
      <div
        ref={trackRef}
        className="flex flex-col gap-3 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 220px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {loading ? (
          /* Skeleton */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-full bg-white border border-gray-200/80 rounded-xl p-3.5 animate-pulse">
              <div className="h-3 bg-gray-100 rounded mb-2 w-4/5" />
              <div className="h-2 bg-gray-100 rounded mb-1 w-full" />
              <div className="h-2 bg-gray-100 rounded w-3/4" />
            </div>
          ))
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <FileText className="w-6 h-6 text-gray-200" />
            <p className="text-[10px] text-[#6e6e73]">No scripts yet</p>
          </div>
        ) : (
          scripts.map(s => (
            <button
              key={s.id}
              onClick={() => handleClick(s.id)}
              className="group w-full text-left bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 flex-shrink-0"
            >
              <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-1.5 group-hover:text-black">
                {s.title || s.topic || 'Untitled Script'}
              </p>
              <p className="text-[10px] text-[#6e6e73] font-light leading-relaxed line-clamp-3 mb-2">
                {s.script ? s.script.slice(0, 160).replace(/\*+/g, '').trim() + '…' : 'No preview available.'}
              </p>
              {s.duration && (
                <span className="inline-flex gap-1 items-center text-[11px] font-semibold text-green-600 bg-green-100 border border-gray-200 px-2 py-1 rounded-full">
<Clock className='w-4 h-4'/>
                  {s.duration} min
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Down arrow */}
      <button
        onClick={() => scroll('down')}
        aria-label="Scroll down"
        className={`w-full h-7 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
          canScrollDown ? 'opacity-100' : 'opacity-30 pointer-events-none'
        }`}
      >
        <ChevronDown className="w-3.5 h-3.5 text-[#1d1d1f]" />
      </button>
    </div>
  );
}
