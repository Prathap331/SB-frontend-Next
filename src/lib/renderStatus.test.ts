/* eslint-disable no-undef -- Jest globals */
import { normalizeRenderStatus, renderStatusLabel } from './renderStatus';

describe('videos.render_status', () => {
  it('reads the spellings a backend may store for a finished render', () => {
    for (const raw of ['completed', 'COMPLETE', ' done ', 'success', 'finished', 'ready']) {
      expect(normalizeRenderStatus(raw)).toBe('completed');
    }
  });

  it('reads in-progress and failed states', () => {
    for (const raw of ['pending', 'queued', 'processing', 'in_progress', 'running']) {
      expect(normalizeRenderStatus(raw)).toBe('pending');
    }
    for (const raw of ['failed', 'error', 'cancelled', 'timeout']) {
      expect(normalizeRenderStatus(raw)).toBe('failed');
    }
  });

  it('returns null when there is nothing usable to show', () => {
    expect(normalizeRenderStatus(null)).toBeNull();
    expect(normalizeRenderStatus('')).toBeNull();
    expect(normalizeRenderStatus('   ')).toBeNull();
    expect(normalizeRenderStatus('something-new')).toBeNull();
  });

  it('labels each state for the chip', () => {
    expect(renderStatusLabel('pending')).toBe('Rendering…');
    expect(renderStatusLabel('completed')).toBe('Render complete');
    expect(renderStatusLabel('failed')).toBe('Render failed');
  });
});
