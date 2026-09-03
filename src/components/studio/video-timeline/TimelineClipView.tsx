'use client';

import { memo, useCallback, useRef } from 'react';
import type { TimelineClip } from '@/lib/video-editor/types';
import { AudioWaveform } from './AudioWaveform';

type Props = {
  clip: TimelineClip;
  pixelsPerSecond: number;
  selected: boolean;
  trackLocked: boolean;
  trackHeight: number;
  onSelect: (e: React.MouseEvent) => void;
  onBeginMove: (clipId: string) => void;
  onBeginTrim: (clipId: string, edge: 'left' | 'right') => void;
  onPointerDelta: (deltaPx: number, disableSnap: boolean) => void;
  onPointerEnd: () => void;
};

const TYPE_STYLES: Record<string, string> = {
  video: 'border-sky-300 bg-sky-100 text-sky-950',
  broll: 'border-teal-300 bg-teal-100 text-teal-950',
  text: 'border-amber-300 bg-amber-50 text-amber-950',
  caption: 'border-orange-300 bg-orange-50 text-orange-950',
  voiceover: 'border-indigo-300 bg-indigo-100 text-indigo-950',
  music: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950',
  infographic: 'border-violet-300 bg-violet-100 text-violet-950',
};

export const TimelineClipView = memo(function TimelineClipView({
  clip,
  pixelsPerSecond,
  selected,
  trackLocked,
  trackHeight,
  onSelect,
  onBeginMove,
  onBeginTrim,
  onPointerDelta,
  onPointerEnd,
}: Props) {
  const dragOriginX = useRef(0);
  const moved = useRef(false);

  const left = clip.start * pixelsPerSecond;
  const width = Math.max(8, clip.duration * pixelsPerSecond);
  const locked = trackLocked || Boolean(clip.locked);
  const style = TYPE_STYLES[clip.type] ?? TYPE_STYLES.video;

  const startInteraction = useCallback(
    (kind: 'move' | 'left' | 'right', e: React.PointerEvent) => {
      if (locked) return;
      e.stopPropagation();
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      dragOriginX.current = e.clientX;
      moved.current = false;
      if (kind === 'move') onBeginMove(clip.id);
      else onBeginTrim(clip.id, kind);

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - dragOriginX.current;
        if (!moved.current && Math.abs(dx) > 2) moved.current = true;
        if (!moved.current) return;
        onPointerDelta(dx, ev.altKey);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        onPointerEnd();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [clip.id, locked, onBeginMove, onBeginTrim, onPointerDelta, onPointerEnd],
  );

  const showThumbs = (clip.type === 'video' || clip.type === 'broll') && trackHeight >= 40;
  const showWave = clip.type === 'voiceover' || clip.type === 'music';

  return (
    <div
      role="button"
      tabIndex={0}
      data-clip-id={clip.id}
      onClick={(e) => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        onSelect(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(e as unknown as React.MouseEvent);
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).dataset.trim) return;
        startInteraction('move', e);
      }}
      className={`absolute top-0.5 touch-none select-none overflow-hidden rounded-md border text-left ${style} ${
        selected ? 'z-10 ring-2 ring-amber-400 ring-offset-1' : 'z-[1]'
      } ${locked ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'} ${
        clip.hidden ? 'opacity-40' : ''
      }`}
      style={{ left, width, height: trackHeight - 4 }}
      title={`${clip.name} · ${clip.start.toFixed(2)}s → ${(clip.start + clip.duration).toFixed(2)}s`}
    >
      {selected && !locked && (
        <>
          <span
            data-trim="left"
            onPointerDown={(e) => startInteraction('left', e)}
            className="absolute bottom-0 left-0 top-0 z-20 w-1.5 cursor-ew-resize bg-amber-500/80 hover:bg-amber-500"
          />
          <span
            data-trim="right"
            onPointerDown={(e) => startInteraction('right', e)}
            className="absolute bottom-0 right-0 top-0 z-20 w-1.5 cursor-ew-resize bg-amber-500/80 hover:bg-amber-500"
          />
        </>
      )}

      {showThumbs && (
        <div className="pointer-events-none absolute inset-0 flex opacity-40">
          {Array.from({ length: Math.min(8, Math.max(1, Math.floor(width / 36))) }).map((_, i) => (
            <div
              key={i}
              className="h-full flex-1 border-r border-black/5 bg-cover bg-center"
              style={
                clip.thumbnailUrl
                  ? { backgroundImage: `url(${clip.thumbnailUrl})` }
                  : { background: 'linear-gradient(135deg,#94a3b8,#64748b)' }
              }
            />
          ))}
        </div>
      )}

      {showWave && (
        <div className="pointer-events-none absolute inset-x-1 inset-y-1 text-current">
          <AudioWaveform peaks={clip.waveformPeaks} />
        </div>
      )}

      <div className="relative z-[1] flex h-full flex-col justify-center px-2 py-0.5">
        <span className="truncate text-[10px] font-semibold leading-tight">{clip.name}</span>
        {(clip.type === 'text' || clip.type === 'caption' || clip.type === 'infographic') &&
          clip.text &&
          clip.text !== clip.name &&
          trackHeight >= 36 && (
          <span className="truncate text-[9px] opacity-70">{clip.text}</span>
        )}
      </div>
    </div>
  );
});
