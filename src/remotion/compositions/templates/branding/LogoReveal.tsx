'use client';

import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayText } from '../../../props';
import { clockSpring, hash01, unitProgress } from '../../../animation';
import { LogoFallback, TemplateStage, clockProgress } from '../shared';

type LogoVariant =
  | 'blur'
  | 'bounce'
  | 'fade'
  | 'glitch'
  | 'scale'
  | 'spin'
  | 'split'
  | 'stroke'
  | 'typewriter';

function LogoBox({ data, color, extra }: { data: TemplateProps['data']; color: string; extra?: CSSProperties }) {
  return (
    <LogoFallback
      data={data}
      color={color}
      style={{
        width: 280,
        height: 280,
        borderRadius: 32,
        fontSize: 28,
        objectFit: 'contain',
        ...extra,
      }}
    />
  );
}

export function LogoReveal({ data, clock, variant }: TemplateProps & { variant: LogoVariant }) {
  const color = readColor(data.props, '#f5f5f7');
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: variant === 'bounce' ? 8 : 14, stiffness: variant === 'bounce' ? 160 : 120 });
  const t = clockProgress(clock);

  if (variant === 'typewriter') {
    const label = readDisplayText(data.props) || 'BRAND';
    const n = Math.floor(unitProgress(clock.frame, 0, clock.durationInFrames * 0.8) * label.length);
    return (
      <TemplateStage>
        <div style={{ color, fontSize: 56, fontWeight: 800, letterSpacing: '0.12em' }}>{label.slice(0, n)}</div>
      </TemplateStage>
    );
  }

  if (variant === 'glitch') {
    const x = (hash01(clock.frame) - 0.5) * 14;
    return (
      <TemplateStage>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: x, opacity: 0.5, filter: 'skewX(8deg)' }}>
            <LogoBox data={data} color="#22d3ee" />
          </div>
          <LogoBox data={data} color={color} />
        </div>
      </TemplateStage>
    );
  }

  if (variant === 'split') {
    const d = (1 - s) * 80;
    return (
      <TemplateStage>
        <div style={{ display: 'flex', overflow: 'hidden', width: 280, height: 280 }}>
          <div style={{ width: '50%', overflow: 'hidden', transform: `translateX(${-d}px)` }}>
            <LogoBox data={data} color={color} extra={{ width: 280, borderRadius: 0 }} />
          </div>
          <div style={{ width: '50%', overflow: 'hidden', transform: `translateX(${d}px)` }}>
            <LogoBox data={data} color={color} extra={{ width: 280, marginLeft: -140, borderRadius: 0 }} />
          </div>
        </div>
      </TemplateStage>
    );
  }

  const transform =
    variant === 'bounce'
      ? `translateY(${(1 - s) * -120}px) scale(${0.7 + 0.3 * s})`
      : variant === 'spin'
        ? `rotate(${(1 - s) * 180}deg) scale(${s})`
        : variant === 'scale'
          ? `scale(${s}) rotate(${(1 - s) * -12}deg)`
          : variant === 'fade'
            ? 'none'
            : variant === 'blur'
              ? `scale(${0.92 + 0.08 * s})`
              : variant === 'stroke'
                ? `scale(${0.9 + 0.1 * t})`
                : 'none';

  return (
    <TemplateStage>
      <div
        style={{
          transform,
          opacity: variant === 'fade' || variant === 'blur' ? s : 1,
          filter: variant === 'blur' ? `blur(${(1 - s) * 18}px)` : undefined,
          clipPath: variant === 'stroke' ? `inset(${(1 - t) * 50}% 0)` : undefined,
        }}
      >
        <LogoBox data={data} color={color} />
      </div>
    </TemplateStage>
  );
}

export function LogoBlurReveal(p: TemplateProps) {
  return <LogoReveal {...p} variant="blur" />;
}
export function LogoBounceDrop(p: TemplateProps) {
  return <LogoReveal {...p} variant="bounce" />;
}
export function LogoFadeReveal(p: TemplateProps) {
  return <LogoReveal {...p} variant="fade" />;
}
export function LogoGlitchReveal(p: TemplateProps) {
  return <LogoReveal {...p} variant="glitch" />;
}
export function LogoScaleRotate(p: TemplateProps) {
  return <LogoReveal {...p} variant="scale" />;
}
export function LogoSpinReveal(p: TemplateProps) {
  return <LogoReveal {...p} variant="spin" />;
}
export function LogoSplitReveal(p: TemplateProps) {
  return <LogoReveal {...p} variant="split" />;
}
export function LogoStrokeDraw(p: TemplateProps) {
  return <LogoReveal {...p} variant="stroke" />;
}
export function LogoTypewriter(p: TemplateProps) {
  return <LogoReveal {...p} variant="typewriter" />;
}
