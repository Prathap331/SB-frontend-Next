'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  MAX_PPS,
  MIN_PPS,
  type TimelineClip,
  type TimelineState,
  type TimelineTrack,
} from '@/lib/video-editor/types';
import {
  calculateClipMove,
  calculateTrimLeft,
  calculateTrimRight,
  collectSnapTargets,
  duplicateClip,
  findClip,
  recomputeTimelineDuration,
  replaceTrackClips,
  snapTime,
  splitClip,
  updateClipInState,
} from '@/lib/video-editor/math';
import { addClipToTrack, createEmptyTimeline, sanitizeTimelineTracks } from '@/lib/video-editor/migrate';

type HistoryEntry = string;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneState(state: TimelineState): TimelineState {
  return JSON.parse(JSON.stringify(state)) as TimelineState;
}

export type SceneBoundaryInput = { sceneId: string; title: string; start: number; end: number };

/** A finished drag (`move`) or edge drag (`trim-left` / `trim-right`) of one clip. */
export type ClipEditEvent = {
  kind: 'move' | 'trim-left' | 'trim-right';
  before: TimelineClip;
  after: TimelineClip;
  /** It was dropped while being held at the edge of its `getClipBounds` range. */
  clamped: boolean;
};

/** Seconds a clip must stay within (e.g. an overlay animation inside its B-roll). */
export type ClipBounds = { start: number; end: number };

export function useVideoTimeline(
  initial?: TimelineState,
  opts?: {
    onClipEdited?: (event: ClipEditEvent) => void;
    /** Receives the timeline being edited — it runs inside a state update, during render. */
    getClipBounds?: (clip: TimelineClip, timeline: TimelineState) => ClipBounds | null;
  },
) {
  const onClipEditedRef = useRef(opts?.onClipEdited);
  onClipEditedRef.current = opts?.onClipEdited;
  const getClipBoundsRef = useRef(opts?.getClipBounds);
  getClipBoundsRef.current = opts?.getClipBounds;
  const [timeline, setTimeline] = useState<TimelineState>(initial ?? createEmptyTimeline());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const [snapGuide, setSnapGuide] = useState<number | null>(null);

  const interactionRef = useRef<{
    kind: 'move' | 'trim-left' | 'trim-right' | null;
    clipId: string | null;
    snapshot: TimelineState | null;
    moved: boolean;
    /** The latest drag frame was held back by the clip's bounds. */
    clamped: boolean;
  }>({ kind: null, clipId: null, snapshot: null, moved: false, clamped: false });

  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const pushHistory = useCallback((state: TimelineState) => {
    setHistory((h) => [...h.slice(-40), JSON.stringify(state)]);
    setFuture([]);
  }, []);

  const commit = useCallback(
    (updater: (prev: TimelineState) => TimelineState, recordHistory = true) => {
      setTimeline((prev) => {
        if (recordHistory) pushHistory(prev);
        return updater(prev);
      });
    },
    [pushHistory],
  );

  const replaceTimeline = useCallback((next: TimelineState, recordHistory = false) => {
    const cleaned = sanitizeTimelineTracks(next);
    setTimeline((prev) => {
      if (recordHistory) {
        setHistory((h) => [...h.slice(-40), JSON.stringify(prev)]);
        setFuture([]);
      }
      return cleaned;
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [...f, JSON.stringify(timeline)]);
      setTimeline(JSON.parse(prev) as TimelineState);
      return h.slice(0, -1);
    });
  }, [timeline]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setHistory((h) => [...h, JSON.stringify(timeline)]);
      setTimeline(JSON.parse(next) as TimelineState);
      return f.slice(0, -1);
    });
  }, [timeline]);

  const setCurrentTime = useCallback((t: number) => {
    setTimeline((prev) => {
      const next = Math.max(0, Math.min(prev.duration, t));
      if (Math.abs(prev.currentTime - next) < 0.0005) return prev;
      return { ...prev, currentTime: next };
    });
  }, []);

  const setPixelsPerSecond = useCallback((pps: number) => {
    setTimeline((prev) => ({
      ...prev,
      pixelsPerSecond: Math.min(MAX_PPS, Math.max(MIN_PPS, Math.round(pps))),
    }));
  }, []);

  const selectClips = useCallback((ids: string[], additive = false) => {
    setTimeline((prev) => ({
      ...prev,
      selectedClipIds: additive
        ? Array.from(new Set([...prev.selectedClipIds, ...ids]))
        : ids,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setTimeline((prev) => ({ ...prev, selectedClipIds: [] }));
  }, []);

  const updateTrack = useCallback(
    (trackId: string, patch: Partial<TimelineTrack>) => {
      commit((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? { ...t, ...patch } : t)),
      }));
    },
    [commit],
  );

  const addClip = useCallback(
    (trackId: string, clip: Omit<TimelineClip, 'trackId'> & { trackId?: string }) => {
      commit((prev) => addClipToTrack(prev, trackId, clip));
    },
    [commit],
  );

  const updateClip = useCallback(
    (clipId: string, patch: Partial<TimelineClip>) => {
      commit((prev) => updateClipInState(prev, clipId, patch));
    },
    [commit],
  );

  const deleteSelected = useCallback(() => {
    commit((prev) => {
      if (!prev.selectedClipIds.length) return prev;
      const remove = new Set(prev.selectedClipIds);
      const tracks = prev.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => !remove.has(c.id)),
      }));
      return {
        ...prev,
        tracks,
        selectedClipIds: [],
        duration: recomputeTimelineDuration(tracks, prev.duration),
      };
    });
  }, [commit]);

  const duplicateSelected = useCallback((patch?: Partial<TimelineClip>): TimelineClip | null => {
    let created: TimelineClip | null = null;
    commit((prev) => {
      const id = prev.selectedClipIds[0];
      if (!id) return prev;
      const found = findClip(prev, id);
      if (!found || found.track.locked) return prev;
      const dup: TimelineClip = { ...duplicateClip(found.clip, uid('dup')), ...patch };
      created = dup;
      const tracks = prev.tracks.map((t) =>
        t.id === found.track.id ? { ...t, clips: [...t.clips, dup] } : t,
      );
      return {
        ...prev,
        tracks,
        selectedClipIds: [dup.id],
        duration: recomputeTimelineDuration(tracks, prev.duration),
      };
    });
    return created;
  }, [commit]);

  const splitSelectedAtPlayhead = useCallback(() => {
    commit((prev) => {
      const id = prev.selectedClipIds[0];
      if (!id) return prev;
      const found = findClip(prev, id);
      if (!found || found.track.locked || found.clip.locked) return prev;
      const parts = splitClip(found.clip, prev.currentTime);
      if (!parts) return prev;
      const clips = [...found.track.clips];
      clips.splice(found.clipIndex, 1, parts.left, parts.right);
      const next = replaceTrackClips(prev, found.track.id, clips);
      return { ...next, selectedClipIds: [parts.left.id, parts.right.id] };
    });
  }, [commit]);

  const beginMove = useCallback((clipId: string) => {
    interactionRef.current = {
      kind: 'move',
      clipId,
      snapshot: cloneState(timelineRef.current),
      moved: false,
      clamped: false,
    };
  }, []);

  const beginTrim = useCallback((clipId: string, edge: 'left' | 'right') => {
    interactionRef.current = {
      kind: edge === 'left' ? 'trim-left' : 'trim-right',
      clipId,
      snapshot: cloneState(timelineRef.current),
      moved: false,
      clamped: false,
    };
  }, []);

  const applyPointerDelta = useCallback(
    (
      deltaPixels: number,
      opts: {
        sceneBoundaries?: SceneBoundaryInput[];
        disableSnap?: boolean;
      } = {},
    ) => {
      const ix = interactionRef.current;
      if (!ix.kind || !ix.clipId || !ix.snapshot) return;
      ix.moved = true;

      setTimeline(() => {
        const base = ix.snapshot!;
        const found = findClip(base, ix.clipId!);
        if (!found || found.track.locked || found.clip.locked) return base;

        const deltaSec = deltaPixels / base.pixelsPerSecond;
        const bounds = getClipBoundsRef.current?.(found.clip, base) ?? null;
        ix.clamped = false;
        const exclude = new Set([found.clip.id]);
        const targets = collectSnapTargets({
          currentTime: base.currentTime,
          tracks: base.tracks,
          excludeClipIds: exclude,
          sceneBoundaries: opts.sceneBoundaries?.map((b) => ({
            start: b.start,
            end: b.end,
          })),
          duration: base.duration,
        });

        if (ix.kind === 'move') {
          const rawStart = found.clip.start + deltaSec;
          const snapped = snapTime(
            rawStart,
            targets,
            base.pixelsPerSecond,
            undefined,
            opts.disableSnap,
          );
          setSnapGuide(snapped.snappedTo ? snapped.time : null);
          // Only patch start — never add/remove clips during drag.
          const patch = calculateClipMove(found.clip, snapped.time - found.clip.start);
          if (bounds) {
            const latest = Math.max(bounds.start, bounds.end - found.clip.duration);
            const held = Math.min(latest, Math.max(bounds.start, patch.start));
            if (Math.abs(held - patch.start) > 1e-6) {
              ix.clamped = true;
              patch.start = held;
            }
          }
          return updateClipInState(base, found.clip.id, patch);
        }

        if (ix.kind === 'trim-left') {
          const patch = calculateTrimLeft(found.clip, deltaSec);
          const snapped = snapTime(
            patch.start,
            targets,
            base.pixelsPerSecond,
            undefined,
            opts.disableSnap,
          );
          if (snapped.snappedTo) {
            const adj = snapped.time - found.clip.start;
            Object.assign(patch, calculateTrimLeft(found.clip, adj));
            setSnapGuide(snapped.time);
          } else {
            setSnapGuide(null);
          }
          if (bounds && patch.start < bounds.start - 1e-6) {
            ix.clamped = true;
            Object.assign(patch, calculateTrimLeft(found.clip, bounds.start - found.clip.start));
          }
          return updateClipInState(base, found.clip.id, patch);
        }

        if (ix.kind === 'trim-right') {
          const end = found.clip.start + found.clip.duration + deltaSec;
          const snapped = snapTime(end, targets, base.pixelsPerSecond, undefined, opts.disableSnap);
          const adj = snapped.time - (found.clip.start + found.clip.duration);
          setSnapGuide(snapped.snappedTo ? snapped.time : null);
          let patch = calculateTrimRight(found.clip, adj);
          if (bounds && found.clip.start + patch.duration > bounds.end + 1e-6) {
            ix.clamped = true;
            patch = calculateTrimRight(found.clip, bounds.end - (found.clip.start + found.clip.duration));
          }
          return updateClipInState(base, found.clip.id, patch);
        }

        return base;
      });
    },
    [],
  );

  const endPointerInteraction = useCallback(() => {
    const ix = interactionRef.current;
    if (ix.snapshot && ix.moved) {
      pushHistory(ix.snapshot);
      const before = ix.clipId ? findClip(ix.snapshot, ix.clipId)?.clip : undefined;
      const after = ix.clipId ? findClip(timelineRef.current, ix.clipId)?.clip : undefined;
      if (ix.kind && before && after) {
        onClipEditedRef.current?.({ kind: ix.kind, before, after, clamped: ix.clamped });
      }
    }
    interactionRef.current = { kind: null, clipId: null, snapshot: null, moved: false, clamped: false };
    setSnapGuide(null);
  }, [pushHistory]);

  const selectedClip = useMemo(() => {
    const id = timeline.selectedClipIds[0];
    if (!id) return null;
    return findClip(timeline, id)?.clip ?? null;
  }, [timeline]);

  return {
    timeline,
    setTimeline: replaceTimeline,
    historyLength: history.length,
    futureLength: future.length,
    undo,
    redo,
    snapGuide,
    selectedClip,
    setCurrentTime,
    setPixelsPerSecond,
    selectClips,
    clearSelection,
    updateTrack,
    addClip,
    updateClip,
    deleteSelected,
    duplicateSelected,
    splitSelectedAtPlayhead,
    beginMove,
    beginTrim,
    applyPointerDelta,
    endPointerInteraction,
    commit,
  };
}

export type UseVideoTimelineReturn = ReturnType<typeof useVideoTimeline>;
