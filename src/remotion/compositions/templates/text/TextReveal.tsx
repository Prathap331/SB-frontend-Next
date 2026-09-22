'use client';

import type { CSSProperties } from 'react';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayText, readNonEmptyString } from '../../../props';
import { clockSpring, hash01, unitProgress } from '../../../animation';
import { TemplateStage, appearOpacity } from '../shared';

export type TextVariant =
  | 'animated'
  | 'bounce'
  | 'bubble'
  | 'chip'
  | 'glitch'
  | 'pop'
  | 'pulse'
  | 'slide'
  | 'typewriter';

function directionOf(props: Record<string, unknown>): 'left' | 'right' | 'up' | 'down' {
  const raw = (readNonEmptyString(props, 'direction') ?? '').toLowerCase();
  if (raw === 'right' || raw === 'up' || raw === 'down') return raw;
  return 'left';
}

export function TextReveal({ data, clock, variant }: TemplateProps & { variant: TextVariant }) {
  const color = readColor(data.props, '#f5f5f7');
  const text = readDisplayText(data.props) || readNonEmptyString(data.props, 'subtitle') || '';
  const chars = Array.from(text);
  const words = text.split(/\s+/).filter(Boolean);
  const opacity = appearOpacity(clock);

  if (variant === 'typewriter') {
    const n = Math.max(0, Math.floor(unitProgress(clock.frame, 0, Math.max(8, clock.durationInFrames * 0.8)) * chars.length));
    return (
      <TemplateStage style={{ opacity }}>
        <div style={{ color, fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em', maxWidth: '80%' }}>
          {chars.slice(0, n).join('')}
          <span style={{ opacity: clock.frame % 16 < 8 ? 1 : 0.15 }}>|</span>
        </div>
      </TemplateStage>
    );
  }

  if (variant === 'chip') {
    const float = Math.sin(clock.frame / 12) * 8;
    const s = clockSpring(clock.frame, clock.fps, 0, { damping: 12, stiffness: 140 });
    return (
      <TemplateStage>
        <div
          style={{
            transform: `translateY(${float}px) scale(${0.85 + 0.15 * s})`,
            opacity: s,
            background: 'rgba(12,16,22,0.82)',
            border: `1px solid ${color}66`,
            color,
            padding: '16px 28px',
            borderRadius: 999,
            fontSize: 28,
            fontWeight: 700,
            boxShadow: `0 16px 40px ${color}33`,
          }}
        >
          {text}
        </div>
      </TemplateStage>
    );
  }

  if (variant === 'glitch') {
    const jx = (hash01(clock.frame * 0.37) - 0.5) * 10;
    const jy = (hash01(clock.frame * 0.91) - 0.5) * 6;
    const style: CSSProperties = { fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em', position: 'relative' };
    return (
      <TemplateStage style={{ opacity }}>
        <div style={style}>
          <span style={{ position: 'absolute', left: jx, top: jy, color: '#22d3ee', opacity: 0.7, clipPath: 'inset(0 0 55% 0)' }}>
            {text}
          </span>
          <span style={{ position: 'absolute', left: -jx, top: -jy, color: '#f43f5e', opacity: 0.7, clipPath: 'inset(45% 0 0 0)' }}>
            {text}
          </span>
          <span style={{ color }}>{text}</span>
        </div>
      </TemplateStage>
    );
  }

  if (variant === 'pulse') {
    const pulse = 1 + Math.sin(clock.frame / 10) * 0.045;
    const glow = 0.7 + Math.sin(clock.frame / 10) * 0.3;
    return (
      <TemplateStage style={{ opacity }}>
        <div style={{ color, fontSize: 64, fontWeight: 800, transform: `scale(${pulse})`, opacity: glow }}>{text}</div>
      </TemplateStage>
    );
  }

  if (variant === 'slide') {
    const dir = directionOf(data.props);
    const t = clockSpring(clock.frame, clock.fps);
    const dist = 80 * (1 - t);
    const x = dir === 'left' ? -dist : dir === 'right' ? dist : 0;
    const y = dir === 'up' ? dist : dir === 'down' ? -dist : 0;
    return (
      <TemplateStage>
        <div style={{ color, fontSize: 56, fontWeight: 800, opacity: t, transform: `translate(${x}px, ${y}px)` }}>{text}</div>
      </TemplateStage>
    );
  }

  const units = variant === 'bubble' ? words : chars.length ? chars : [text];
  return (
    <TemplateStage style={{ opacity }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: variant === 'bubble' ? 12 : 0, maxWidth: '86%' }}>
        {units.map((unit, i) => {
          const delay = i * (variant === 'bubble' ? 4 : 2);
          const s = clockSpring(clock.frame, clock.fps, delay, {
            damping: variant === 'bounce' || variant === 'pop' || variant === 'bubble' ? 8 : 14,
            stiffness: variant === 'pop' ? 180 : 120,
          });
          const from = variant === 'pop' ? 0.5 : variant === 'bubble' ? 0 : 0.2;
          const scale = from + (1 - from) * s + (variant === 'pop' || variant === 'bounce' ? Math.max(0, s - 1) * 0.08 : 0);
          const y = variant === 'bounce' ? (1 - s) * 28 : 0;
          return (
            <span
              key={`${unit}-${i}`}
              style={{
                display: 'inline-block',
                color,
                fontSize: variant === 'bubble' ? 36 : 56,
                fontWeight: 800,
                opacity: s,
                transform: `translateY(${y}px) scale(${Math.max(0, scale)})`,
                background: variant === 'bubble' ? `${color}22` : undefined,
                padding: variant === 'bubble' ? '8px 14px' : undefined,
                borderRadius: variant === 'bubble' ? 16 : undefined,
                whiteSpace: 'pre',
              }}
            >
              {unit === ' ' ? '\u00a0' : unit}
            </span>
          );
        })}
      </div>
    </TemplateStage>
  );
}

export function AnimatedText(props: TemplateProps) {
  return <TextReveal {...props} variant="animated" />;
}
export function BounceText(props: TemplateProps) {
  return <TextReveal {...props} variant="bounce" />;
}
export function BubblePopText(props: TemplateProps) {
  return <TextReveal {...props} variant="bubble" />;
}
export function FloatingTextChip(props: TemplateProps) {
  return <TextReveal {...props} variant="chip" />;
}
export function GlitchText(props: TemplateProps) {
  return <TextReveal {...props} variant="glitch" />;
}
export function PoppingScaleText(props: TemplateProps) {
  return <TextReveal {...props} variant="pop" />;
}
export function PulsingText(props: TemplateProps) {
  return <TextReveal {...props} variant="pulse" />;
}
export function SlideText(props: TemplateProps) {
  return <TextReveal {...props} variant="slide" />;
}
export function TypewriterSubtitle(props: TemplateProps) {
  return <TextReveal {...props} variant="typewriter" />;
}
