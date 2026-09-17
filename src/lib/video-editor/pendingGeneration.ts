/**
 * Marks that a POST /edit-video is in flight.
 *
 * The request is abandoned the moment the user navigates away, but the backend keeps
 * working. Without a record of it, coming back looks identical to never having started
 * — so the marker is kept in localStorage and cleared once the run finishes (or when the
 * finished project shows up in the `videos` table on a later visit).
 */

export type PendingGeneration = {
  userId: string;
  /** scripts_assigned row id, when the run started from an unlocked script. */
  scriptRowId: string | null;
  /** First part of the script — identifies which script is generating. */
  scriptHint: string;
  /** Epoch ms the request started. */
  startedAt: number;
};

const KEY = 'storio:edit-video-pending';
/** A run older than this is treated as dead rather than leaving a spinner forever. */
export const PENDING_GENERATION_MAX_AGE_MS = 30 * 60 * 1000;

function storage(): typeof window.localStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The in-flight run, or null when there is none / it is stale / storage is unavailable. */
export function readPendingGeneration(): PendingGeneration | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGeneration>;
    const userId = typeof parsed.userId === 'string' ? parsed.userId : '';
    const startedAt = Number(parsed.startedAt);
    if (!userId || !Number.isFinite(startedAt)) return null;
    if (Date.now() - startedAt > PENDING_GENERATION_MAX_AGE_MS) {
      store.removeItem(KEY);
      return null;
    }
    return {
      userId,
      scriptRowId: typeof parsed.scriptRowId === 'string' ? parsed.scriptRowId : null,
      scriptHint: typeof parsed.scriptHint === 'string' ? parsed.scriptHint : '',
      startedAt,
    };
  } catch {
    return null;
  }
}

export function writePendingGeneration(
  input: Omit<PendingGeneration, 'startedAt'>,
): PendingGeneration | null {
  const store = storage();
  const entry: PendingGeneration = { ...input, startedAt: Date.now() };
  if (!store) return entry;
  try {
    store.setItem(KEY, JSON.stringify(entry));
  } catch {
    /* quota / private mode — the in-memory state still covers this session */
  }
  return entry;
}

export function clearPendingGeneration(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Whether a stored run belongs to the user (and script) currently open. */
export function pendingGenerationMatches(
  pending: PendingGeneration | null,
  userId: string | null,
  scriptRowId: string | number | null,
): boolean {
  if (!pending || !userId || pending.userId !== userId) return false;
  const current = scriptRowId == null ? null : String(scriptRowId);
  // A run started without a script row (freeform) is shown to that same user regardless.
  if (!pending.scriptRowId || !current) return true;
  return pending.scriptRowId === current;
}

/** Whole minutes since the run started, for "generating for N min" copy. */
export function pendingGenerationMinutes(pending: PendingGeneration): number {
  return Math.max(0, Math.floor((Date.now() - pending.startedAt) / 60000));
}
