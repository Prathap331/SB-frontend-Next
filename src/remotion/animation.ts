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

export type TextEntrance = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  clipPath?: string;
};

/** Design-space slide distance (1920×1080), matching the preview's 40px at 1× scale. */
const SLIDE_PX = 64;

/**
 * Frame-accurate version of the `txtAnim-*` CSS keyframes the timeline text overlay uses,
 * keyed by the backend's `text_animation_style`. Driving both from the same definition is
 * what keeps the library preview and the video preview showing the same animation.
 * Returns null when the style is absent or unrecognized (layout keeps its own motion).
 */
export function textEntrance(
  style: string | undefined,
  frame: number,
  fps: number,
): TextEntrance | null {
  const key = (style ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return null;

  const frames = (seconds: number) => Math.max(1, Math.round(fps * seconds));
  const ramp = (seconds: number) =>
    interpolate(frame, [0, frames(seconds)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const stops = (seconds: number, points: number[], values: number[]) =>
    interpolate(
      frame,
      points.map((p) => p * frames(seconds)),
      values,
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
  const base: TextEntrance = { opacity: 1, translateX: 0, translateY: 0, scale: 1 };

  switch (key) {
    case 'fade_in':
      return { ...base, opacity: ramp(0.5) };
    case 'slide_in_left': {
      const t = ramp(0.5);
      return { ...base, opacity: t, translateX: -SLIDE_PX * (1 - t) };
    }
    case 'slide_in_right': {
      const t = ramp(0.5);
      return { ...base, opacity: t, translateX: SLIDE_PX * (1 - t) };
    }
    case 'slide_up': {
      const t = ramp(0.5);
      return { ...base, opacity: t, translateY: SLIDE_PX * (1 - t) };
    }
    case 'slide_down': {
      const t = ramp(0.5);
      return { ...base, opacity: t, translateY: -SLIDE_PX * (1 - t) };
    }
    case 'zoom_in': {
      const t = ramp(0.45);
      return { ...base, opacity: t, scale: 0.55 + 0.45 * t };
    }
    case 'bounce':
      return {
        ...base,
        opacity: ramp(0.3),
        scale: stops(0.6, [0, 0.5, 0.7, 1], [0.3, 1.12, 0.94, 1]),
      };
    case 'pop':
      return {
        ...base,
        opacity: ramp(0.21),
        scale: stops(0.3, [0, 0.7, 1], [0.5, 1.1, 1]),
      };
    case 'typewriter': {
      // Stepped reveal, same 14 steps as the CSS `steps(14, end)` timing function.
      const steps = 14;
      const progress = ramp(0.9);
      const stepped = Math.min(1, Math.ceil(progress * steps) / steps);
      return { ...base, clipPath: `inset(0 ${100 - stepped * 100}% 0 0)` };
    }
    case 'wipe':
      return { ...base, clipPath: `inset(0 ${100 - ramp(0.7) * 100}% 0 0)` };
    default:
      return null;
  }
}

export function springScale(frame: number, fps: number, delay = 0): number {
  return spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
}
