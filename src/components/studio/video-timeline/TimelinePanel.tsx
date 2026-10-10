'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
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
  /**
   * Mobile strip: ruler + clip rows + playhead only — no toolbar and no track-name column
   * (an empty track shows its name faintly in its row). Same playhead / scrub behaviour.
   */
  compact?: boolean;
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

export function TimelinePanel({ api, height, compact = false, onTogglePlay, isPlaying = false, sceneLabel, hiddenTrackIds, onClipSplit, onClipDuplicate, onDelete, visualTimeRef }: Props) {
  /** Width of the sticky track-name column (none in compact mode). Fixed for an instance's life. */
  const labelWidth = compact ? 0 : LABEL_WIDTH;
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
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  /** Scroll-scrub time not yet committed to the timeline (render must not overwrite it). */
  const pendingScrubRef = useRef<number | null>(null);
  const scrubTimerRef = useRef<number | null>(null);
  const lastScrubCommitRef = useRef(0);
  /** Last time committed by scrubbing — re-aligning to it would yank the scroll back. */
  const lastScrubTimeRef = useRef<number | null>(null);
  /** Scrolls before this moment came from code (glide, zoom, scene swap), not the user. */
  const ignoreScrollUntilRef = useRef(0);
  const glideRafRef = useRef(0);
  /**
   * Where the paused playhead sits on screen: px from the left edge of the clip area. 0 (the left
   * edge) until something plays; on pause it stays wherever playback left it.
   */
  const pinOffsetRef = useRef(0);
  const wasPlayingRef = useRef(isPlaying);
  ppsRef.current = timeline.pixelsPerSecond;
  durationRef.current = timeline.duration;
  if (!isPlaying && !draggingRef.current && pendingScrubRef.current == null) {
    timeRef.current = timeline.currentTime;
  }

  /** Width of the clip area on screen — the timeline gets this much room after its end. */
  const [stripWidth, setStripWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setStripWidth(Math.max(0, el.clientWidth - labelWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Room after the end so even the last second can be scrolled under a fixed playhead.
  const contentWidth = useMemo(
    () => Math.max(640, timeline.duration * timeline.pixelsPerSecond + Math.max(120, stripWidth)),
    [timeline.duration, timeline.pixelsPerSecond, stripWidth],
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
    // The owner duplicates (it names the copy so it can sync it); otherwise duplicate here.
    if (source && onClipDuplicate) onClipDuplicate(source);
    else duplicateSelected();
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

  /**
   * Paused, the playhead is pinned `pinOffsetRef` px from the left of the clip area: this scrolls so
   * `time` sits there (time = (scrollLeft + pin) / px-per-second). `animate` glides instead of
   * jumping. Near the start the scroll cannot go below 0 — the pin follows the playhead then.
   */
  const alignToTime = useCallback((time: number, animate: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    cancelAnimationFrame(glideRafRef.current);
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const x = time * ppsRef.current;
    const target = Math.min(max, Math.max(0, x - pinOffsetRef.current));
    pinOffsetRef.current = x - target;
    const from = el.scrollLeft;
    if (!animate || Math.abs(target - from) < 1) {
      ignoreScrollUntilRef.current = performance.now() + 120;
      el.scrollLeft = target;
      return;
    }
    const started = performance.now();
    const GLIDE_MS = 260;
    const step = (now: number) => {
      const k = Math.min(1, (now - started) / GLIDE_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      ignoreScrollUntilRef.current = now + 120;
      el.scrollLeft = from + (target - from) * eased;
      if (k < 1) glideRafRef.current = requestAnimationFrame(step);
    };
    glideRafRef.current = requestAnimationFrame(step);
  }, []);

  /** The user put the playhead at `time` on screen (click / drop): keep it pinned right there. */
  const pinAtTime = useCallback((time: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const strip = Math.max(0, el.clientWidth - labelWidth);
    pinOffsetRef.current = Math.max(0, Math.min(strip, time * ppsRef.current - el.scrollLeft));
  }, []);

  /** The user takes over the scroll: stop any glide so it never fights them. */
  const stopGlide = useCallback(() => {
    cancelAnimationFrame(glideRafRef.current);
    ignoreScrollUntilRef.current = 0;
  }, []);

  /**
   * Paused: scrolling the timeline scrubs it — the playhead stays pinned at the left edge and the
   * time under it follows the scroll. The playhead is painted every frame; the time is committed
   * about every 40 ms so the preview keeps up without re-rendering the whole editor per frame.
   */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isPlayingRef.current || draggingRef.current || performance.now() < ignoreScrollUntilRef.current) return;
    const next = Math.max(0, Math.min(durationRef.current, (el.scrollLeft + pinOffsetRef.current) / ppsRef.current));
    if (Math.abs(next - timeRef.current) < 1e-4) return;
    timeRef.current = next;
    if (visualTimeRef) visualTimeRef.current = next;
    paintPlayhead(next);
    pendingScrubRef.current = next;
    if (scrubTimerRef.current == null) {
      const wait = Math.max(0, 40 - (performance.now() - lastScrubCommitRef.current));
      scrubTimerRef.current = window.setTimeout(() => {
        scrubTimerRef.current = null;
        const t = pendingScrubRef.current;
        pendingScrubRef.current = null;
        lastScrubCommitRef.current = performance.now();
        if (t == null) return;
        lastScrubTimeRef.current = t;
        setCurrentTime(t);
      }, wait);
    }
  }, [paintPlayhead, setCurrentTime, visualTimeRef]);

  useEffect(
    () => () => {
      cancelAnimationFrame(glideRafRef.current);
      if (scrubTimerRef.current != null) window.clearTimeout(scrubTimerRef.current);
    },
    [],
  );

  // A zoom or a wider / narrower clip area moves where `time` sits — re-pin it (not a scrub).
  useEffect(() => {
    if (isPlayingRef.current) return;
    alignToTime(timeRef.current, false);
  }, [alignToTime, contentWidth, timeline.pixelsPerSecond]);

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
        if (localX < labelWidth + EDGE) {
          vel = -Math.min(2, Math.max(0, (labelWidth + EDGE - localX) / EDGE)) * MAX_VEL;
        } else if (localX > rect.width - EDGE) {
          vel = Math.min(2, Math.max(0, (localX - (rect.width - EDGE)) / EDGE)) * MAX_VEL;
        }
        if (vel !== 0) {
          const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
          scroller.scrollLeft = Math.max(0, Math.min(maxScroll, scroller.scrollLeft + vel * dt));
        }

        const clipLeft = labelWidth + 2;
        const clipRight = rect.width - 2;
        const viewX = Math.min(clipRight, Math.max(clipLeft, localX));
        const t = Math.max(
          0,
          Math.min(durationRef.current, (viewX + scroller.scrollLeft - labelWidth) / ppsRef.current),
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
        pinAtTime(timeRef.current);
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
    [paintPlayhead, pinAtTime, setCurrentTime, visualTimeRef],
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
        const strip = scroller.clientWidth - labelWidth;
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

  // Paused / stopped: playhead pinned where it is on screen (left edge until something plays; on
  // pause, where playback left it). A seek (ruler / track click, timecode, playhead drop, new
  // scene) glides the timeline so that time sits under it; a time from scrolling is already there.
  useEffect(() => {
    const justPaused = wasPlayingRef.current && !isPlaying;
    wasPlayingRef.current = isPlaying;
    if (isPlaying || draggingRef.current) return;
    if (justPaused) {
      // Stay where playback left the playhead — no jump back to the left edge.
      const el = scrollRef.current;
      const strip = el ? Math.max(0, el.clientWidth - labelWidth) : 0;
      if (el) {
        pinOffsetRef.current = Math.max(0, Math.min(strip, timeline.currentTime * ppsRef.current - el.scrollLeft));
      }
    }
    paintPlayhead(pendingScrubRef.current ?? timeline.currentTime);
    if (pendingScrubRef.current != null) return;
    if (lastScrubTimeRef.current != null && Math.abs(timeline.currentTime - lastScrubTimeRef.current) < 1e-6) return;
    lastScrubTimeRef.current = null;
    alignToTime(timeline.currentTime, true);
  }, [isPlaying, alignToTime, paintPlayhead, timeline.currentTime, timeline.pixelsPerSecond]);

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
    // `height` is a ceiling, not a fixed size: the panel hugs its tracks (no blank band under
    // them) and only scrolls when there are more tracks than fit.
    <div className="isolate flex min-h-0 flex-shrink-0 flex-col border-t border-gray-200 bg-white" style={{ maxHeight: height }}>
      {!compact && (
      <TimelineToolbar
        currentTime={timeline.currentTime}
        duration={timeline.duration}
        pixelsPerSecond={timeline.pixelsPerSecond}
        canUndo={historyLength > 0}
        canRedo={futureLength > 0}
        hasSelection={timeline.selectedClipIds.length > 0}
        canDuplicate={
          timeline.selectedClipIds.length > 0 &&
          // One animation belongs to one B-roll — infographics are never duplicated.
          !timeline.tracks.some((t) =>
            t.clips.some((c) => c.id === timeline.selectedClipIds[0] && c.type === 'infographic'),
          )
        }
        onUndo={undo}
        onRedo={redo}
        onSplit={handleSplit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onZoomIn={() => setPixelsPerSecond(timeline.pixelsPerSecond + 20)}
        onZoomOut={() => setPixelsPerSecond(timeline.pixelsPerSecond - 20)}
      />
      )}
     

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ scrollbarWidth: 'thin' }}
        onScroll={handleScroll}
        onWheel={stopGlide}
        onPointerDownCapture={stopGlide}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-clip-id]')) return;
          clearSelection();
          // An empty spot in the tracks moves the playhead there, so Play starts from it.
          const el = scrollRef.current;
          if (!el || isPlayingRef.current) return;
          const x = e.clientX - el.getBoundingClientRect().left;
          if (x <= labelWidth) return;
          const t = Math.max(0, Math.min(durationRef.current, (x - labelWidth + el.scrollLeft) / ppsRef.current));
          if (visualTimeRef) visualTimeRef.current = t;
          pinAtTime(t);
          setCurrentTime(t);
        }}
      >
        {/* Sticky header row: track label corner + time ruler. Above the sticky track
            labels (z-40) and the tracks playhead so rows scroll underneath it. */}
        <div
          className="sticky top-0 z-[60] flex border-b border-gray-200 bg-white"
          style={{ height: RULER_HEIGHT, width: labelWidth + contentWidth }}
        >
          {!compact && (
            <div
              className="sticky left-0 z-50 flex flex-shrink-0 items-center border-r border-gray-200 bg-[#fafafa] px-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]"
              style={{ width: labelWidth, height: RULER_HEIGHT }}
            >
              Tracks
            </div>
          )}
          <div className="relative flex-shrink-0" style={{ width: contentWidth, height: RULER_HEIGHT }}>
            <TimelineRuler
              duration={timeline.duration}
              pixelsPerSecond={timeline.pixelsPerSecond}
              width={contentWidth}
                    onSeek={(t) => {
                      pinAtTime(t);
                      setCurrentTime(t);
                    }}
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
        <div className="relative flex" style={{ width: labelWidth + contentWidth, height: tracksHeight }}>
          {!compact && (
            <div
              className="sticky left-0 z-40 flex-shrink-0 border-r border-gray-200 bg-white"
              style={{ width: labelWidth }}
            >
              {visibleTracks.map((track) => (
                <TrackHeader
                  key={track.id}
                  track={track}
                  width={labelWidth}
                  onChange={(patch) => updateTrack(track.id, patch)}
                />
              ))}
            </div>
          )}

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
                  {compact && track.clips.length === 0 && (
                    <div className="pointer-events-none sticky left-2 flex h-full w-max items-center text-[10px] text-[#a1a1a6]">
                      {track.name}
                    </div>
                  )}
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
