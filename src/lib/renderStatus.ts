/**
 * One vocabulary for render state, shared by the /render/queue endpoint and the
 * `videos.render_status` column, so a render reads the same whether the status came
 * from a live poll or from the row loaded when the editor opens.
 */

export type RenderQueueStatus = 'pending' | 'completed' | 'failed';

const COMPLETED = ['completed', 'complete', 'done', 'success', 'succeeded', 'finished', 'ready'];
const FAILED = ['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled', 'timeout'];
const PENDING = ['pending', 'queued', 'queue', 'processing', 'in_progress', 'in-progress', 'running', 'started'];

/**
 * Map a backend status string onto the three states.
 * Returns null for an empty/unrecognized value so callers can decide what to assume.
 */
export function normalizeRenderStatus(raw: unknown): RenderQueueStatus | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (COMPLETED.includes(value)) return 'completed';
  if (FAILED.includes(value)) return 'failed';
  if (PENDING.includes(value)) return 'pending';
  return null;
}

/** Short label for the status chip in the editor toolbar. */
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
