'use client';

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { UseVideoTimelineReturn } from '@/hooks/useVideoTimeline';
import type { TimelineClip } from '@/lib/video-editor/types';
import { TimelineRuler } from './TimelineRuler';
import { TimelinePlayhead } from './TimelinePlayhead';
import { TimelineClipView } from './TimelineClipView';
import { TrackHeader } from './TrackHeader';
import { RULER_HEIGHT, TRACK_ROW_HEIGHT, trackHeightPx } from './trackLayout';
import { TimelineToolbar } from './TimelineToolbar';

type Props = {
  api: UseVideoTimelineReturn;
  height: number;
  onTogglePlay?: () => void;
  /** Drives the follow-the-playhead scroll during playback. */
  isPlaying?: boolean;
  sceneLabel?: string;
  /** Track ids to hide from the row list (e.g. the unused raw "video" track). */
  hiddenTrackIds?: string[];
  /** Fired right after a clip is split, with the pre-split clip and the split point (scene-local seconds). */
  onClipSplit?: (clip: TimelineClip, splitAt: number) => void;
  /** Fired after a clip is duplicated so the editor can queue /add-media. */
  onClipDuplicate?: (source: TimelineClip) => void;
  /** Replaces the default delete (e.g. to also sync deletions to the backend). */
  onDelete?: () => void;
  /** 60fps clock from the preview — keeps the orange bar moving without a full re-render. */
  visualTimeRef?: MutableRefObject<number>;
};

const LABEL_WIDTH = 148;

export function TimelinePanel({ api, height, onTogglePlay, isPlaying = false, sceneLabel, hiddenTrackIds, onClipSplit, onClipDuplicate, onDelete, visualTimeRef }: Props) {
  const {
    timeline,
    snapGuide,
    setCurrentTime,
    setPixelsPerSecond,
    selectClips,
    clearSelection,
    updateTrack,
    deleteSelected,
    duplicateSelected,
    splitSelectedAtPlayhead,
    beginMove,
    beginTrim,
    applyPointerDelta,
    endPointerInteraction,
    undo,
    redo,
    historyLength,
    futureLength,
  } = api;

  const handleDelete = onDelete ?? deleteSelected;

  /** One shared scroller keeps track labels and clip rows pixel-aligned. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement>(null);
  const tracksPlayheadRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const ppsRef = useRef(timeline.pixelsPerSecond);
  const durationRef = useRef(timeline.duration);
  const timeRef = useRef(timeline.currentTime);
  ppsRef.current = timeline.pixelsPerSecond;
  durationRef.current = timeline.duration;
  if (!isPlaying && !draggingRef.current) timeRef.current = timeline.currentTime;

  const contentWidth = useMemo(
    () => Math.max(640, timeline.duration * timeline.pixelsPerSecond + 120),
    [timeline.duration, timeline.pixelsPerSecond],
  );

  const visibleTracks = useMemo(
    () => (hiddenTrackIds?.length ? timeline.tracks.filter((t) => !hiddenTrackIds.includes(t.id)) : timeline.tracks),
    [timeline.tracks, hiddenTrackIds],
  );

  const tracksHeight = visibleTracks.length * TRACK_ROW_HEIGHT;

  const handleSplit = useCallback(() => {
    const id = timeline.selectedClipIds[0];
    const clip = id ? timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === id) : undefined;
    const splitAt = timeline.currentTime;
    splitSelectedAtPlayhead();
    if (clip) onClipSplit?.(clip, splitAt);
  }, [timeline, splitSelectedAtPlayhead, onClipSplit]);

  const handleDuplicate = useCallback(() => {
    const id = timeline.selectedClipIds[0];
    const source = id ? timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === id) : undefined;
    duplicateSelected();
    if (source) onClipDuplicate?.(source);
  }, [timeline, duplicateSelected, onClipDuplicate]);

  const onPointerDelta = useCallback(
    (deltaPx: number, disableSnap: boolean) => {
      applyPointerDelta(deltaPx, { disableSnap });
    },
    [applyPointerDelta],
  );

  const paintPlayhead = useCallback((time: number) => {
    const x = `translate3d(${time * ppsRef.current}px, 0, 0)`;
    if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.transform = x;
    if (tracksPlayheadRef.current) tracksPlayheadRef.current.style.transform = x;
  }, []);

  const keepPlayheadVisible = useCallback((time: number, instant = true) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const visible = scroller.clientWidth - LABEL_WIDTH;
    if (visible <= 0) return;
    const playheadX = time * ppsRef.current;
    const pad = 28;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + visible;
    let dest = scroller.scrollLeft;
    if (playheadX < viewLeft + pad) dest = Math.max(0, playheadX - pad);
    else if (playheadX > viewRight - pad) {
      dest = playheadX - visible + pad;
    } else {
      return;
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    dest = Math.min(maxScroll, Math.max(0, dest));
    if (instant) scroller.scrollLeft = dest;
    return dest;
  }, []);

  const beginPlayheadDrag = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const scroller = scrollRef.current;
      if (!scroller) return;
      draggingRef.current = true;
      let pointerX = e.clientX;
      let lastTs = performance.now();
      let lastCommit = 0;
      let raf = 0;

      const apply = (now: number) => {
        const dt = Math.min(0.032, Math.max(0, (now - lastTs) / 1000));
        lastTs = now;
        const rect = scroller.getBoundingClientRect();
        const localX = pointerX - rect.left;
        const EDGE = 80;
        const MAX_VEL = 1600;
        let vel = 0;
        if (localX < LABEL_WIDTH + EDGE) {
          vel = -Math.min(2, Math.max(0, (LABEL_WIDTH + EDGE - localX) / EDGE)) * MAX_VEL;
        } else if (localX > rect.width - EDGE) {
          vel = Math.min(2, Math.max(0, (localX - (rect.width - EDGE)) / EDGE)) * MAX_VEL;
        }
        if (vel !== 0) {
          const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
          scroller.scrollLeft = Math.max(0, Math.min(maxScroll, scroller.scrollLeft + vel * dt));
        }

        const clipLeft = LABEL_WIDTH + 2;
        const clipRight = rect.width - 2;
        const viewX = Math.min(clipRight, Math.max(clipLeft, localX));
        const t = Math.max(
          0,
          Math.min(durationRef.current, (viewX + scroller.scrollLeft - LABEL_WIDTH) / ppsRef.current),
        );
        timeRef.current = t;
        if (visualTimeRef) visualTimeRef.current = t;
        paintPlayhead(t);
        if (now - lastCommit > 40) {
          lastCommit = now;
          setCurrentTime(t);
        }
      };

      const move = (ev: PointerEvent) => {
        pointerX = ev.clientX;
      };
      const tick = (now: number) => {
        if (!draggingRef.current) return;
        apply(now);
        raf = requestAnimationFrame(tick);
      };
      const up = () => {
        draggingRef.current = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setCurrentTime(timeRef.current);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      apply(performance.now());
      raf = requestAnimationFrame(tick);
    },
    [paintPlayhead, setCurrentTime, visualTimeRef],
  );

  useEffect(() => {
    if (!isPlaying || draggingRef.current) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const t = visualTimeRef?.current ?? timeRef.current;
      timeRef.current = t;
      paintPlayhead(t);

      const scroller = scrollRef.current;
      if (scroller) {
        const strip = scroller.clientWidth - LABEL_WIDTH;
        if (strip > 0) {
          const playheadX = t * ppsRef.current;
          const dest = Math.min(
            Math.max(0, scroller.scrollWidth - scroller.clientWidth),
            Math.max(0, playheadX - strip / 2),
          );
          if (playheadX - scroller.scrollLeft > strip / 2) {
            scroller.scrollLeft += (dest - scroller.scrollLeft) * (1 - Math.exp(-dt * 12));
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, paintPlayhead, visualTimeRef]);

  useEffect(() => {
    if (isPlaying || draggingRef.current) return;
    paintPlayhead(timeline.currentTime);
    keepPlayheadVisible(timeline.currentTime);
  }, [isPlaying, keepPlayheadVisible, paintPlayhead, timeline.currentTime, timeline.pixelsPerSecond]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay?.();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && timeline.selectedClipIds.length) {
        e.preventDefault();
        handleDelete();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key.toLowerCase() === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSplit();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime(timeline.currentTime - (e.shiftKey ? 1 : 0.1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime(timeline.currentTime + (e.shiftKey ? 1 : 0.1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    handleDelete,
    handleSplit,
    onTogglePlay,
    redo,
    setCurrentTime,
    timeline.currentTime,
    timeline.selectedClipIds.length,
    undo,
  ]);

  return (
    // `isolate`: the sticky header / labels / playhead z-indexes only rank against each
    // other — they can never paint over dialogs or popups elsewhere on the page.
    <div className="isolate flex h-full min-h-0 flex-col border-t border-gray-200 bg-white" style={{ height }}>
      <TimelineToolbar
        currentTime={timeline.currentTime}
        duration={timeline.duration}
        pixelsPerSecond={timeline.pixelsPerSecond}
        canUndo={historyLength > 0}
        canRedo={futureLength > 0}
        hasSelection={timeline.selectedClipIds.length > 0}
        onUndo={undo}
        onRedo={redo}
        onSplit={handleSplit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onZoomIn={() => setPixelsPerSecond(timeline.pixelsPerSecond + 20)}
        onZoomOut={() => setPixelsPerSecond(timeline.pixelsPerSecond - 20)}
      />
      {sceneLabel ? (
        <div className="flex-shrink-0 border-b border-gray-100 bg-[#fafafa] px-3 py-1 text-[11px] text-[#6e6e73]">
          Editing scene: <span className="font-semibold text-[#1d1d1f]">{sceneLabel}</span>
          <span className="text-[#a1a1a6]"> · timeline length matches voiceover</span>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ scrollbarWidth: 'thin' }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-clip-id]')) return;
          clearSelection();
        }}
      >
        {/* Sticky header row: track label corner + time ruler. Above the sticky track
            labels (z-40) and the tracks playhead so rows scroll underneath it. */}
        <div
          className="sticky top-0 z-[60] flex border-b border-gray-200 bg-white"
          style={{ height: RULER_HEIGHT, width: LABEL_WIDTH + contentWidth }}
        >
          <div
            className="sticky left-0 z-50 flex flex-shrink-0 items-center border-r border-gray-200 bg-[#fafafa] px-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]"
            style={{ width: LABEL_WIDTH, height: RULER_HEIGHT }}
          >
            Tracks
          </div>
          <div className="relative flex-shrink-0" style={{ width: contentWidth, height: RULER_HEIGHT }}>
            <TimelineRuler
              duration={timeline.duration}
              pixelsPerSecond={timeline.pixelsPerSecond}
              width={contentWidth}
                    onSeek={setCurrentTime}
            />
            <TimelinePlayhead
              time={timeline.currentTime}
              pixelsPerSecond={timeline.pixelsPerSecond}
              height={RULER_HEIGHT}
              onPointerDown={beginPlayheadDrag}
              nodeRef={rulerPlayheadRef}
              followProps={false}
            />
          </div>
        </div>

        {/* Body: labels + clip rows share the same vertical scroll */}
        <div className="relative flex" style={{ width: LABEL_WIDTH + contentWidth, height: tracksHeight }}>
          <div
            className="sticky left-0 z-40 flex-shrink-0 border-r border-gray-200 bg-white"
            style={{ width: LABEL_WIDTH }}
          >
            {visibleTracks.map((track) => (
              <TrackHeader
                key={track.id}
                track={track}
                width={LABEL_WIDTH}
                onChange={(patch) => updateTrack(track.id, patch)}
              />
            ))}
          </div>

          <div className="relative flex-shrink-0" style={{ width: contentWidth, height: tracksHeight }}>
            {snapGuide != null && (
              <div
                className="pointer-events-none absolute top-0 z-30 w-px bg-rose-500"
                style={{ left: snapGuide * timeline.pixelsPerSecond, height: tracksHeight }}
              />
            )}

            {visibleTracks.map((track) => {
              const h = trackHeightPx(track);
              return (
                <div
                  key={track.id}
                  className={`relative border-b border-gray-100 ${track.visible ? '' : 'opacity-40'}`}
                  style={{ height: h }}
                >
                  {track.clips.map((clip) => (
                    <TimelineClipView
                      key={clip.id}
                      clip={clip}
                      pixelsPerSecond={timeline.pixelsPerSecond}
                      selected={timeline.selectedClipIds.includes(clip.id)}
                      trackLocked={track.locked}
                      trackHeight={h}
                      onSelect={(e) => {
                        selectClips([clip.id], e.metaKey || e.ctrlKey);
                      }}
                      onBeginMove={beginMove}
                      onBeginTrim={beginTrim}
                      onPointerDelta={onPointerDelta}
                      onPointerEnd={endPointerInteraction}
                    />
                  ))}
                </div>
              );
            })}

            <TimelinePlayhead
              time={timeline.currentTime}
              pixelsPerSecond={timeline.pixelsPerSecond}
              height={tracksHeight}
              onPointerDown={beginPlayheadDrag}
              nodeRef={tracksPlayheadRef}
              followProps={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
