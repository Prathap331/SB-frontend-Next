'use client';

import {
  Img as RemotionImg,
  continueRender,
  delayRender,
  getRemotionEnvironment,
} from 'remotion';
import type { CSSProperties, ReactEventHandler } from 'react';

/** True when this tree is inside a Remotion Player / render, not a plain React preview. */
export function inRemotionComposition(): boolean {
  try {
    const env = getRemotionEnvironment();
    return Boolean(env.isPlayer || env.isRendering);
  } catch {
    return false;
  }
}

export function delayRenderSafe(label?: string): number | null {
  if (!inRemotionComposition()) return null;
  try {
    return delayRender(label);
  } catch {
    return null;
  }
}

export function continueRenderSafe(handle: number | null | undefined): void {
  if (handle == null) return;
  try {
    continueRender(handle);
  } catch {
    /* preview outside Player — nothing to resume */
  }
}

type ImgProps = {
  src: string;
  style?: CSSProperties;
  className?: string;
  width?: string | number;
  height?: string | number;
  onError?: ReactEventHandler<HTMLImageElement>;
};

/**
 * Remotion `<Img>` waits with delayRender and throws outside a composition.
 * Timeline overlay preview is plain React, so use a normal img there.
 */
export function Img({ src, style, className, width, height, onError }: ImgProps) {
  if (inRemotionComposition()) {
    return (
      <RemotionImg src={src} style={style} className={className} onError={onError} />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element — Storybit preview outside Remotion Player
    <img alt="" src={src} style={style} className={className} width={width} height={height} onError={onError} />
  );
}
