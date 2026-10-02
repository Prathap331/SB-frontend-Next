/**
 * Render state from GET /render/queue (`status`, `final_video_url`).
 */

export type RenderQueueStatus = 'pending' | 'completed' | 'failed';

const COMPLETED = ['completed', 'complete', 'done', 'success', 'succeeded', 'finished', 'ready'];
const FAILED = ['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled', 'timeout'];
const PENDING = ['pending', 'queued', 'queue', 'processing', 'in_progress', 'in-progress', 'running', 'started'];

export function normalizeRenderStatus(raw: unknown): RenderQueueStatus | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (COMPLETED.includes(value)) return 'completed';
  if (FAILED.includes(value)) return 'failed';
  if (PENDING.includes(value)) return 'pending';
  return null;
}

export function renderStatusLabel(status: RenderQueueStatus): string {
  switch (status) {
    case 'completed':
      return 'Render complete';
    case 'failed':
      return 'Render failed';
    default:
      return 'Rendering…';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function asId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Queue rows from `{ entries: [...] }` or a single record. */
export function renderQueueEntries(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  }
  const obj = asRecord(data);
  if (!obj) return [];
  for (const key of ['entries', 'items', 'results', 'data', 'queue']) {
    const list = obj[key];
    if (Array.isArray(list)) {
      return list.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
    }
  }
  if (obj.status != null || obj.final_video_url != null || obj.video_id != null || obj.id != null) {
    return [obj];
  }
  const nested = asRecord(obj.data);
  return nested ? renderQueueEntries(nested) : [];
}

export function renderQueueEntryMatches(row: Record<string, unknown>, id: string): boolean {
  return asId(row.id) === id || asId(row.video_id) === id || asId(row.queue_id) === id;
}

export function renderQueueHasId(data: unknown, id: string): boolean {
  return renderQueueEntries(data).some((row) => renderQueueEntryMatches(row, id));
}

function entryTime(row: Record<string, unknown>): number {
  return Date.parse(String(row.completed_at ?? row.updated_at ?? row.started_at ?? row.created_at ?? '')) || 0;
}

function newestFirst(entries: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...entries].sort((a, b) => entryTime(b) - entryTime(a));
}

function pickEntry(entries: Record<string, unknown>[], preferId?: string): Record<string, unknown> | null {
  if (!entries.length) return null;
  const scoped = preferId ? entries.filter((row) => renderQueueEntryMatches(row, preferId)) : [];
  if (scoped.length) return newestFirst(scoped)[0];
  const byTime = newestFirst(entries);
  return (
    byTime.find((row) => normalizeRenderStatus(row.status) === 'completed' && asHttpUrl(row.final_video_url)) ??
    byTime.find((row) => normalizeRenderStatus(row.status) === 'completed') ??
    byTime[0]
  );
}

export function parseRenderQueuePayload(
  data: unknown,
  preferId?: string,
): { status: RenderQueueStatus; videoUrl: string | null; queueId: string | null } {
  const entries = renderQueueEntries(data);
  const entry = pickEntry(entries, preferId);
  const videoUrl =
    asHttpUrl(entry?.final_video_url) ??
    asHttpUrl(entry?.finalVideoUrl) ??
    asHttpUrl(entry?.video_url) ??
    asHttpUrl(asRecord(data)?.final_video_url);
  const status =
    normalizeRenderStatus(entry?.status ?? asRecord(data)?.status) ?? (videoUrl ? 'completed' : 'pending');
  const queueId = asId(entry?.id) ?? asId(entry?.queue_id) ?? asId(asRecord(data)?.id);
  return { status, videoUrl, queueId };
}
