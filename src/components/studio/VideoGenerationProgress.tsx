'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Check, Film, Image as ImageIcon, Mic, MousePointer2, Play, Scissors, Search, Sparkles } from 'lucide-react';

/** Each step is shown for this long; the last one holds until the video arrives. */
const STEP_MS = 60_000;

type Step = {
  title: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  Scene: ComponentType;
};

const STEPS: Step[] = [
  {
    title: 'Voicing your script',
    detail: 'Recording the voiceover with the voice you picked',
    icon: Mic,
    Scene: VoicingScene,
  },
  {
    title: 'Selecting the right footage',
    detail: 'Matching B-roll videos and images to every line',
    icon: Search,
    Scene: SelectingScene,
  },
  {
    title: 'Merging the clips',
    detail: 'Cutting and stitching each scene on the timeline',
    icon: Scissors,
    Scene: MergingScene,
  },
  {
    title: 'Getting your video ready',
    detail: 'Adding infographics, captions and final touches',
    icon: Sparkles,
    Scene: ReadyScene,
  },
];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Four-step progress shown while POST /edit-video runs. Steps advance every minute from
 * `startedAt` (the pending-generation marker), so a reload mid-run resumes on the right step.
 */
export function VideoGenerationProgress({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const stepIndex = Math.min(STEPS.length - 1, Math.floor(elapsed / STEP_MS));
  const isLast = stepIndex === STEPS.length - 1;
  const stepProgress = isLast ? null : (elapsed % STEP_MS) / STEP_MS;
  const step = STEPS[stepIndex];
  const longWait = elapsed > STEP_MS * STEPS.length + 60_000;

  return (
    <div className="absolute inset-0 z-[75] flex items-center justify-center overflow-y-auto bg-[#1d1d1f]/30 p-4 backdrop-blur-sm">
      <style>{SCENE_CSS}</style>
      <div
        className="w-full max-w-lg rounded-3xl border border-gray-200/80 bg-white p-6 shadow-xl shadow-black/10 sm:p-7"
        role="status"
        aria-live="polite"
        aria-busy
      >
        {/* <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <p className="text-[11px] font-semibold tabular-nums text-[#86868b]">{formatElapsed(elapsed)}</p>
        </div> */}

        <div className="vgp-stage relative mb-5 flex h-[170px] items-center justify-center overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-b from-[#fffaf1] to-[#f5f5f7]">
          <div key={stepIndex} className="vgp-scene-in flex h-full w-full items-center justify-center">
            <step.Scene />
          </div>
        </div>

        <div className="mb-5 text-center">
          <p key={stepIndex} className="generation-step-shimmer text-lg font-semibold leading-snug tracking-tight sm:text-xl">
            {step.title}
          </p>
          <p className="mt-1 text-sm text-[#6e6e73]">{step.detail}</p>
        </div>

        <ol className="mb-5 space-y-2">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                  active ? 'border-amber-200 bg-amber-50/70' : 'border-transparent'
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                    done
                      ? 'bg-[#1d1d1f] text-white'
                      : active
                        ? 'bg-amber-500 text-white vgp-pulse'
                        : 'bg-[#f5f5f7] text-[#a1a1a6]'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${
                    done || active ? 'text-[#1d1d1f]' : 'text-[#a1a1a6]'
                  }`}
                >
                  {s.title}
                </span>
                {done ? (
                  <span className="text-[11px] font-semibold text-emerald-600">Done</span>
                ) : active ? (
                  <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-amber-100">
                    {stepProgress == null ? (
                      <span className="vgp-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-amber-500" />
                    ) : (
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-amber-500 transition-[width] duration-500 ease-linear"
                        style={{ width: `${Math.max(4, stepProgress * 100)}%` }}
                      />
                    )}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#a1a1a6]">Up next</span>
                )}
              </li>
            );
          })}
        </ol>

        <p className="text-center text-xs leading-relaxed text-[#86868b]">
          {longWait
            ? 'Longer scripts take a few more minutes — almost there.'
            : 'This keeps running if you leave the page. Your video opens here when it is ready.'}
        </p>
      </div>
    </div>
  );
}

/* ── Step 1: a cartoon speaker talking into a studio mic ─────────────────────── */
function VoicingScene() {
  return (
    <svg viewBox="0 0 240 150" className="h-[150px] w-[240px]" aria-hidden>
      <circle cx="118" cy="82" r="62" fill="#fff1d6" />
      <g className="vgp-bob">
        <path d="M46 150 C46 116 64 102 88 102 C112 102 130 116 130 150 Z" fill="#1d1d1f" />
        <path d="M78 104 L88 118 L98 104 Z" fill="#f5f5f7" />
        <rect x="82" y="86" width="13" height="20" rx="6" fill="#f2c39b" />
        <circle cx="88" cy="66" r="24" fill="#f9d4b0" />
        <path d="M64 66 C61 45 77 36 92 38 C106 40 115 50 112 61 C104 54 92 52 82 56 C74 59 70 64 66 72 Z" fill="#3a2a20" />
        <path d="M65 64 C64 36 110 32 112 57" stroke="#2c2c2e" strokeWidth="5" fill="none" strokeLinecap="round" />
        <rect x="67" y="59" width="12" height="18" rx="6" fill="#2c2c2e" />
        <path d="M96 55 Q100 53 105 55" stroke="#3a2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="101" cy="62" r="2.4" fill="#1d1d1f" className="vgp-blink" />
        <path d="M110 63 Q115 69 110 72" stroke="#e0a77f" strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx="105" cy="79" rx="4.5" ry="3.2" fill="#7a2e2e" className="vgp-mouth" />
      </g>
      {/* pop filter + mic on a boom */}
      <line x1="214" y1="14" x2="152" y2="50" stroke="#8e8e93" strokeWidth="3" strokeLinecap="round" />
      <circle cx="126" cy="66" r="11" fill="#ffffff" fillOpacity="0.55" stroke="#a1a1a6" strokeWidth="1.5" />
      <rect x="136" y="46" width="17" height="32" rx="8.5" fill="#2c2c2e" />
      <line x1="139" y1="54" x2="150" y2="54" stroke="#636366" strokeWidth="1.5" />
      <line x1="139" y1="60" x2="150" y2="60" stroke="#636366" strokeWidth="1.5" />
      <line x1="139" y1="66" x2="150" y2="66" stroke="#636366" strokeWidth="1.5" />
      <rect x="140" y="78" width="9" height="6" rx="2" fill="#48484a" />
      {/* sound waves */}
      <path className="vgp-wave" d="M162 52 Q170 63 162 74" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path className="vgp-wave" style={{ animationDelay: '0.35s' }} d="M170 44 Q182 63 170 82" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path className="vgp-wave" style={{ animationDelay: '0.7s' }} d="M178 36 Q194 63 178 90" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* level meter */}
      <g transform="translate(162 108)">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect
            key={i}
            className="vgp-eq"
            style={{ animationDelay: `${(i * 0.13) % 0.7}s` }}
            x={i * 8}
            y="0"
            width="5"
            height="28"
            rx="2.5"
            fill={i % 3 === 0 ? '#1d1d1f' : '#f59e0b'}
          />
        ))}
      </g>
    </svg>
  );
}

/* ── Step 2: a selector scanning a footage grid and picking clips ───────────── */
const TILE_W = 56;
const TILE_H = 36;
const TILE_GAP = 10;
const TILES = [
  { col: 0, row: 0, from: '#fcd34d', to: '#f97316', icon: Film },
  { col: 1, row: 0, from: '#7dd3fc', to: '#2563eb', icon: ImageIcon },
  { col: 2, row: 0, from: '#86efac', to: '#059669', icon: Film },
  { col: 0, row: 1, from: '#c4b5fd', to: '#7c3aed', icon: ImageIcon },
  { col: 1, row: 1, from: '#fda4af', to: '#e11d48', icon: Film },
  { col: 2, row: 1, from: '#cbd5e1', to: '#475569', icon: Film },
];
/** Visit order of the selector (tile indexes) — each tile is picked as the selector leaves it. */
const PICK_ORDER = [0, 4, 2, 3, 5, 1];

function SelectingScene() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm">
        <Search className="vgp-search h-3 w-3 text-amber-600" />
        <span className="text-[10px] font-semibold text-[#6e6e73]">Matching footage to your script</span>
      </div>
      <div className="relative" style={{ width: TILE_W * 3 + TILE_GAP * 2, height: TILE_H * 2 + TILE_GAP }}>
        {TILES.map((t, i) => {
          const Icon = t.icon;
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-lg shadow-sm"
              style={{
                left: t.col * (TILE_W + TILE_GAP),
                top: t.row * (TILE_H + TILE_GAP),
                width: TILE_W,
                height: TILE_H,
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
              }}
            >
              <Icon className="absolute left-1.5 top-1.5 h-3 w-3 text-white/80" />
              <span className="absolute bottom-1 right-1.5 text-[7px] font-bold text-white/85">0:0{(i % 5) + 4}</span>
              <span
                className={`vgp-pick-${i} absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white`}
              >
                <Check className="h-2.5 w-2.5 text-emerald-600" />
              </span>
            </div>
          );
        })}
        <div className="vgp-scan pointer-events-none absolute left-0 top-0">
          <div
            className="rounded-[10px] border-2 border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]"
            style={{ width: TILE_W + 8, height: TILE_H + 8, transform: 'translate(-4px, -4px)' }}
          />
          <MousePointer2 className="absolute h-4 w-4 fill-[#1d1d1f] text-white" style={{ left: TILE_W - 6, top: TILE_H - 8 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: clips dropping onto a track and snapping together ──────────────── */
const CLIPS = [
  { width: 56, color: '#f59e0b', anim: 'vgp-clip-a' },
  { width: 48, color: '#38bdf8', anim: 'vgp-clip-b' },
  { width: 64, color: '#a78bfa', anim: 'vgp-clip-c' },
];

function MergingScene() {
  const trackWidth = CLIPS.reduce((sum, c) => sum + c.width, 0);
  let x = 0;
  return (
    <div className="relative" style={{ width: trackWidth + 16, height: 130 }}>
      <Scissors className="vgp-snip absolute right-0 top-1 h-5 w-5 text-[#1d1d1f]" />
      {/* ruler */}
      <div className="absolute left-2 right-2 top-[64px] flex justify-between">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={`w-px bg-[#c7c7cc] ${i % 3 === 0 ? 'h-2.5' : 'h-1.5'}`} />
        ))}
      </div>
      <div
        className="vgp-track absolute left-2 top-[78px] h-[30px] rounded-lg bg-[#e5e5ea]"
        style={{ width: trackWidth }}
      >
        {CLIPS.map((c) => {
          const left = x;
          x += c.width;
          return (
            <div
              key={c.anim}
              className={`${c.anim} absolute top-0 h-full overflow-hidden rounded-md`}
              style={{ left, width: c.width, background: c.color }}
            >
              <span className="vgp-film absolute inset-x-0 top-0.5 h-1" />
              <span className="vgp-film absolute inset-x-0 bottom-0.5 h-1" />
            </div>
          );
        })}
        {CLIPS.slice(1).map((c, i) => {
          const seam = CLIPS.slice(0, i + 1).reduce((sum, p) => sum + p.width, 0);
          return (
            <span
              key={`seam-${c.anim}`}
              className="vgp-seam absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded-full bg-white"
              style={{ left: seam }}
            />
          );
        })}
        <span className="vgp-playhead absolute -top-3 -bottom-2 left-0 w-0.5 bg-amber-500">
          <span className="absolute -left-[3px] -top-1 h-2 w-2 rounded-sm bg-amber-500" />
        </span>
      </div>
    </div>
  );
}

/* ── Step 4: a frame rendering in, then a play button pops ──────────────────── */
function ReadyScene() {
  return (
    <div className="relative">
      <Sparkles className="vgp-twinkle absolute -left-6 -top-3 h-4 w-4 text-amber-500" />
      <Sparkles className="vgp-twinkle absolute -right-6 top-6 h-3 w-3 text-amber-400" style={{ animationDelay: '0.6s' }} />
      <Sparkles className="vgp-twinkle absolute -bottom-3 -left-4 h-3 w-3 text-amber-400" style={{ animationDelay: '1.2s' }} />
      <div className="relative h-[100px] w-[178px] overflow-hidden rounded-xl border-[3px] border-[#1d1d1f] bg-[#1c1c1e] shadow-lg">
        <div className="vgp-reveal absolute inset-0">
          <svg viewBox="0 0 178 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="vgp-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fde68a" />
                <stop offset="1" stopColor="#fb923c" />
              </linearGradient>
            </defs>
            <rect width="178" height="100" fill="url(#vgp-sky)" />
            <circle cx="128" cy="38" r="13" fill="#fff7ed" />
            <polygon points="0,100 0,70 38,42 70,72 98,50 140,82 178,58 178,100" fill="#7c2d12" fillOpacity="0.85" />
            <polygon points="0,100 0,84 46,66 88,88 130,72 178,90 178,100" fill="#431407" />
          </svg>
        </div>
        <span className="vgp-scanline absolute inset-y-0 w-[3px] bg-white shadow-[0_0_12px_4px_rgba(255,255,255,0.7)]" />
        <span className="vgp-badge absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white">
          HD
        </span>
        <span className="vgp-play absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          <Play className="ml-0.5 h-4 w-4 fill-[#1d1d1f] text-[#1d1d1f]" />
        </span>
      </div>
    </div>
  );
}

function scanKeyframes(): string {
  // Selector dwells on each tile in PICK_ORDER, then moves on; the tile's check pops as it leaves.
  const slot = 100 / PICK_ORDER.length;
  const pos = (i: number) => {
    const t = TILES[i];
    return `translate(${t.col * (TILE_W + TILE_GAP)}px, ${t.row * (TILE_H + TILE_GAP)}px)`;
  };
  const frames: string[] = [];
  const picks: string[] = [];
  PICK_ORDER.forEach((tile, k) => {
    const start = k * slot;
    const leave = start + slot * 0.72;
    frames.push(`${start.toFixed(2)}%, ${leave.toFixed(2)}% { transform: ${pos(tile)}; }`);
    picks.push(
      `@keyframes vgp-pick-${tile} { 0%, ${leave.toFixed(2)}% { transform: scale(0); opacity: 0; } ${(leave + 3).toFixed(2)}% { transform: scale(1.25); opacity: 1; } ${(leave + 6).toFixed(2)}%, 96% { transform: scale(1); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }
.vgp-pick-${tile} { animation: vgp-pick-${tile} 7.2s ease-out infinite; transform: scale(0); }`,
    );
  });
  frames.push(`100% { transform: ${pos(PICK_ORDER[0])}; }`);
  return `@keyframes vgp-scan { ${frames.join(' ')} }\n${picks.join('\n')}`;
}

const SCENE_CSS = `
.vgp-scene-in { animation: vgp-scene-in 0.5s ease-out both; }
@keyframes vgp-scene-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
.vgp-pulse { animation: vgp-pulse 1.6s ease-in-out infinite; }
@keyframes vgp-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.45); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } }
.vgp-indeterminate { animation: vgp-indeterminate 1.3s ease-in-out infinite; }
@keyframes vgp-indeterminate { from { left: -35%; } to { left: 100%; } }

.vgp-bob { animation: vgp-bob 2.4s ease-in-out infinite; }
@keyframes vgp-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
.vgp-mouth { transform-box: fill-box; transform-origin: center; animation: vgp-talk 0.9s ease-in-out infinite; }
@keyframes vgp-talk { 0%, 100% { transform: scaleY(0.35); } 15% { transform: scaleY(1.1); } 30% { transform: scaleY(0.5); } 45% { transform: scaleY(1.25); } 60% { transform: scaleY(0.4); } 78% { transform: scaleY(0.95); } }
.vgp-blink { transform-box: fill-box; transform-origin: center; animation: vgp-blink 4s infinite; }
@keyframes vgp-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
.vgp-wave { transform-box: fill-box; transform-origin: left center; opacity: 0; animation: vgp-wave 1.4s ease-out infinite; }
@keyframes vgp-wave { 0% { opacity: 0; transform: scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateX(8px) scale(1.2); } }
.vgp-eq { transform-box: fill-box; transform-origin: bottom; animation: vgp-eq 0.7s ease-in-out infinite alternate; }
@keyframes vgp-eq { from { transform: scaleY(0.2); } to { transform: scaleY(1); } }

.vgp-search { animation: vgp-search 1.2s ease-in-out infinite; }
@keyframes vgp-search { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(1px, -1px); } 75% { transform: translate(-1px, 1px); } }
.vgp-scan { animation: vgp-scan 7.2s cubic-bezier(0.65, 0, 0.35, 1) infinite; }
${scanKeyframes()}

.vgp-film { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 3px, transparent 3px 7px); }
.vgp-clip-a { animation: vgp-clip-a 3.6s cubic-bezier(0.34, 1.3, 0.64, 1) infinite; }
.vgp-clip-b { animation: vgp-clip-b 3.6s cubic-bezier(0.34, 1.3, 0.64, 1) infinite; }
.vgp-clip-c { animation: vgp-clip-c 3.6s cubic-bezier(0.34, 1.3, 0.64, 1) infinite; }
@keyframes vgp-clip-a { 0% { transform: translate(-34px, -58px) rotate(-8deg); opacity: 0; } 12% { opacity: 1; } 32% { transform: translate(-8px, 0) rotate(0); } 52%, 90% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(0, 0); opacity: 0; } }
@keyframes vgp-clip-b { 0%, 8% { transform: translate(0, -66px); opacity: 0; } 20% { opacity: 1; } 38%, 90% { transform: translate(0, 0); opacity: 1; } 100% { opacity: 0; } }
@keyframes vgp-clip-c { 0%, 14% { transform: translate(34px, -58px) rotate(8deg); opacity: 0; } 26% { opacity: 1; } 44% { transform: translate(8px, 0) rotate(0); } 56%, 90% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(0, 0); opacity: 0; } }
.vgp-seam { opacity: 0; animation: vgp-seam 3.6s ease-out infinite; }
@keyframes vgp-seam { 0%, 54% { opacity: 0; transform: translateX(-50%) scaleY(0.4); } 60% { opacity: 1; transform: translateX(-50%) scaleY(1.2); } 72%, 100% { opacity: 0; transform: translateX(-50%) scaleY(1); } }
.vgp-track { animation: vgp-track 3.6s ease-out infinite; }
@keyframes vgp-track { 0%, 60% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 70% { box-shadow: 0 0 0 4px rgba(245,158,11,0.35); } 90%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } }
.vgp-playhead { animation: vgp-playhead 3.6s linear infinite; }
@keyframes vgp-playhead { 0%, 58% { left: 0; opacity: 0; } 62% { opacity: 1; } 92% { left: 100%; opacity: 1; } 100% { left: 100%; opacity: 0; } }
.vgp-snip { transform-origin: 40% 60%; animation: vgp-snip 0.9s ease-in-out infinite; }
@keyframes vgp-snip { 0%, 100% { transform: rotate(-12deg); } 50% { transform: rotate(14deg); } }

.vgp-reveal { animation: vgp-reveal 3.4s cubic-bezier(0.45, 0, 0.25, 1) infinite; }
@keyframes vgp-reveal { 0% { clip-path: inset(0 100% 0 0); } 55%, 92% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 0); opacity: 0.9; } }
.vgp-scanline { animation: vgp-scanline 3.4s cubic-bezier(0.45, 0, 0.25, 1) infinite; }
@keyframes vgp-scanline { 0% { left: 0; opacity: 1; } 55% { left: 100%; opacity: 1; } 60%, 100% { left: 100%; opacity: 0; } }
.vgp-play { animation: vgp-play 3.4s ease-out infinite; }
@keyframes vgp-play { 0%, 58% { transform: translate(-50%, -50%) scale(0); opacity: 0; } 68% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } 74%, 94% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; } }
.vgp-badge { animation: vgp-badge 3.4s ease-out infinite; }
@keyframes vgp-badge { 0%, 60% { opacity: 0; } 66%, 94% { opacity: 1; } 100% { opacity: 0; } }
.vgp-twinkle { animation: vgp-twinkle 1.8s ease-in-out infinite; }
@keyframes vgp-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7) rotate(0); } 50% { opacity: 1; transform: scale(1.1) rotate(20deg); } }

@media (prefers-reduced-motion: reduce) {
  .vgp-stage *, .vgp-scene-in, .vgp-pulse, .vgp-indeterminate { animation: none !important; }
  .vgp-reveal { clip-path: none; }
  .vgp-play, .vgp-badge, [class*='vgp-pick-'] { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  [class*='vgp-pick-'], .vgp-badge { transform: none; }
}
`;
