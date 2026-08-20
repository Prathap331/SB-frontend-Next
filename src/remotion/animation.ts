import { interpolate, spring } from 'remotion';

export type FadeWindow = {
  fadeInEnd: number;
  fadeOutStart: number;
  opacity: number;
};

/** Shared fade in / hold / fade out driven by Remotion frame. */
export function useFadeWindow(
  frame: number,
  durationInFrames: number,
  fps: number,
  fadeInSeconds = 0.45,
): FadeWindow {
  const fadeInEnd = Math.min(24, Math.max(8, Math.floor(fps * fadeInSeconds)));
  const fadeOutStart = Math.max(fadeInEnd + 1, durationInFrames - fadeInEnd);
  const opacity = interpolate(
    frame,
    [0, fadeInEnd, fadeOutStart, Math.max(fadeOutStart, durationInFrames - 1)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return { fadeInEnd, fadeOutStart, opacity };
}

export function slideY(frame: number, fadeInEnd: number, from = 24): number {
  return interpolate(frame, [0, fadeInEnd], [from, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

export function itemRevealOpacity(
  frame: number,
  index: number,
  fadeInEnd: number,
  fadeOutStart: number,
  durationInFrames: number,
  stagger = 6,
): number {
  const start = Math.floor(fadeInEnd * 0.35) + index * stagger;
  return interpolate(
    frame,
    [start, start + 8, fadeOutStart, Math.max(fadeOutStart, durationInFrames - 1)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
}

export function springScale(frame: number, fps: number, delay = 0): number {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
}
