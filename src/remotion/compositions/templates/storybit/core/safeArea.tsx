'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useAutoFit } from './autofit';

/**
 * Storybit frame rules — every template follows these.
 * Canvas 1920×1080 @ 30fps, 100px margin on all four sides.
 * All text and foreground content must stay inside the 1720×880 safe box.
 * Only full-bleed backgrounds (images, video, colour, texture) may cross the margin.
 */
export const FRAME_W = 1920;
export const FRAME_H = 1080;
export const FRAME_FPS = 30;
export const SAFE_MARGIN = 100;
export const SAFE_W = FRAME_W - SAFE_MARGIN * 2; // 1720
export const SAFE_H = FRAME_H - SAFE_MARGIN * 2; // 880

export function SafeArea({
  children,
  debug = false,
  style,
}: {
  children?: ReactNode;
  /** Draws the margin guide. Preview only — never enable in renders. */
  debug?: boolean;
  style?: CSSProperties;
}) {
  // auto-fit (core/autofit.tsx): one translate + scale for everything inside, so small content fills the box
  const fit = useAutoFit();
  const grown = fit && fit.s !== 1;
  return (
    <div
      data-sb-safe=""
      style={{
        position: 'absolute',
        left: SAFE_MARGIN,
        top: SAFE_MARGIN,
        width: SAFE_W,
        height: SAFE_H,
        outline: debug ? '2px dashed rgba(255, 64, 129, 0.9)' : undefined,
        ...style,
      }}
    >
      {grown ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: SAFE_W, height: SAFE_H, transform: `translate(${fit.dx}px, ${fit.dy}px) scale(${fit.s})`, transformOrigin: '0 0' }}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
