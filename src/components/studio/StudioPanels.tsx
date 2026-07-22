'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  FileText,
  Tag,
  Image as ImageIcon,
  Clapperboard,
  Check,
  Copy,
  Film,
  Clock,
  Heart,
  Search,
  History,
  BookOpen,
  Download,
  Link as LinkIcon,
  ExternalLink,
  Monitor,
  X,
  Unlock,
  Loader2,
  AlertCircle,
  Rocket,
  Target,
} from 'lucide-react';
import type { GeneratedScriptData } from '@/services/api';
import { unwrapScriptJson } from '@/lib/script-data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabaseClient';
import { getBackendUrl } from '@/lib/backend';
import { STORYBIT_PRODUCTION_GUIDE } from '@/lib/production-guide';
import { moveScriptToAssigned } from '@/lib/script-persistence';

function studioUnlockKey(topic: string, ideaTitle: string) {
  const safe = `${topic}_${ideaTitle}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `studio_${safe}_unlocked`;
}

export type StudioTab = 'ideas' | 'script' | 'metadata' | 'thumbnails' | 'broll';

const TABS: { id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ideas', label: 'Content Ideas', icon: Lightbulb },
  { id: 'script', label: 'Full Script', icon: FileText },
  { id: 'metadata', label: 'Metadata', icon: Tag },
  { id: 'thumbnails', label: 'Thumbnails', icon: ImageIcon },
  { id: 'broll', label: 'B-Roll', icon: Clapperboard },
];

export function StudioStageNav({
  active,
  onChange,
  completed,
}: {
  active: StudioTab;
  onChange: (tab: StudioTab) => void;
  completed?: Partial<Record<StudioTab, boolean>>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-all ${
              isActive
                ? 'bg-[#1d1d1f] text-white border-[#1d1d1f]'
                : 'bg-white text-[#1d1d1f] border-gray-200 hover:border-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {completed?.[id] && !isActive && (
              <Check className="w-3.5 h-3.5 text-green-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function extractSeo(data?: GeneratedScriptData | null) {
  if (!data) {
    return { titles: [] as string[], descriptions: [] as string[], hashtags: [] as string[][], thumbnails: [] as string[] };
  }
  const legacySeo: any = data.seo?.seo ?? data.seo ?? {};
  const ytMeta = data.youtube_metadata ?? data.seo?.youtube_metadata;

  const titles: string[] =
    (ytMeta?.titles?.length ? ytMeta.titles : null) ??
    (legacySeo?.recommended_titles ?? []).map((t: any) => t?.title).filter(Boolean);

  const descriptions: string[] = ytMeta?.descriptions ?? [];

  const legacyHashtags: string[] = (legacySeo?.hashtags ?? [])
    .map((h: any) => (typeof h === 'string' ? h : h?.hashtag))
    .filter(Boolean);
  const hashtags: string[][] =
    (ytMeta?.hashtags?.length ? ytMeta.hashtags : null) ??
    (legacyHashtags.length > 0 ? [legacyHashtags] : []);

  const thumbnails: string[] =
    (ytMeta?.thumbnail_text?.length ? ytMeta.thumbnail_text : null) ??
    (legacySeo?.thumbnail_brief ?? []).map((t: any) => t?.text_overlay).filter(Boolean);

  return { titles, descriptions, hashtags, thumbnails };
}

function CopyBtn({ text }: { text: string; id?: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200"
      onClick={() => navigator.clipboard.writeText(text).catch(() => {})}
    >
      <Copy className="w-3 h-3" />
      Copy
    </button>
  );
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function downloadThumbnailImage(text: string, index: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#1d1d1f');
  gradient.addColorStop(1, '#3d3d3a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';

  const lines = wrapCanvasText(ctx, text.toUpperCase(), canvas.width - 160);
  const lineHeight = 88;
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thumbnail-${index + 1}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function formatScriptNodes(text: string): React.ReactNode[] {
  if (!text) return [];
  const scriptText = unwrapScriptJson(text)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const nodes: React.ReactNode[] = [];
  const sections = scriptText.split(/\*\*\*/);

  sections.forEach((section, sectionIndex) => {
    const paragraphs = section.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((para, paraIndex) => {
      const parts: React.ReactNode[] = [];
      const boldRegex = /\*([^*\n]+?)\*/g;
      let lastIndex = 0;
      let keyCounter = 0;
      let match: RegExpExecArray | null;

      while ((match = boldRegex.exec(para)) !== null) {
        if (match.index > lastIndex) parts.push(para.slice(lastIndex, match.index));
        parts.push(
          <strong key={`b-${sectionIndex}-${paraIndex}-${keyCounter++}`}>{match[1]}</strong>,
        );
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < para.length) parts.push(para.slice(lastIndex));

      nodes.push(
        <p key={`p-${sectionIndex}-${paraIndex}`} className="mb-5">
          {parts.length > 0 ? parts : para}
        </p>,
      );
    });

    if (sectionIndex < sections.length - 1) {
      nodes.push(<hr key={`hr-${sectionIndex}`} className="my-6 border-gray-200" />);
    }
  });

  return nodes;
}

function splitScriptByStructure(
  script: string,
  structure: { name: string; percentage: number }[],
): string[] {
  const cleaned = unwrapScriptJson(script).replace(/\r\n/g, '\n').trim();
  if (!structure.length) return [cleaned];

  const words = cleaned.split(/\s+/);
  const totalWords = words.length;
  const chunks: string[] = [];
  let wordPos = 0;
  let cumulative = 0;

  structure.forEach((s, i) => {
    cumulative += s.percentage;
    const isLast = i === structure.length - 1;
    const endWord = isLast
      ? totalWords
      : Math.min(Math.round((cumulative / 100) * totalWords), totalWords);
    chunks.push(words.slice(wordPos, endWord).join(' '));
    wordPos = endWord;
  });

  return chunks;
}

export function StudioScriptPanel({
  data,
  ideaTitle,
  topic,
  durationMinutes,
  universalScriptId,
  initiallyUnlocked = false,
}: {
  data?: GeneratedScriptData | null;
  ideaTitle?: string;
  topic?: string;
  durationMinutes?: number;
  universalScriptId?: string | null;
  /** True when script was loaded from scripts_assigned (already unlocked) */
  initiallyUnlocked?: boolean;
}) {
  const router = useRouter();
  const [activeSegment, setActiveSegment] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scriptScrollRef = useRef<HTMLDivElement | null>(null);

  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [panelFocus, setPanelFocus] = useState<'sources' | 'books'>('sources');
  const [panelTopPx, setPanelTopPx] = useState(208);

  const [isUnlocked, setIsUnlocked] = useState(!!initiallyUnlocked);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [scriptSaved, setScriptSaved] = useState(false);
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  const [showProductionGuidePopup, setShowProductionGuidePopup] = useState(false);

  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const structureSegments = data?.structure ?? [];
  const scriptSegmentTexts = useMemo(
    () => splitScriptByStructure(data?.script || '', structureSegments),
    [data?.script, structureSegments],
  );

  const sourceUrls = data?.sources ?? data?.source_urls ?? [];
  const books = data?.books ?? data?.seo?.books ?? [];

  const unlockKey = studioUnlockKey(topic || '', ideaTitle || data?.title || '');

  useEffect(() => {
    setActiveSegment(0);
    setFeedbackRating('');
    setFeedbackComment('');
    setFeedbackSubmitted(false);
    setFeedbackError('');
    setScriptSaved(false);
    setShowSourcesPanel(false);

    if (initiallyUnlocked) {
      setIsUnlocked(true);
      try {
        localStorage.setItem(unlockKey, 'true');
      } catch { /* ignore */ }
      return;
    }

    try {
      setIsUnlocked(localStorage.getItem(unlockKey) === 'true');
    } catch {
      setIsUnlocked(false);
    }
  }, [data?.script, unlockKey, initiallyUnlocked]);

  useEffect(() => {
    if (!showSourcesPanel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSourcesPanel]);

  // Keep Sources/Books panel below the Content Ideas stage tabs
  useEffect(() => {
    const measure = () => {
      const el = document.getElementById('studio-stage-header');
      if (!el) {
        setPanelTopPx(208);
        return;
      }
      const bottom = Math.ceil(el.getBoundingClientRect().bottom);
      setPanelTopPx(Math.max(bottom, 120));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [showSourcesPanel, data?.script]);

  const scrollToSegment = (index: number) => {
    if (!isUnlocked) return;
    setActiveSegment(index);
    segmentRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openPanel = (focus: 'sources' | 'books') => {
    if (!isUnlocked) return;
    setPanelFocus(focus);
    setShowSourcesPanel(true);
  };

  const handleTeleprompter = () => {
    if (!isUnlocked || !data?.script) return;
    sessionStorage.setItem('teleprompter_script', data.script);
    router.push('/teleprompter');
  };

  const handleDownloadScript = () => {
    if (!isUnlocked || !data?.script) return;
    const blob = new Blob([data.script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ideaTitle || data.title || 'script').replace(/[^\w\-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating) return;
    setFeedbackSubmitting(true);
    setFeedbackError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from('Feedback').insert({
        Rating: feedbackRating,
        Comments: feedbackComment.trim() || null,
        Scripts: data?.script ?? null,
        userId: session?.user.id ?? null,
      });
      if (error) throw error;
      setFeedbackSubmitted(true);
    } catch (err: any) {
      setFeedbackError(err?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      const duration =
        durationMinutes ??
        (data?.metrics?.videoLength != null ? Math.round(data.metrics.videoLength) : 10);

      const res = await fetch(`${getBackendUrl()}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: session.user.id, duration }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.message === 'success') {
        setIsUnlocked(true);
        setShowProductionGuidePopup(true);

        if (json.remaining_credits !== undefined) {
          window.dispatchEvent(new Event('creditsUpdated'));
        }

        try {
          localStorage.setItem(unlockKey, 'true');
        } catch { /* ignore */ }

        if (!scriptSaved && data) {
          setScriptSaved(true);
          const saveTopic = topic || ideaTitle || data.title || 'Untitled';
          const result = await moveScriptToAssigned({
            userId: session.user.id,
            data,
            title: data.title || ideaTitle || saveTopic,
            topic: saveTopic,
            universalScriptId,
          });
          if (!result.ok) console.error('[scripts save]', result.error);
        }
      } else {
        setShowInsufficientPopup(true);
      }
    } catch (err) {
      console.error('Unlock error:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!data?.script) {
    return (
      <EmptyState
        title="No script yet"
        body="Generate a script from a content idea to see it here."
      />
    );
  }

  const m = data.metrics;
  const metrics = [
    { icon: FileText, label: 'Total Words', value: m?.totalWords ?? data.estimated_word_count ?? 0 },
    {
      icon: Clock,
      label: 'Video Length',
      value: m?.videoLength != null ? `${Math.round(m.videoLength * 10) / 10} min` : '—',
    },
    { icon: Heart, label: 'Emotional Depth', value: m?.emotionalDepth ?? data.analysis?.emotional_depth ?? '—' },
    { icon: Search, label: 'Research Facts', value: m?.researchFacts ?? data.analysis?.research_facts_count ?? 0 },
    { icon: History, label: 'Hist. Facts', value: m?.historical_facts ?? data.analysis?.history ?? 0 },
    { icon: BookOpen, label: 'Proverbs', value: m?.proverbs_count ?? data.analysis?.proverbs_count ?? 0 },
    { icon: Lightbulb, label: 'Examples', value: m?.generalExamples ?? data.analysis?.examples_count ?? 0 },
  ];

  const toolbarBtn =
    'flex items-center gap-1.5 text-[11px] font-medium text-[#1d1d1f] bg-[#f5f5f7] hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors';

  return (
    <>
    <div className={`space-y-5 transition-all duration-300 ${showSourcesPanel ? 'blur-sm' : ''}`}>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1d1d1f] break-words">
          {ideaTitle || data.title || 'Generated script'}
        </h2>
        <p className="text-sm text-[#6e6e73] font-light mt-0.5">Research-backed script · ready to record</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {metrics.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200/80 p-3 text-center shadow-sm">
            <Icon className="w-4 h-4 mx-auto mb-1.5 text-[#6e6e73]" />
            <div className="text-base font-bold text-[#1d1d1f]">{value}</div>
            <div className="text-[10px] text-[#6e6e73] font-light leading-tight">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[50vh] lg:h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-sm font-semibold text-[#1d1d1f]">Script Structure</h3>
              <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">Flow & section breakdown</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {structureSegments.length > 0 ? (
                <div className="space-y-2">
                  {structureSegments.map((seg, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-[#1d1d1f] text-white">
                          {index + 1}
                        </div>
                        {index < structureSegments.length - 1 && (
                          <div className="w-px bg-gray-200 flex-1 mt-1 min-h-[10px]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollToSegment(index)}
                        disabled={!isUnlocked}
                        className={`flex-1 text-left rounded-xl px-3 py-2 border min-w-0 mb-2 bg-[#f5f5f7] border-gray-100 transition-all duration-200 ${
                          isUnlocked ? 'hover:border-gray-300 hover:bg-white' : 'cursor-default opacity-80'
                        }`}
                      >
                        <p className="font-medium text-xs break-words text-[#1d1d1f]">
                          {seg.name}
                        </p>
                        <p className="text-[10px] text-[#6e6e73] mt-0.5 font-light">
                          {seg.percentage}% of script
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <History className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs text-[#6e6e73]">No structure data</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm h-[70vh] lg:h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-[#1d1d1f]">Script</h3>
                <p className="text-[11px] text-[#6e6e73] font-light">Full script with research &amp; structure</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openPanel('sources')}
                  disabled={!isUnlocked}
                  className={`${toolbarBtn} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  Sources
                </button>
                <button
                  type="button"
                  onClick={() => openPanel('books')}
                  disabled={!isUnlocked}
                  className={`${toolbarBtn} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Books
                </button>
                <button
                  type="button"
                  onClick={handleTeleprompter}
                  disabled={!isUnlocked}
                  className={`${toolbarBtn} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#f5f5f7]`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Teleprompter
                </button>
                {isUnlocked ? <CopyBtn text={data.script} /> : (
                  <button
                    type="button"
                    disabled
                    className={`${toolbarBtn} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  disabled={!isUnlocked}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1d1d1f]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <div
              ref={scriptScrollRef}
              className={`relative ${isUnlocked ? 'flex-1 overflow-y-auto' : 'overflow-hidden'}`}
              style={!isUnlocked ? { maxHeight: '82vh' } : undefined}
            >
              <div
                className={`px-6 sm:px-8 py-6 ${!isUnlocked ? 'select-none pointer-events-none' : ''}`}
              >
                <div
                  className="text-[#1d1d1f] leading-[1.9] text-[15px] sm:text-base max-w-3xl mx-auto text-justify"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  {scriptSegmentTexts.map((chunk, i) => (
                    <div
                      key={i}
                      ref={(el) => {
                        segmentRefs.current[i] = el;
                      }}
                      className="px-3 -mx-3"
                    >
                      {formatScriptNodes(chunk || '')}
                    </div>
                  ))}
                </div>
              </div>

              {!isUnlocked && (
                <>
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: '20%',
                      height: '20%',
                      backdropFilter: 'blur(7px)',
                      WebkitBackdropFilter: 'blur(7px)',
                      background: 'rgba(255,255,255,0.25)',
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: '60%',
                      height: '20%',
                      backdropFilter: 'blur(7px)',
                      WebkitBackdropFilter: 'blur(7px)',
                      background: 'rgba(255,255,255,0.25)',
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 bottom-0 pointer-events-none"
                    style={{
                      height: '20%',
                      background:
                        'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.97) 100%)',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleUnlock}
                      disabled={isUnlocking}
                      className="flex items-center gap-2.5 bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold px-7 py-3.5 rounded-2xl shadow-2xl shadow-black/20 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
                    >
                      {isUnlocking ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Unlocking…
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4" />
                          Unlock Script
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {isUnlocked && (
                <section className="max-w-3xl mx-auto px-6 sm:px-8 py-10">
                  <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-[#1d1d1f]">How was this script?</h3>
                      <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">
                        Your feedback helps us improve script quality
                      </p>
                    </div>

                    {feedbackSubmitted ? (
                      <div className="flex flex-col items-center gap-3 py-10">
                        <div className="w-12 h-12 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                          <span className="text-xl">🎉</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1d1d1f]">Thanks for your feedback!</p>
                        <p className="text-[11px] text-[#6e6e73] font-light">
                          We&apos;ll use it to make scripts even better.
                        </p>
                      </div>
                    ) : (
                      <div className="px-6 py-6 space-y-6">
                        <div>
                          <p className="text-xs font-medium text-[#1d1d1f] mb-3">Rate this script</p>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { label: 'Bad', emoji: '😞' },
                              { label: 'Ok', emoji: '😐' },
                              { label: 'Good', emoji: '😊' },
                              { label: 'Very Good', emoji: '😄' },
                              { label: 'Excellent', emoji: '🤩' },
                            ].map(({ label, emoji }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setFeedbackRating(label)}
                                className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border text-center transition-all duration-150 min-w-[72px] ${
                                  feedbackRating === label
                                    ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-md scale-[1.04]'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-[#f5f5f7]'
                                }`}
                              >
                                <span className="text-2xl leading-none">{emoji}</span>
                                <span
                                  className={`text-[10px] font-medium ${
                                    feedbackRating === label ? 'text-white' : 'text-[#6e6e73]'
                                  }`}
                                >
                                  {label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                            Comment <span className="text-[#6e6e73] font-light">(optional)</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="What did you like or what could be improved?"
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] text-sm placeholder-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/20 focus:border-[#1d1d1f] transition-all resize-none"
                          />
                        </div>

                        {feedbackError && (
                          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                            {feedbackError}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={handleFeedbackSubmit}
                          disabled={!feedbackRating || feedbackSubmitting}
                          className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {feedbackSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Submitting…
                            </>
                          ) : (
                            'Submit Feedback'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

      {showSourcesPanel && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-black/20"
          style={{ top: panelTopPx }}
          onClick={() => setShowSourcesPanel(false)}
          aria-hidden
        />
      )}

      <div
        className={`fixed right-0 bottom-0 w-full sm:w-[400px] bg-white border-l border-t border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          showSourcesPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ top: panelTopPx }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {panelFocus === 'books'
                ? `${books.length} Book${books.length === 1 ? '' : 's'}`
                : `${sourceUrls.length} Source${sourceUrls.length === 1 ? '' : 's'}`}
            </h2>
            <p className="text-[11px] text-[#6e6e73] font-light">
              {panelFocus === 'books'
                ? 'Books referenced during research'
                : 'Research sources used in this script'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSourcesPanel(false)}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="px-4 py-4 space-y-3">
            {panelFocus === 'sources' && (
              <>
                {sourceUrls.length > 0 ? (
                  sourceUrls.map((url, index) => {
                    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
                    let domain = '';
                    let domainInitial = '?';
                    try {
                      domain = new URL(href).hostname.replace('www.', '');
                      domainInitial = domain.charAt(0).toUpperCase();
                    } catch {
                      domain = url || 'Unknown source';
                      domainInitial = domain.charAt(0).toUpperCase();
                    }
                    return (
                      <a
                        key={index}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 bg-[#f5f5f7] hover:bg-gray-100 rounded-2xl p-4 transition-colors group border border-gray-100"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[#1d1d1f] font-semibold text-sm flex-shrink-0 shadow-sm">
                          {domainInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[#6e6e73] mb-0.5 font-light">{domain}</p>
                          <p className="text-xs font-medium text-[#1d1d1f] line-clamp-2 group-hover:text-blue-600 transition-colors break-all">
                            {url}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            Visit source <ExternalLink className="w-3 h-3" />
                          </div>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#6e6e73]">No sources available</p>
                  </div>
                )}
              </>
            )}

            {panelFocus === 'books' && (
              <>
                {books.length > 0 ? (
                  books.map((book, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 bg-[#f5f5f7] rounded-2xl p-4 border border-gray-100"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <BookOpen className="w-4 h-4 text-[#1d1d1f]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1d1d1f] leading-snug">{book.title}</p>
                        <p className="text-[11px] text-[#6e6e73] mt-0.5 font-light">{book.author}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#6e6e73]">No books referenced</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {showProductionGuidePopup && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/80 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/80 via-white to-indigo-50/80 flex-shrink-0">
              <div className="min-w-0 pr-2">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">
                  Script unlocked
                </p>
                <h2 className="text-base font-semibold text-[#1d1d1f] leading-snug">
                  Your Storybit Production Playbook
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProductionGuidePopup(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-[#1d1d1f]" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Rocket className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                    {STORYBIT_PRODUCTION_GUIDE.optimized.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {STORYBIT_PRODUCTION_GUIDE.optimized.items.map((item, index) => (
                    <div key={item.title} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-0.5">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-[#6e6e73] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                    {STORYBIT_PRODUCTION_GUIDE.nextSteps.title}
                  </h3>
                </div>
                <div className="space-y-3">
                  {STORYBIT_PRODUCTION_GUIDE.nextSteps.items.map((item, index) => (
                    <div key={item.title} className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-0.5">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-[#6e6e73] leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-[#fafafa] flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowProductionGuidePopup(false)}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                Yes, I will do my best
              </button>
            </div>
          </div>
        </div>
      )}

      {showInsufficientPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl shadow-black/20 border border-gray-200/80 p-8 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-[#1d1d1f] mb-2">Not enough credits</h2>
            <p className="text-sm text-[#6e6e73] font-light leading-relaxed mb-6">
              You don&apos;t have enough credits to unlock this script. Upgrade your plan to keep generating
              content.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowInsufficientPopup(false);
                  router.push('/pricing');
                }}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all duration-200 hover:scale-[1.01]"
              >
                View Plans
              </button>
              <button
                type="button"
                onClick={() => setShowInsufficientPopup(false)}
                className="w-full py-2 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function StudioMetadataPanel({ data }: { data?: GeneratedScriptData | null }) {
  const { titles, descriptions, hashtags } = extractSeo(data);

  if (!data || (!titles.length && !descriptions.length && !hashtags.length)) {
    return (
      <EmptyState
        title="No YouTube metadata yet"
        body="Generate a script to get titles, descriptions, and hashtags for your video."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">YouTube titles</h3>
        {titles.length === 0 ? (
          <p className="text-sm text-gray-400">No titles available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {titles.map((title, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    Title {i + 1}
                  </span>
                  <CopyBtn text={title} id={`t-${i}`} />
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f] leading-snug">{title}</p>
                <p className="text-[11px] text-gray-400 mt-2">{title.length} chars</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">Descriptions</h3>
        {descriptions.length === 0 ? (
          <p className="text-sm text-gray-400">No descriptions available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {descriptions.map((desc, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                    Description {i + 1}
                  </span>
                  <CopyBtn text={desc} id={`d-${i}`} />
                </div>
                <p className="text-sm text-[#3d3d3a] leading-relaxed whitespace-pre-wrap">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-[#1d1d1f] mb-3">Hashtags</h3>
        {hashtags.length === 0 ? (
          <p className="text-sm text-gray-400">No hashtags available</p>
        ) : (
          <div className="space-y-3">
            {hashtags.map((set, i) => {
              const text = set.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
              return (
                <div key={i} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                      Set {i + 1}
                    </span>
                    <CopyBtn text={text} id={`h-${i}`} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {set.map((h, j) => (
                      <span
                        key={j}
                        className="text-xs font-medium text-[#1a73e8] bg-[#e8f0fe] px-2 py-1 rounded-full"
                      >
                        {h.startsWith('#') ? h : `#${h}`}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function StudioThumbnailsPanel({ data }: { data?: GeneratedScriptData | null }) {
  const { thumbnails, titles } = extractSeo(data);

  if (!data || thumbnails.length === 0) {
    return (
      <EmptyState
        title="No thumbnails yet"
        body="Generate a script to get thumbnail text overlays for your video."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {thumbnails.map((text, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="aspect-video bg-gradient-to-br from-[#1d1d1f] to-[#3d3d3a] relative flex items-center justify-center p-6">
            <p className="text-white text-center font-black text-lg sm:text-xl leading-tight drop-shadow-lg uppercase tracking-tight">
              {text}
            </p>
            <span className="absolute bottom-2 right-2 text-[10px] text-white/50 font-medium">
              16:9 preview
            </span>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                Thumbnail {i + 1}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-semibold hover:bg-gray-200"
                onClick={() => downloadThumbnailImage(text, i)}
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            </div>
            <p className="text-sm font-semibold text-[#1d1d1f]">{text}</p>
            {titles[i] && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{titles[i]}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudioBRollPanel() {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-2xl px-6 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Film className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">B-Roll</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        This feature will be added in the future.
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-14 text-center">
      <p className="text-base font-semibold text-[#1d1d1f] mb-1">{title}</p>
      <p className="text-sm text-gray-500">{body}</p>
    </div>
  );
}

export function ideaHook(description: string): string {
  if (!description) return '';
  const sentence = description.split(/(?<=[.!?])\s+/)[0] ?? description;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence;
}
