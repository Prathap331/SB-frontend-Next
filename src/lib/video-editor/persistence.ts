import type { EditVideoResponse } from '@/services/api';
import type { TimelineState } from '@/lib/video-editor/types';
import { migrateScenesToTimeline, createSceneTimelinesMap, sanitizeTimelineTracks, type LegacySceneLike } from '@/lib/video-editor/migrate';

const CACHE_PREFIX = 'storio_ai_video_edit_v1:';
const LATEST_PREFIX = 'storio_ai_video_edit_latest_v1:';
const CACHE_VERSION = 3;
/** Keep generated projects for 7 days */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedVideoEditProject = {
  version: number;
  savedAt: string;
  userId: string;
  script: string;
  ideaTitle?: string | null;
  videoKind: 'faceless' | 'with-face';
  selectedVoice?: string;
  /** Raw /edit-video payload when available */
  response?: EditVideoResponse | null;
  scenes: unknown[];
  brollVideoSuggestions: Record<string, unknown[]>;
  brollImageSuggestions: Record<string, unknown[]>;
  timeline: TimelineState;
  /** Per-scene timelines for scene-by-scene editing */
  sceneTimelines?: Record<string, TimelineState>;
  selectedId: string;
  textStyle?: unknown;
  stage: 'editor' | 'scenes' | 'setup';
};

function simpleHash(input: string): string {
  let h = 0;
  const s = input.trim();
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `${Math.abs(h).toString(36)}_${s.length}`;
}

export function videoEditCacheKey(userId: string, script: string): string {
  return `${CACHE_PREFIX}${userId}:${simpleHash(script)}`;
}

function latestKey(userId: string): string {
  return `${LATEST_PREFIX}${userId}`;
}

export function saveVideoEditProject(project: Omit<CachedVideoEditProject, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const script = project.script?.trim();
  if (!project.userId || !script) return;

  const payload: CachedVideoEditProject = {
    ...project,
    script,
    version: CACHE_VERSION,
    savedAt: new Date().toISOString(),
  };

  try {
    const key = videoEditCacheKey(project.userId, script);
    localStorage.setItem(key, JSON.stringify(payload));
    localStorage.setItem(latestKey(project.userId), simpleHash(script));
  } catch {
    // Quota exceeded — drop older AI video caches for this user, then retry once.
    try {
      clearOldVideoEditCaches(project.userId, 1);
      const key = videoEditCacheKey(project.userId, script);
      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem(latestKey(project.userId), simpleHash(script));
    } catch {
      /* ignore */
    }
  }
}

export function loadVideoEditProject(
  userId: string | null | undefined,
  script: string | null | undefined,
): CachedVideoEditProject | null {
  if (typeof window === 'undefined' || !userId) return null;
  const trimmed = script?.trim() || '';
  try {
    let key: string | null = null;
    if (trimmed) {
      key = videoEditCacheKey(userId, trimmed);
    } else {
      const hash = localStorage.getItem(latestKey(userId));
      if (hash) key = `${CACHE_PREFIX}${userId}:${hash}`;
    }
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVideoEditProject;
    if (!parsed || parsed.userId !== userId) return null;
    if (!Array.isArray(parsed.scenes) || !parsed.timeline?.tracks) return null;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    if (trimmed && parsed.script.trim() !== trimmed) return null;

    // Rebuild per-scene timelines for older caches / missing maps.
    if (parsed.version !== CACHE_VERSION || !parsed.sceneTimelines) {
      parsed.sceneTimelines = createSceneTimelinesMap(parsed.scenes as LegacySceneLike[]);
      const sid = parsed.selectedId || (parsed.scenes[0] as { id?: string } | undefined)?.id;
      parsed.timeline = sid && parsed.sceneTimelines[sid]
        ? parsed.sceneTimelines[sid]
        : migrateScenesToTimeline(parsed.scenes as LegacySceneLike[]);
      parsed.version = CACHE_VERSION;
    } else {
      parsed.timeline = sanitizeTimelineTracks(parsed.timeline);
      for (const key of Object.keys(parsed.sceneTimelines)) {
        parsed.sceneTimelines[key] = sanitizeTimelineTracks(parsed.sceneTimelines[key]);
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearVideoEditProject(userId: string, script: string): void {
  if (typeof window === 'undefined' || !userId || !script.trim()) return;
  try {
    localStorage.removeItem(videoEditCacheKey(userId, script));
  } catch {
    /* ignore */
  }
}

/** Remove oldest caches for a user, keeping `keep` most recent. */
function clearOldVideoEditCaches(userId: string, keep: number): void {
  const prefix = `${CACHE_PREFIX}${userId}:`;
  const entries: { key: string; savedAt: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as CachedVideoEditProject;
      entries.push({ key, savedAt: new Date(parsed.savedAt).getTime() || 0 });
    } catch {
      entries.push({ key, savedAt: 0 });
    }
  }
  entries
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(keep)
    .forEach((e) => localStorage.removeItem(e.key));
}
