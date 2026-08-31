import type { BrollMediaItem } from '@/services/api';

export type BrollPickKind = 'video' | 'image';

export type BrollPickSession = {
  kind: BrollPickKind;
  sceneId: string | null;
  sceneTitle: string | null;
};

export type PickedBrollItem = {
  id: string;
  kind: BrollPickKind;
  sceneId: string | null;
  label: string;
  meta: string;
  previewUrl: string | null;
  assetUrl: string | null;
  durationSeconds: number;
  /** Real Pexels photo/video id — sent as `asset_id` on POST .../broll/insert. */
  assetId?: number;
};

const SESSION_KEY = 'storio_broll_pick_session_v1';
const QUEUE_KEY = 'storio_broll_pick_queue_v1';

type Listener = (item: PickedBrollItem) => void;

let liveListener: Listener | null = null;
/** In-memory queue survives React Strict Mode remounts (sessionStorage alone is cleared on consume). */
let memoryQueue: PickedBrollItem[] = [];

function pickKey(item: PickedBrollItem): string {
  return item.id || `${item.kind}|${item.assetUrl || ''}|${item.label}`;
}

function readSessionQueue(): PickedBrollItem[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PickedBrollItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeSessionQueue(list: PickedBrollItem[]) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function hydrateMemoryFromSession() {
  if (memoryQueue.length > 0) return;
  memoryQueue = readSessionQueue();
}

export function setBrollPickListener(listener: Listener | null) {
  liveListener = listener;
}

export function startBrollPickSession(session: BrollPickSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearBrollPickSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function readBrollPickSession(): BrollPickSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrollPickSession;
    if (parsed?.kind !== 'video' && parsed?.kind !== 'image') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function enqueuePickedBroll(item: PickedBrollItem) {
  hydrateMemoryFromSession();
  const key = pickKey(item);
  if (!memoryQueue.some((x) => pickKey(x) === key)) {
    memoryQueue = [...memoryQueue, item];
    writeSessionQueue(memoryQueue);
  }
  liveListener?.(item);
}

/** Read all picked items without clearing (safe across Strict Mode remounts). */
export function listPickedBroll(): PickedBrollItem[] {
  hydrateMemoryFromSession();
  return [...memoryQueue];
}

/** @deprecated Prefer listPickedBroll — clearing breaks Strict Mode remounts. */
export function consumePickedBrollQueue(): PickedBrollItem[] {
  return listPickedBroll();
}

/** Map a Pexels/B-roll library item into a pick payload. */
export function brollMediaToPick(
  item: BrollMediaItem,
  session: BrollPickSession,
  previewLink: string | null,
): PickedBrollItem {
  const kind: BrollPickKind = item.kind === 'photo' ? 'image' : 'video';
  const label =
    (item.alt && item.alt.trim()) ||
    `${kind === 'video' ? 'Video' : 'Image'} by ${item.user?.name || 'creator'}`;
  const dur = item.duration && item.duration > 0 ? item.duration : 5;
  const assetUrl =
    kind === 'video'
      ? previewLink || item.downloadUrl || item.thumbnail || null
      : item.downloadUrl || item.thumbnail || null;

  return {
    id: `broll-pick-${item.key || `${kind}-${label}`}-${Date.now()}`,
    kind,
    sceneId: session.sceneId,
    label,
    meta:
      kind === 'video'
        ? `${item.width}×${item.height} · ${dur}s`
        : `${item.width}×${item.height} · still`,
    previewUrl: item.thumbnail || null,
    assetUrl,
    durationSeconds: dur,
    assetId: Number.isFinite(item.id) ? item.id : undefined,
  };
}
