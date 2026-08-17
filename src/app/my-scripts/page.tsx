'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, FileText, Loader2, Clock } from 'lucide-react';
import StudioShell from '@/components/studio/StudioShell';
import { supabase } from '@/lib/supabaseClient';
import { buildStudioTabPath, setStudioTopicCookie, type StudioTabId } from '@/lib/keyword-routes';

type ScriptRow = {
  id: string;
  title: string | null;
  topic: string | null;
  script: string | null;
  metrics?: { totalWords?: number; videoLength?: number } | null;
  created_at: string;
};

function resolveReturnTab(raw: string | null): StudioTabId {
  if (
    raw === 'audio' ||
    raw === 'script' ||
    raw === 'metadata' ||
    raw === 'thumbnails' ||
    raw === 'ideas' ||
    raw === 'broll'
  ) {
    return raw;
  }
  return 'script';
}

export function MyScriptsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTab = resolveReturnTab(searchParams.get('returnTab'));
  const [myScripts, setMyScripts] = useState<ScriptRow[]>([]);
  const [isLoadingScripts, setIsLoadingScripts] = useState(true);

  useEffect(() => {
    const fetchScripts = async () => {
      setIsLoadingScripts(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth');
          return;
        }
        const { data, error } = await supabase
          .from('scripts_assigned')
          .select('id, title, topic, script, metrics, created_at')
          .eq('userId', session.user.id)
          .order('created_at', { ascending: false });
        if (!error && data) setMyScripts(data as ScriptRow[]);
        if (error) console.error('[my-scripts]', error.message);
      } finally {
        setIsLoadingScripts(false);
      }
    };
    fetchScripts();
  }, [router]);

  const openScript = (script: ScriptRow) => {
    if (script.topic?.trim()) setStudioTopicCookie(script.topic.trim());
    router.push(
      buildStudioTabPath(returnTab, {
        topic: script.topic,
        ideaTitle: script.title || script.topic || 'Script',
        scriptId: script.id,
      }),
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1
          className={`${embedded ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} font-semibold tracking-tight text-[#1d1d1f] mb-1`}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          My Scripts
        </h1>
        <p className={`${embedded ? 'text-base sm:text-lg' : 'text-sm'} text-[#6e6e73] font-light`}>
          {returnTab === 'audio'
            ? 'Choose a script to generate speech'
            : "Scripts you've unlocked — ready to produce"}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">Unlocked scripts</h2>
            <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">
              {returnTab === 'audio'
                ? 'Select a script to load it in the Audio tab'
                : 'View and open scripts saved to your account'}
            </p>
          </div>
          {!isLoadingScripts && myScripts.length > 0 && (
            <span className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2.5 py-1 rounded-full">
              {myScripts.length} script{myScripts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="px-6 py-4 space-y-3">
          {isLoadingScripts ? (
            <div className="flex items-center gap-2 py-8 justify-center text-[#6e6e73]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-light">Loading scripts…</span>
            </div>
          ) : myScripts.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <FileText className="w-8 h-8 text-gray-200 mx-auto" />
              <p className="text-sm text-[#6e6e73]">No unlocked scripts yet.</p>
              <p className="text-[11px] text-[#6e6e73] font-light">
                Generate a script and unlock it to see it here.
              </p>
            </div>
          ) : (
            myScripts.map((script) => {
              const wordCount = script.metrics?.totalWords ?? 0;
              const duration = script.metrics?.videoLength;
              const dateStr = script.created_at
                ? new Date(script.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';

              return (
                <div
                  key={script.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f5f5f7] rounded-2xl border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    {script.topic && (
                      <span className="inline-flex max-w-full items-center mb-2 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-[10px] font-bold tracking-wide text-amber-800 uppercase line-clamp-1">
                        {script.topic}
                      </span>
                    )}
                    <p className="text-sm font-medium text-[#1d1d1f] truncate">
                      {script.title || 'Untitled Script'}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-[#6e6e73] font-light">{dateStr}</span>
                      {wordCount > 0 && (
                        <span className="text-[11px] text-[#6e6e73] font-light">
                          {wordCount.toLocaleString()} words
                        </span>
                      )}
                      {duration != null && duration > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#6e6e73] font-light">
                          <Clock className="w-3 h-3" />
                          {Math.round(duration * 10) / 10} min
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openScript(script)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white hover:bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {returnTab === 'audio' ? 'Use for audio' : 'View Script'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MyScriptsPageInner() {
  return (
    <StudioShell>
      <MyScriptsPanel embedded />
    </StudioShell>
  );
}

export default function MyScriptsPage() {
  return (
    <Suspense
      fallback={
        <StudioShell>
          <div className="flex items-center justify-center py-16 text-[#6e6e73]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        </StudioShell>
      }
    >
      <MyScriptsPageInner />
    </Suspense>
  );
}
