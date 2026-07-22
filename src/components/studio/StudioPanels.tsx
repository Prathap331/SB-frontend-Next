'use client';

import React, { useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { GeneratedScriptData } from '@/services/api';
import { unwrapScriptJson } from '@/lib/script-data';

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
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
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
}: {
  data?: GeneratedScriptData | null;
  ideaTitle?: string;
}) {
  const [activeSegment, setActiveSegment] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scriptScrollRef = useRef<HTMLDivElement | null>(null);

  const structureSegments = data?.structure ?? [];
  const scriptSegmentTexts = useMemo(
    () => splitScriptByStructure(data?.script || '', structureSegments),
    [data?.script, structureSegments],
  );

  const scrollToSegment = (index: number) => {
    setActiveSegment(index);
    segmentRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleDownloadScript = () => {
    const blob = new Blob([data.script || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ideaTitle || data.title || 'script').replace(/[^\w\-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
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
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
                            activeSegment === index ? 'bg-amber-500 text-white' : 'bg-[#1d1d1f] text-white'
                          }`}
                        >
                          {index + 1}
                        </div>
                        {index < structureSegments.length - 1 && (
                          <div className="w-px bg-gray-200 flex-1 mt-1 min-h-[10px]" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => scrollToSegment(index)}
                        className={`flex-1 text-left rounded-xl px-3 py-2 border min-w-0 mb-2 transition-all duration-200 ${
                          activeSegment === index
                            ? 'bg-amber-50 border-amber-200 shadow-sm'
                            : 'bg-[#f5f5f7] border-gray-100 hover:border-gray-300 hover:bg-white'
                        }`}
                      >
                        <p
                          className={`font-medium text-xs break-words ${
                            activeSegment === index ? 'text-amber-800' : 'text-[#1d1d1f]'
                          }`}
                        >
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
                <CopyBtn text={data.script} />
                <button
                  type="button"
                  onClick={handleDownloadScript}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>

            <div ref={scriptScrollRef} className="flex-1 overflow-y-auto">
              <div className="px-6 sm:px-8 py-6">
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
                      className={`rounded-2xl transition-all duration-500 px-3 -mx-3 ${
                        activeSegment === i ? 'bg-amber-50 ring-2 ring-amber-200' : ''
                      }`}
                    >
                      {formatScriptNodes(chunk || '')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
