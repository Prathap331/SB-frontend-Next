'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  Volume2,
  Pause,
  Play,
  SkipBack,
  Undo2,
  Redo2,
  MoreHorizontal,
  Check,
  AlertTriangle,
  Sparkles,
  Film,
  BarChart3,
  Link2,
  ChevronUp,
  ChevronDown,
  X,
  Minus,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type SceneStatus = 'ready' | 'working' | 'needs';
type JoinStatus = 'single' | 'join';
type InfographicMode = 'overlay' | 'fullscreen';
type TextPosition = 'upper' | 'middle' | 'lower';
type FontSize = 'sm' | 'md' | 'lg';
type FontStyle = 'sans' | 'serif' | 'mono' | 'display';
type CaptionAnim = 'none' | 'fade' | 'slide' | 'typewriter';

type MainPart = { filename: string };
type BrollClip = { label: string };
type InfographicClip = {
  label: string;
  mode: InfographicMode;
  placement: string | null;
};

type Scene = {
  id: string;
  num: string;
  title: string;
  desc: string;
  start: number;
  duration: number;
  status: SceneStatus;
  mainParts: MainPart[];
  joinStatus: JoinStatus;
  broll: BrollClip | null;
  infographic: InfographicClip | null;
};

type Suggestion = {
  label: string;
  meta: string;
  start: number;
  dur: number;
  matchedScene: string;
  matchPct: number;
  mode?: InfographicMode;
};

type TextStyle = {
  position: TextPosition;
  background: boolean;
  bgColor: string;
  fontSize: FontSize;
  fontStyle: FontStyle;
  animation: CaptionAnim;
};

/* ── Dummy data ────────────────────────────────────────────────────────────── */

const PLACEMENT_OPTIONS = [
  'Top-left',
  'Top-right',
  'Center',
  'Lower third',
  'Bottom-left',
  'Bottom-right',
] as const;

const PLACEMENT_CLASS: Record<string, string> = {
  'Top-left': 'top-2.5 left-2.5',
  'Top-right': 'top-2.5 right-2.5',
  Center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'Lower third': 'bottom-14 left-2.5 right-2.5 justify-center text-center',
  'Bottom-left': 'bottom-2.5 left-2.5',
  'Bottom-right': 'bottom-2.5 right-2.5',
};

const FONT_SIZE_CLASS: Record<FontSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

const FONT_FAMILY_CLASS: Record<FontStyle, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
  display: 'font-sans uppercase tracking-wide font-extrabold',
};

const BROLL_SUGGESTIONS: Suggestion[] = [
  { label: 'Flooded coastal village, aerial', meta: '4K · 12s · warm grade', start: 0, dur: 6, matchedScene: 'Cold open', matchPct: 94 },
  { label: 'Relief camp, wide shot', meta: '4K · 9s · cool grade', start: 15, dur: 5, matchedScene: 'The number', matchPct: 88 },
  { label: 'District map base plate', meta: '1080p · 15s · flat grade', start: 20, dur: 7, matchedScene: 'Map beat', matchPct: 81 },
  { label: 'Abandoned structure, dusk', meta: '4K · 10s · cool grade', start: 37, dur: 6, matchedScene: 'Close', matchPct: 76 },
  { label: 'Storm clouds over coastline', meta: '4K · 8s · warm grade', start: 0, dur: 6, matchedScene: 'Cold open', matchPct: 68 },
];

const INFOGRAPHIC_SUGGESTIONS: Suggestion[] = [
  { label: 'Displacement stat reveal', meta: 'Kinetic typography · 3s', start: 15, dur: 5, matchedScene: 'The number', matchPct: 91, mode: 'overlay' },
  { label: 'District boundary animation', meta: 'Map overlay · 6s', start: 20, dur: 7, matchedScene: 'Map beat', matchPct: 73, mode: 'fullscreen' },
  { label: 'Location lower-third', meta: 'Text overlay · 2s', start: 6, dur: 9, matchedScene: 'Context', matchPct: 89, mode: 'overlay' },
  { label: 'Timeline tracker bar', meta: 'Progress overlay · 4s', start: 0, dur: 6, matchedScene: 'Cold open', matchPct: 64, mode: 'overlay' },
];

const INITIAL_SCENES: Scene[] = [
  {
    id: 's1', num: '01', title: 'Cold open',
    desc: 'Aerial establishing shot over the flooded coastline as the voiceover opens the eleven-day timeline.',
    start: 0, duration: 6, status: 'ready',
    mainParts: [{ filename: 'coldopen_take2.mp4' }], joinStatus: 'single',
    broll: null, infographic: null,
  },
  {
    id: 's2', num: '02', title: 'Context',
    desc: 'Kerala had seen heavy rain before — this time was different.',
    start: 6, duration: 9, status: 'ready',
    mainParts: [{ filename: 'drone_kerala_04.mp4' }], joinStatus: 'single',
    broll: null,
    infographic: { label: 'Location lower-third', mode: 'overlay', placement: 'Lower third' },
  },
  {
    id: 's3', num: '03', title: 'The number',
    desc: 'Statistic reveal — four hundred thousand people displaced.',
    start: 15, duration: 5, status: 'working',
    mainParts: [], joinStatus: 'single',
    broll: null, infographic: null,
  },
  {
    id: 's4', num: '04', title: 'Turning point',
    desc: 'Rescue boats arrive after three days. Handheld, urgent pacing.',
    start: 20, duration: 8, status: 'ready',
    mainParts: [
      { filename: 'turningpoint_partA.mp4' },
      { filename: 'turningpoint_partB.mp4' },
    ],
    joinStatus: 'join',
    broll: null, infographic: null,
  },
  {
    id: 's5', num: '05', title: 'Map beat',
    desc: "The worst-hit districts stretched across the state's western edge.",
    start: 28, duration: 7, status: 'needs',
    mainParts: [], joinStatus: 'single',
    broll: null, infographic: null,
  },
  {
    id: 's6', num: '06', title: 'Close',
    desc: "Five years later, some villages still haven't rebuilt.",
    start: 35, duration: 6, status: 'ready',
    mainParts: [{ filename: 'dusk_exterior.mp4' }], joinStatus: 'single',
    broll: null, infographic: null,
  },
];

const BG_SWATCHES = ['#000000', '#1A1A1D', '#0F2E2A', '#2E1A0F', '#1A0F2E'];

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function tc(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function tcShort(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function StatusPill({ status }: { status: SceneStatus }) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold">
        <Check className="w-3 h-3" /> Ready
      </span>
    );
  }
  if (status === 'working') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold">
        <Sparkles className="w-3 h-3" /> Agent working
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
      <AlertTriangle className="w-3 h-3" /> Needs media
    </span>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function StudioVideoEditingPanel() {
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [selectedId, setSelectedId] = useState('s5');
  const [zoom, setZoom] = useState(12);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [playingVO, setPlayingVO] = useState<string | null>(null);
  const [textStyle, setTextStyle] = useState<TextStyle>({
    position: 'lower',
    background: true,
    bgColor: '#000000',
    fontSize: 'md',
    fontStyle: 'sans',
    animation: 'fade',
  });
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(
    () => scenes.find((s) => s.id === selectedId) ?? scenes[0],
    [scenes, selectedId],
  );
  const totalDuration = useMemo(
    () => scenes.reduce((a, s) => a + s.duration, 0),
    [scenes],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!playingVO) return;
    const scene = scenes.find((s) => s.id === playingVO);
    const ms = Math.min(scene?.duration ?? 3, 6) * 1000;
    const t = setTimeout(() => setPlayingVO(null), ms);
    return () => clearTimeout(t);
  }, [playingVO, scenes]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-24), JSON.stringify(scenes)]);
    setFuture([]);
  }, [scenes]);

  const undo = () => {
    if (!history.length) {
      showToast('Nothing to undo');
      return;
    }
    const prev = history[history.length - 1];
    setFuture((f) => [...f, JSON.stringify(scenes)]);
    setHistory((h) => h.slice(0, -1));
    setScenes(JSON.parse(prev) as Scene[]);
  };

  const redo = () => {
    if (!future.length) {
      showToast('Nothing to redo');
      return;
    }
    const next = future[future.length - 1];
    setHistory((h) => [...h, JSON.stringify(scenes)]);
    setFuture((f) => f.slice(0, -1));
    setScenes(JSON.parse(next) as Scene[]);
  };

  const updateScene = (id: string, patch: Partial<Scene>) => {
    setScenes((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addScene = () => {
    pushHistory();
    const n = scenes.length + 1;
    const last = scenes[scenes.length - 1];
    const start = last ? last.start + last.duration : 0;
    const id = `s${Date.now()}`;
    setScenes((list) => [
      ...list,
      {
        id,
        num: String(n).padStart(2, '0'),
        title: 'New scene',
        desc: 'Describe what happens in this scene.',
        start,
        duration: 5,
        status: 'needs',
        mainParts: [],
        joinStatus: 'single',
        broll: null,
        infographic: null,
      },
    ]);
    setSelectedId(id);
  };

  const uploadMain = (id: string) => {
    pushHistory();
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== id) return sc;
        const partNum = sc.mainParts.length + 1;
        const filename = `${sc.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_take${partNum}.mp4`;
        const mainParts = [...sc.mainParts, { filename }];
        return {
          ...sc,
          mainParts,
          status: 'ready' as const,
          joinStatus: mainParts.length > 1 ? 'join' : 'single',
        };
      }),
    );
    setSelectedId(id);
    const sc = scenes.find((s) => s.id === id);
    showToast(
      sc && sc.mainParts.length >= 1
        ? 'Second take detected — aligning script coverage…'
        : 'Footage uploaded — re-cutting scene',
    );
  };

  const movePart = (id: string, idx: number, dir: -1 | 1) => {
    pushHistory();
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== id) return sc;
        const next = [...sc.mainParts];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return sc;
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...sc, mainParts: next };
      }),
    );
    showToast('Reordered — timing will re-sync');
  };

  const removePart = (id: string, idx: number) => {
    pushHistory();
    setScenes((list) =>
      list.map((sc) => {
        if (sc.id !== id) return sc;
        const mainParts = sc.mainParts.filter((_, i) => i !== idx);
        return {
          ...sc,
          mainParts,
          joinStatus: mainParts.length <= 1 ? 'single' : sc.joinStatus,
          status: mainParts.length === 0 ? 'needs' : sc.status,
        };
      }),
    );
  };

  const insertSuggestion = (type: 'broll' | 'infographic', index: number) => {
    pushHistory();
    const list = type === 'broll' ? BROLL_SUGGESTIONS : INFOGRAPHIC_SUGGESTIONS;
    const item = list[index];
    if (!item) return;
    const target = scenes.reduce((closest, scn) =>
      Math.abs(scn.start - item.start) < Math.abs(closest.start - item.start) ? scn : closest,
    scenes[0]);
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== target.id) return sc;
        if (type === 'broll') {
          return { ...sc, broll: { label: item.label }, status: sc.status === 'needs' ? 'ready' : sc.status };
        }
        return {
          ...sc,
          infographic: {
            label: item.label,
            mode: item.mode ?? 'overlay',
            placement: item.mode === 'overlay' ? 'Lower third' : null,
          },
          status: sc.status === 'needs' ? 'ready' : sc.status,
        };
      }),
    );
    setSelectedId(target.id);
    showToast(`Inserted into ${target.title}`);
  };

  const timelineWidth = Math.max(totalDuration * zoom, 560);
  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    for (let t = 0; t <= totalDuration + 5; t += 10) marks.push(t);
    return marks;
  }, [totalDuration]);

  const hasMedia = selected.mainParts.length > 0;
  const isFullscreenInfo = selected.infographic?.mode === 'fullscreen';
  const isOverlayInfo = selected.infographic?.mode === 'overlay';

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden rounded-2xl border border-gray-200 bg-[#f5f5f7] shadow-sm"
      aria-label="AI video editing"
    >
      {/* ── Left: Storyboard ── */}
      <aside className="flex h-full min-h-0 w-[min(280px,26%)] min-w-[220px] max-w-[300px] flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white">
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">
            Storyboard
          </p>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">Scenes</h2>
            <button
              type="button"
              onClick={addScene}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-[#f5f5f7] text-[#1d1d1f] hover:bg-gray-200"
              aria-label="Add scene"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
          {scenes.map((sc) => {
            const active = sc.id === selectedId;
            return (
              <div
                key={sc.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(sc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedId(sc.id);
                }}
                className={`cursor-pointer rounded-2xl border p-3 transition-colors ${
                  active
                    ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-sm'
                    : 'border-gray-200 bg-[#fafafa] hover:border-gray-300'
                }`}
              >
                <div className="mb-2 flex items-start gap-2.5">
                  <span
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${
                      active ? 'bg-white/10 text-white/80' : 'bg-white border border-gray-200 text-[#6e6e73]'
                    }`}
                  >
                    {sc.num}
                  </span>
                  <p className={`pt-1 text-sm font-semibold leading-snug ${active ? 'text-white' : 'text-[#1d1d1f]'}`}>
                    {sc.title}
                  </p>
                </div>
                <p className={`mb-2.5 text-xs leading-relaxed ${active ? 'text-white/65' : 'text-[#6e6e73]'}`}>
                  {sc.desc}
                </p>
                <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`tabular-nums ${active ? 'text-white/55' : 'text-[#86868b]'}`}>
                    {tc(sc.start)} · {sc.duration}s
                  </span>
                  {!active && <StatusPill status={sc.status} />}
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                      {sc.status === 'ready' ? 'Ready' : sc.status === 'working' ? 'Working' : 'Needs media'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlayingVO((cur) => (cur === sc.id ? null : sc.id));
                  }}
                  className={`mb-2.5 flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] ${
                    playingVO === sc.id
                      ? active
                        ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                      : active
                        ? 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
                        : 'border-gray-200 bg-white text-[#6e6e73] hover:border-gray-300'
                  }`}
                >
                  {playingVO === sc.id ? <Pause className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  <span className="flex-1">{playingVO === sc.id ? 'Playing voiceover…' : 'Play voiceover'}</span>
                  <span className="tabular-nums opacity-60">{sc.duration}s</span>
                </button>

                {sc.mainParts.length > 1 && (
                  <div
                    className={`mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
                      active ? 'bg-sky-400/15 text-sky-100' : 'bg-sky-50 text-sky-800'
                    }`}
                  >
                    <Link2 className="h-3 w-3" />
                    {sc.joinStatus === 'join'
                      ? 'Joined — continuous script coverage'
                      : 'Two takes — pick or reorder'}
                  </div>
                )}

                {sc.mainParts.length > 0 ? (
                  <>
                    <div className="mb-2 space-y-1">
                      {sc.mainParts.map((p, pi) => (
                        <div
                          key={`${p.filename}-${pi}`}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] ${
                            active ? 'bg-white/8 text-white/80' : 'bg-white border border-gray-100 text-[#6e6e73]'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                              active ? 'bg-white/15' : 'bg-gray-100'
                            }`}
                          >
                            {pi + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{p.filename}</span>
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              disabled={pi === 0}
                              onClick={() => movePart(sc.id, pi, -1)}
                              className="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={pi === sc.mainParts.length - 1}
                              onClick={() => movePart(sc.id, pi, 1)}
                              className="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removePart(sc.id, pi)}
                              className="rounded p-0.5 hover:bg-black/10"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        uploadMain(sc.id);
                      }}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2 text-[11px] font-semibold ${
                        active
                          ? 'border-white/25 text-white/80 hover:bg-white/10'
                          : 'border-gray-300 text-[#6e6e73] hover:border-[#1d1d1f] hover:text-[#1d1d1f]'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add another take
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      uploadMain(sc.id);
                    }}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${
                      active
                        ? 'bg-white text-[#1d1d1f] hover:bg-gray-100'
                        : 'bg-[#1d1d1f] text-white hover:bg-black'
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload footage
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="flex-shrink-0 border-t border-gray-100 px-4 py-2.5 text-[11px] leading-relaxed text-[#86868b]">
          Drop MP4, MOV or WebM. The agent re-cuts scenes automatically after each upload.
        </p>
      </aside>

      {/* ── Center: Preview + timeline ── */}
      <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]">
        <div className="flex h-11 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
          <p className="truncate text-xs text-[#6e6e73]">
            <span className="font-semibold text-[#1d1d1f]">{selected.title}</span>
            {' · '}1080×1920 · 30fps
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={undo}
              disabled={!history.length}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!future.length}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-30"
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7]"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-4 [container-type:size]">
          <div
            className={`relative flex max-h-full items-end justify-center overflow-hidden rounded-xl border border-gray-200 ${
              hasMedia
                ? 'bg-gradient-to-br from-slate-600 to-slate-900'
                : 'bg-[length:24px_24px] bg-[linear-gradient(45deg,#e8e8ed_25%,transparent_25%),linear-gradient(-45deg,#e8e8ed_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e8e8ed_75%),linear-gradient(-45deg,transparent_75%,#e8e8ed_75%)] bg-[position:0_0,0_12px,12px_-12px,-12px_0] bg-white'
            }`}
            style={{
              aspectRatio: '16 / 9',
              width: 'min(100%, calc(100cqh * 16 / 9))',
              maxWidth: '900px',
            }}
          >
            {hasMedia ? (
              <>
                <div className="absolute left-2.5 top-2.5 z-[2]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Check className="h-3 w-3 text-emerald-300" />
                    {selected.mainParts.length > 1
                      ? selected.mainParts.map((p) => p.filename).join(' + ')
                      : selected.mainParts[0]?.filename}
                  </span>
                </div>

                {isFullscreenInfo && selected.infographic && (
                  <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-500/30 to-slate-900 px-6 text-center">
                    <BarChart3 className="h-6 w-6 text-violet-200" />
                    <p className="text-sm font-bold text-white">{selected.infographic.label}</p>
                    <p className="flex items-center gap-1 text-[11px] text-white/70">
                      <Sparkles className="h-3 w-3" /> Full-screen infographic — AI decided
                    </p>
                  </div>
                )}

                {isOverlayInfo && selected.infographic && (
                  <div
                    className={`absolute z-[3] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-violet-200 ${
                      PLACEMENT_CLASS[selected.infographic.placement || 'Top-right']
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    {selected.infographic.label}
                  </div>
                )}

                <div
                  className={`absolute left-0 right-0 z-[2] px-5 py-4 ${
                    textStyle.position === 'upper'
                      ? 'top-0'
                      : textStyle.position === 'middle'
                        ? 'top-1/2 -translate-y-1/2 text-center'
                        : 'bottom-0'
                  }`}
                  style={
                    textStyle.background
                      ? {
                          background:
                            textStyle.position === 'upper'
                              ? `linear-gradient(to bottom, ${textStyle.bgColor}cc, transparent)`
                              : textStyle.position === 'lower'
                                ? `linear-gradient(to top, ${textStyle.bgColor}cc, transparent)`
                                : 'transparent',
                        }
                      : undefined
                  }
                >
                  <p
                    className={`leading-snug text-white ${FONT_SIZE_CLASS[textStyle.fontSize]} ${FONT_FAMILY_CLASS[textStyle.fontStyle]} ${
                      textStyle.fontStyle === 'display' ? '' : 'font-semibold'
                    } ${
                      textStyle.background && textStyle.position === 'middle'
                        ? 'inline-block rounded-lg px-3.5 py-2'
                        : ''
                    }`}
                    style={
                      textStyle.background && textStyle.position === 'middle'
                        ? { background: `${textStyle.bgColor}cc` }
                        : undefined
                    }
                  >
                    {selected.desc}
                  </p>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                <p className="mb-2 text-base font-semibold text-[#1d1d1f]">Preview placeholder</p>
                <p className="max-w-sm text-xs leading-relaxed text-[#6e6e73]">
                  Upload footage for this scene from the left panel to see it render here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Transport */}
        <div className="flex h-10 flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlayheadSec(0)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => showToast('Playback preview only — connect a player when backend is ready')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1d1d1f] text-white"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </button>
            <span className="rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-1 text-xs tabular-nums text-[#6e6e73]">
              {tc(playheadSec)}
            </span>
          </div>
          <div className="flex max-w-[220px] flex-1 items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalDuration}
              step={0.1}
              value={playheadSec}
              onChange={(e) => setPlayheadSec(Number(e.target.value))}
              className="w-full accent-[#1d1d1f]"
            />
            <span className="text-[11px] tabular-nums text-[#86868b]">{tcShort(totalDuration)}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="max-h-[38%] min-h-[140px] flex-shrink-0 overflow-y-auto border-t border-gray-200 bg-white px-4 py-2.5">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">
              Timeline · Layers
            </span>
            <span className="text-[11px] tabular-nums text-[#a1a1a6]">
              playhead {tc(playheadSec)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(4, z - 4))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[44px] text-center text-[11px] tabular-nums text-[#6e6e73]">
                {zoom}px/s
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(40, z + 4))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            <div className="relative" style={{ width: timelineWidth }}>
              <div
                className="relative mb-1.5 h-5 cursor-pointer border-b border-gray-100"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const sec = Math.max(0, (e.clientX - rect.left) / zoom);
                  setPlayheadSec(Math.round(sec * 10) / 10);
                }}
              >
                {rulerMarks.map((t) => (
                  <span
                    key={t}
                    className="absolute top-0 h-full border-l border-gray-200 pl-1 text-[10px] tabular-nums text-[#a1a1a6]"
                    style={{ left: t * zoom }}
                  >
                    {tcShort(t)}
                  </span>
                ))}
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-[6] w-0.5 bg-amber-500"
                  style={{ left: playheadSec * zoom }}
                >
                  <span className="absolute left-1/2 top-0 h-2 w-2.5 -translate-x-1/2 rounded-sm bg-amber-500" />
                </div>
              </div>

              <TimelineTrack
                name="Main footage"
                count={scenes.filter((s) => s.mainParts.length > 0).length}
                dotClass="bg-sky-500"
              >
                {scenes.map((sc) => {
                  const left = sc.start * zoom;
                  const width = sc.duration * zoom;
                  const active = sc.id === selectedId;
                  if (!sc.mainParts.length) {
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSelectedId(sc.id)}
                        className="absolute top-0 flex h-9 items-center overflow-hidden rounded-lg border border-dashed border-gray-300 px-2.5 text-[11px] text-[#a1a1a6]"
                        style={{ left, width }}
                      >
                        no footage
                      </button>
                    );
                  }
                  const label =
                    sc.mainParts.length > 1
                      ? `${sc.mainParts.length} parts joined`
                      : sc.mainParts[0].filename;
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedId(sc.id)}
                      className={`absolute top-0 flex h-9 items-center overflow-hidden rounded-lg border px-2.5 text-left text-[11px] font-semibold text-sky-900 ${
                        active
                          ? 'border-amber-400 bg-sky-100 shadow-sm'
                          : 'border-sky-200 bg-sky-50'
                      }`}
                      style={{ left, width }}
                    >
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </TimelineTrack>

              <TimelineTrack
                name="B-roll"
                count={scenes.filter((s) => s.broll).length}
                dotClass="bg-teal-500"
              >
                {scenes
                  .filter((s) => s.broll)
                  .map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedId(sc.id)}
                      className="absolute top-0 flex h-9 items-center overflow-hidden rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-left text-[11px] font-semibold text-teal-900"
                      style={{ left: sc.start * zoom, width: sc.duration * zoom }}
                    >
                      <span className="truncate">{sc.broll!.label}</span>
                    </button>
                  ))}
              </TimelineTrack>

              <TimelineTrack
                name="Infographics"
                count={scenes.filter((s) => s.infographic).length}
                dotClass="bg-violet-500"
              >
                {scenes
                  .filter((s) => s.infographic)
                  .map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedId(sc.id)}
                      className="absolute top-0 flex h-9 items-center overflow-hidden rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-left text-[11px] font-semibold text-violet-900"
                      style={{ left: sc.start * zoom, width: sc.duration * zoom }}
                    >
                      <span className="truncate">{sc.infographic!.label}</span>
                    </button>
                  ))}
              </TimelineTrack>
            </div>
          </div>
        </div>
      </section>

      {/* ── Right: Agent suggestions ── */}
      <aside className="flex h-full min-h-0 w-[min(320px,28%)] min-w-[250px] max-w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6e6e73]">
            Agent suggestions
          </p>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#1d1d1f]">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Media library
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="border-b border-gray-100 px-4 py-3.5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
              B-roll
            </p>
            <div className="space-y-2.5">
              {BROLL_SUGGESTIONS.map((item, i) => (
                <SuggestionCard
                  key={item.label}
                  item={item}
                  type="broll"
                  selected={selected}
                  onInsert={() => insertSuggestion('broll', i)}
                />
              ))}
            </div>
          </div>

          <div className="border-b border-gray-100 px-4 py-3.5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
              Infographics
            </p>
            <div className="mb-3 space-y-2.5">
              {INFOGRAPHIC_SUGGESTIONS.map((item, i) => (
                <SuggestionCard
                  key={item.label}
                  item={item}
                  type="infographic"
                  selected={selected}
                  onInsert={() => insertSuggestion('infographic', i)}
                />
              ))}
            </div>
            {selected.infographic && (
              selected.infographic.mode === 'overlay' ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold text-[#6e6e73]">
                    Placement — {selected.infographic.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          pushHistory();
                          updateScene(selected.id, {
                            infographic: { ...selected.infographic!, placement: opt },
                          });
                        }}
                        className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                          selected.infographic?.placement === opt
                            ? 'border-violet-300 bg-violet-50 text-violet-800'
                            : 'border-gray-200 text-[#6e6e73] hover:border-gray-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] leading-relaxed text-[#86868b]">
                  <Sparkles className="mr-1 inline h-3 w-3 text-amber-500" />
                  AI placed &quot;{selected.infographic.label}&quot; full-screen — no manual position needed.
                </p>
              )
            )}
          </div>

          <div className="px-4 py-3.5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6e6e73]">
              Text &amp; captions
            </p>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Position on screen</p>
            <div className="mb-3 flex gap-1.5">
              {([
                ['upper', 'Upper third'],
                ['middle', 'Middle third'],
                ['lower', 'Lower third'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTextStyle((t) => ({ ...t, position: value }))}
                  className={`flex-1 rounded-lg border px-1 py-1.5 text-[10px] font-semibold ${
                    textStyle.position === value
                      ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                      : 'border-gray-200 text-[#6e6e73] hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#6e6e73]">Background</span>
              <button
                type="button"
                role="switch"
                aria-checked={textStyle.background}
                onClick={() => setTextStyle((t) => ({ ...t, background: !t.background }))}
                className={`relative h-[19px] w-[34px] rounded-full transition-colors ${
                  textStyle.background ? 'bg-[#1d1d1f]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${
                    textStyle.background ? 'left-[17px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            {textStyle.background && (
              <div className="mb-3 flex gap-1.5">
                {BG_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTextStyle((t) => ({ ...t, bgColor: c }))}
                    className={`h-5 w-5 rounded-md border-2 ${
                      textStyle.bgColor === c ? 'border-amber-500' : 'border-transparent'
                    }`}
                    style={{ background: c }}
                    aria-label={`Background ${c}`}
                  />
                ))}
              </div>
            )}

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font size</p>
            <div className="mb-3 flex gap-1.5">
              {(['sm', 'md', 'lg'] as FontSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTextStyle((t) => ({ ...t, fontSize: size }))}
                  className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold uppercase ${
                    textStyle.fontSize === size
                      ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                      : 'border-gray-200 text-[#6e6e73]'
                  }`}
                >
                  {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Font style</p>
            <select
              value={textStyle.fontStyle}
              onChange={(e) =>
                setTextStyle((t) => ({ ...t, fontStyle: e.target.value as FontStyle }))
              }
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            >
              <option value="sans">Sans — clean</option>
              <option value="serif">Serif — editorial</option>
              <option value="mono">Mono — technical</option>
              <option value="display">Display — bold</option>
            </select>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">Animation</p>
            <select
              value={textStyle.animation}
              onChange={(e) =>
                setTextStyle((t) => ({ ...t, animation: e.target.value as CaptionAnim }))
              }
              className="mb-3 w-full rounded-lg border border-gray-200 bg-[#f5f5f7] px-2.5 py-2 text-xs text-[#1d1d1f]"
            >
              <option value="none">None</option>
              <option value="fade">Fade in</option>
              <option value="slide">Slide up</option>
              <option value="typewriter">Typewriter</option>
            </select>

            <p className="mb-1.5 text-[11px] font-semibold text-[#6e6e73]">
              Caption text — scene {scenes.findIndex((x) => x.id === selected.id) + 1}
            </p>
            <textarea
              value={selected.desc}
              rows={3}
              onChange={(e) => {
                const value = e.target.value;
                setScenes((list) =>
                  list.map((s) => (s.id === selected.id ? { ...s, desc: value } : s)),
                );
              }}
              className="w-full resize-none rounded-xl border border-gray-200 bg-[#f5f5f7] px-3 py-2 text-xs leading-relaxed text-[#1d1d1f] outline-none focus:border-[#1d1d1f] focus:ring-2 focus:ring-[#1d1d1f]/10"
            />
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#a1a1a6]">
              Editing wording only — timing stays locked to the voiceover alignment.
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={() => showToast('Searching the wider media library…')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Find more
          </button>
        </div>
      </aside>

      {toast && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-[#1d1d1f] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function TimelineTrack({
  name,
  count,
  dotClass,
  children,
}: {
  name: string;
  count: number;
  dotClass: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex h-9 items-center gap-3 last:mb-0">
      <div className="flex w-[120px] flex-shrink-0 items-center gap-2">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
        <span className="truncate text-xs font-semibold text-[#1d1d1f]">{name}</span>
        <span className="text-[11px] text-[#a1a1a6]">{count}</span>
      </div>
      <div className="relative h-9 flex-1">{children}</div>
    </div>
  );
}

function SuggestionCard({
  item,
  type,
  selected,
  onInsert,
}: {
  item: Suggestion;
  type: 'broll' | 'infographic';
  selected: Scene;
  onInsert: () => void;
}) {
  const isInfo = type === 'infographic';
  const already = isInfo
    ? selected.infographic?.label === item.label
    : selected.broll?.label === item.label;

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3">
      <div className="mb-2 flex gap-2.5">
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
            isInfo ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'
          }`}
        >
          {isInfo ? <BarChart3 className="h-5 w-5" /> : <Film className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 truncate text-xs font-bold text-[#1d1d1f]">{item.label}</p>
          <p className="mb-0.5 text-[11px] text-[#6e6e73]">{item.meta}</p>
          <p className="text-[10px] tabular-nums text-[#a1a1a6]">
            @ {tcShort(item.start)}.00 · {item.dur}s
          </p>
        </div>
      </div>
      {isInfo && item.mode && (
        <div
          className={`mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            item.mode === 'fullscreen'
              ? 'bg-violet-100 text-violet-800'
              : 'bg-sky-100 text-sky-800'
          }`}
        >
          <Sparkles className="h-3 w-3" />
          AI decided: {item.mode === 'fullscreen' ? 'Full screen' : 'Overlay'}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-amber-200/60 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-[#6e6e73]">{item.matchedScene}</span>
          <span className="flex-shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            {item.matchPct}%
          </span>
        </div>
        <button
          type="button"
          onClick={onInsert}
          className={`inline-flex flex-shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
            already
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-gray-300'
          }`}
        >
          {already ? (
            <>
              <Check className="h-3 w-3" /> Added
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" /> Insert
            </>
          )}
        </button>
      </div>
    </div>
  );
}
