'use client';

import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { Img, interpolate } from 'remotion';
import type { ChartDatum, Clock, InfographicData } from '../../types';
import { LucideIconView } from '../../icons';
import {
  readDisplayLines,
  readDisplayText,
  readIconNames,
  readImageUrl,
  readNonEmptyString,
} from '../../props';
import { clamp01, easeOutCubic } from '../../animation';

export const CHART_PALETTE = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
] as const;

export function paletteColor(index: number, accent?: string): string {
  if (index === 0 && accent) return accent;
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function clockProgress(clock: Clock, startFrame = 0, endFrame?: number): number {
  const end = endFrame ?? Math.max(startFrame + 1, clock.durationInFrames - 1);
  return clamp01(interpolate(clock.frame, [startFrame, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }));
}

export function staggeredProgress(clock: Clock, index: number, stagger = 5, window = 18): number {
  return clockProgress(clock, index * stagger, index * stagger + window);
}

export function TemplateStage({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardShell({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: 'min(1100px, 86%)',
        background: 'linear-gradient(180deg, rgba(18,22,30,0.92) 0%, rgba(10,12,16,0.92) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 28,
        padding: 36,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function TitleBlock({
  data,
  color,
  align = 'left',
}: {
  data: InfographicData;
  color: string;
  align?: 'left' | 'center';
}) {
  const title =
    readNonEmptyString(data.props, 'title') ??
    (readDisplayLines(data.props).length > 1 ? readDisplayLines(data.props)[0] : undefined);
  const subtitle = readNonEmptyString(data.props, 'subtitle') ?? readNonEmptyString(data.props, 'caption');
  if (!title && !subtitle) return null;
  return (
    <div style={{ marginBottom: 22, textAlign: align }}>
      {title ? (
        <div style={{ color, fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {title}
        </div>
      ) : null}
      {subtitle ? (
        <div style={{ marginTop: 8, color: 'rgba(245,245,247,0.68)', fontSize: 18 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

export function SafeImage({
  src,
  style,
  alt,
}: {
  src?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  if (!src) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #1f2937 0%, #0b1220 100%)',
          ...style,
        }}
      />
    );
  }
  return <Img src={src} style={style} alt={alt ?? ''} />;
}

export function LogoFallback({
  data,
  color,
  style,
}: {
  data: InfographicData;
  color: string;
  style?: CSSProperties;
}) {
  const src = readImageUrl(data.props);
  if (src) {
    return <SafeImage src={src} alt={readDisplayText(data.props) || 'logo'} style={style} />;
  }
  const label =
    readNonEmptyString(data.props, 'title') ??
    readDisplayText(data.props) ??
    readIconNames(data.props)[0] ??
    'Logo';
  const icon = readIconNames(data.props)[0];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'rgba(255,255,255,0.04)',
        border: `2px solid ${color}`,
        color,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {icon ? <LucideIconView name={icon} size={36} color={color} /> : null}
      <span>{label}</span>
    </div>
  );
}

export function chartValues(data: ChartDatum[]): ChartDatum[] {
  return data.filter((d) => Number.isFinite(d.value));
}

export function maxAbs(data: ChartDatum[]): number {
  return data.reduce((m, d) => Math.max(m, Math.abs(d.value)), 0) || 1;
}

export function formatChartValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export class TemplateErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* One overlay must not take down the Remotion Player. */
  }

  render() {
    if (this.state.failed) {
      return <div style={{ position: 'absolute', inset: 0 }} />;
    }
    return this.props.children;
  }
}

export function appearOpacity(clock: Clock): number {
  return easeOutCubic(clockProgress(clock, 0, Math.max(8, Math.round(clock.fps * 0.35))));
}
