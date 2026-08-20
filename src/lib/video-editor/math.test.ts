/** @jest-environment node */
import {
  calculateClipMove,
  calculateTrimLeft,
  calculateTrimRight,
  clampClipToSource,
  duplicateClip,
  isValidClip,
  snapTime,
  splitClip,
  type SnapTarget,
} from './math';
import type { TimelineClip } from './types';

/* eslint-disable no-undef -- Jest globals */

const baseClip = (): TimelineClip => ({
  id: 'c1',
  trackId: 'track-video',
  type: 'video',
  name: 'clip',
  start: 0,
  duration: 10,
  sourceStart: 0,
  sourceDuration: 10,
  originalSourceDuration: 10,
});

describe('video-editor math', () => {
  test('calculateClipMove does not change sourceStart', () => {
    const clip = baseClip();
    const moved = calculateClipMove(clip, 2.5);
    expect(moved.start).toBe(2.5);
    expect(clip.sourceStart).toBe(0);
  });

  test('calculateClipMove clamps before 0', () => {
    expect(calculateClipMove(baseClip(), -5).start).toBe(0);
  });

  test('calculateTrimLeft advances sourceStart', () => {
    const result = calculateTrimLeft(baseClip(), 2);
    expect(result.start).toBe(2);
    expect(result.sourceStart).toBe(2);
    expect(result.duration).toBe(8);
    expect(result.sourceDuration).toBe(8);
  });

  test('calculateTrimRight does not change sourceStart', () => {
    const clip = baseClip();
    const result = calculateTrimRight(clip, -3);
    expect(result.duration).toBe(7);
    expect(result.sourceDuration).toBe(7);
    expect(clip.sourceStart).toBe(0);
  });

  test('calculateTrimRight respects original source duration', () => {
    const result = calculateTrimRight(baseClip(), 50);
    expect(result.duration).toBe(10);
  });

  test('splitClip preserves source timing', () => {
    const clip: TimelineClip = {
      ...baseClip(),
      start: 0,
      duration: 10,
      sourceStart: 5,
      sourceDuration: 10,
      originalSourceDuration: 20,
    };
    const parts = splitClip(clip, 4);
    expect(parts).not.toBeNull();
    expect(parts!.left.duration).toBe(4);
    expect(parts!.left.sourceStart).toBe(5);
    expect(parts!.right.start).toBe(4);
    expect(parts!.right.duration).toBe(6);
    expect(parts!.right.sourceStart).toBe(9);
  });

  test('splitClip rejects edges', () => {
    expect(splitClip(baseClip(), 0)).toBeNull();
    expect(splitClip(baseClip(), 10)).toBeNull();
  });

  test('duplicateClip offsets start', () => {
    const dup = duplicateClip(baseClip(), 'c2');
    expect(dup.id).toBe('c2');
    expect(dup.start).toBe(10);
    expect(dup.duration).toBe(10);
  });

  test('snapTime snaps within threshold', () => {
    const targets: SnapTarget[] = [{ time: 5, kind: 'clip-start' }];
    const pps = 80;
    const near = snapTime(5.05, targets, pps, 8, false);
    expect(near.time).toBe(5);
    expect(near.snappedTo?.kind).toBe('clip-start');
  });

  test('snapTime can be disabled', () => {
    const targets: SnapTarget[] = [{ time: 5, kind: 'playhead' }];
    const result = snapTime(5.05, targets, 80, 8, true);
    expect(result.snappedTo).toBeNull();
  });

  test('isValidClip / clampClipToSource', () => {
    const bad = { ...baseClip(), duration: -1, sourceStart: -2 };
    expect(isValidClip(bad)).toBe(false);
    const fixed = clampClipToSource(bad);
    expect(fixed.duration).toBeGreaterThan(0);
    expect(fixed.sourceStart).toBeGreaterThanOrEqual(0);
  });
});
