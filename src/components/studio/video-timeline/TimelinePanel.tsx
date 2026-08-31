'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  sceneLabel?: string;
  /** Track ids to hide from the row list (e.g. the unused raw "video" track). */
  hiddenTrackIds?: string[];
  /** Fired right after a clip is split, with the pre-split clip and the split point (scene-local seconds). */
  onClipSplit?: (clip: TimelineClip, splitAt: number) => void;
  /** Replaces the default delete (e.g. to also sync deletions to the backend). */
  onDelete?: () => void;
};

const LABEL_WIDTH = 148;

export function TimelinePanel({ api, height, onTogglePlay, sceneLabel, hiddenTrackIds, onClipSplit, onDelete }: Props) {
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

  const onPointerDelta = useCallback(
    (deltaPx: number, disableSnap: boolean) => {
      applyPointerDelta(deltaPx, { disableSnap });
    },
    [applyPointerDelta],
  );

  const beginPlayheadDrag = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const scroller = scrollRef.current;
      if (!scroller) return;
      const move = (ev: PointerEvent) => {
        const rect = scroller.getBoundingClientRect();
        const x = ev.clientX - rect.left + scroller.scrollLeft - LABEL_WIDTH;
        setCurrentTime(Math.max(0, x / timeline.pixelsPerSecond));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      move(e.nativeEvent);
    },
    [setCurrentTime, timeline.pixelsPerSecond],
  );

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
    <div className="flex h-full min-h-0 flex-col border-t border-gray-200 bg-white" style={{ height }}>
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
        onDuplicate={duplicateSelected}
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
        {/* Sticky header row: track label corner + time ruler */}
        <div
          className="sticky top-0 z-20 flex border-b border-gray-200 bg-white"
          style={{ height: RULER_HEIGHT, width: LABEL_WIDTH + contentWidth }}
        >
          <div
            className="sticky left-0 z-30 flex flex-shrink-0 items-center border-r border-gray-200 bg-[#fafafa] px-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#a1a1a6]"
            style={{ width: LABEL_WIDTH, height: RULER_HEIGHT }}
          >
            Tracks
          </div>
          <div className="flex-shrink-0" style={{ width: contentWidth, height: RULER_HEIGHT }}>
            <TimelineRuler
              duration={timeline.duration}
              pixelsPerSecond={timeline.pixelsPerSecond}
              width={contentWidth}
              onSeek={setCurrentTime}
            />
          </div>
        </div>

        {/* Body: labels + clip rows share the same vertical scroll */}
        <div className="relative flex" style={{ width: LABEL_WIDTH + contentWidth, height: tracksHeight }}>
          <div
            className="sticky left-0 z-10 flex-shrink-0 border-r border-gray-200 bg-white"
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
