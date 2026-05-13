'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FileText, Loader2 } from 'lucide-react';
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
};

export default function AllScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('scripts_universal')
        .select('id, title, topic, script, duration, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setScripts(data as ScriptRow[]);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-1"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Suggested Scripts
          </h1>
          <p className="text-sm text-[#6e6e73] font-light">
            Click any card to view and unlock the full script
          </p>
        </div>

        {/* Grid */}
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
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <FileText className="w-10 h-10 text-gray-200" />
            <p className="text-sm text-[#6e6e73]">No scripts yet — generate one to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scripts.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/script?scriptId=${s.id}`)}
                className="group text-left bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
              >
                <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-2 group-hover:text-black line-clamp-2">
                  {s.title || s.topic || 'Untitled Script'}
                </p>
                <p className="text-[11px] text-[#6e6e73] font-light leading-relaxed line-clamp-4 mb-3">
                  {s.script
                    ? s.script.slice(0, 200).replace(/\*+/g, '').trim() + '…'
                    : 'No preview available.'}
                </p>
                <div className="flex items-center justify-between">
                  {s.duration ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      {s.duration} min
                    </span>
                  ) : <span />}
                  <span className="text-[10px] text-[#a1a1a6] font-light">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
