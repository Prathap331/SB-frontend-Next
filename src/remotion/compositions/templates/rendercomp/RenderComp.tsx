'use client';

import type { ReactNode } from 'react';
import { interpolate } from 'remotion';
import type { TemplateProps } from '../../../types';
import {
  readChartData,
  readColor,
  readDisplayLines,
  readDisplayText,
  readItemList,
  readNonEmptyString,
  readNumber,
  readNumberProp,
  readObjectArray,
  readStringArray,
} from '../../../props';
import { clockSpring, hash01 } from '../../../animation';
import { LogoFallback, TemplateStage, chartValues, clockProgress, formatChartValue, maxAbs, paletteColor } from '../shared';

const FONT = '-apple-system, "Segoe UI", Roboto, sans-serif';

function str(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = readNonEmptyString(props, key);
    if (v) return v;
  }
  return undefined;
}

function bgOf(props: Record<string, unknown>, fallback?: string): string | undefined {
  return (
    str(props, [
      'background',
      'backgroundColor',
      'background_color',
      'backgroundColorHint',
      'background_color_hint',
      'toneBg',
    ]) ?? fallback
  );
}

function Fill({ color, children }: { color?: string; children?: ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: color, overflow: 'hidden', fontFamily: FONT }}>
      {children}
    </div>
  );
}

/** Distinct from `bar_chart` — dark board, rising title, colored bars. */
export function BarChartAnim({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title');
  const sub = readNonEmptyString(data.props, 'subtitle');
  const rows = chartValues(readChartData(data.props)).slice(0, 8);
  const peak = maxAbs(rows) || 1;
  const titleOp = interpolate(clock.frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY = interpolate(clock.frame, [0, 14], [-20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Fill color={bgOf(data.props, '#0f172a')}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 80px' }}>
        {title ? <div style={{ color: '#fff', fontSize: 36, fontWeight: 800, opacity: titleOp, transform: `translateY(${titleY}px)` }}>{title}</div> : null}
        {sub ? <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18, marginTop: 8, opacity: titleOp }}>{sub}</div> : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 360, marginTop: 32 }}>
          {rows.map((row, i) => {
            const t = interpolate(clock.frame, [10 + i * 4, 28 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const h = (Math.abs(row.value) / peak) * 300 * t;
            return (
              <div key={`${row.label}-${i}`} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: h, borderRadius: 8, background: row.color || paletteColor(i, '#60a5fa') }} />
                <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.75)', fontSize: 16 }}>{row.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Fill>
  );
}

export function BounceInHeadline({ data, clock }: TemplateProps) {
  const headline = str(data.props, ['headline', 'title']) ?? readDisplayText(data.props);
  const color = readColor(data.props, '#fbbf24');
  const bounces = Math.max(1, readNumberProp(data.props, ['bounces']) ?? 3);
  const height = readNumberProp(data.props, ['height', 'bounceHeight']) ?? 120;
  const delay = readNumberProp(data.props, ['delay']) ?? 8;
  const duration = readNumberProp(data.props, ['duration']) ?? 36;
  const progress = interpolate(clock.frame, [delay, delay + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bounceY = progress >= 1 ? 0 : Math.abs(Math.sin(progress * Math.PI * bounces)) * height * (1 - progress);
  return (
    <Fill color={bgOf(data.props, '#111827')}>
      <TemplateStage>
        <div style={{ color, fontSize: 96, fontWeight: 800, opacity: Math.min(1, progress * 8), transform: `translateY(${-bounceY}px)` }}>{headline}</div>
      </TemplateStage>
    </Fill>
  );
}

export function BrushStrokeReveal({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const description = readNonEmptyString(data.props, 'description') ?? readNonEmptyString(data.props, 'subtitle');
  const strokes = Math.max(1, Math.round(readNumberProp(data.props, ['strokes']) ?? 3));
  const color = readColor(data.props, '#1a1a1a');
  const accent = readColor(data.props, '#a93226');
  return (
    <Fill color={bgOf(data.props, '#fffdf6')}>
      <TemplateStage>
        <div style={{ position: 'relative' }}>
          {Array.from({ length: strokes }, (_, i) => {
            const t = interpolate(clock.frame, [i * 3, 12 + i * 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const top = (i / strokes) * 100;
            return (
              <div key={i} style={{ position: i === 0 ? 'relative' : 'absolute', inset: i === 0 ? undefined : 0, clipPath: `inset(${top}% 0 ${100 - top - 100 / strokes}% 0)`, transform: `scaleX(${t})`, transformOrigin: 'left center' }}>
                <div style={{ color, fontSize: 88, fontWeight: 800 }}>{title}</div>
              </div>
            );
          })}
          <div style={{ width: 14, height: 14, borderRadius: 99, background: accent, marginTop: 16, opacity: interpolate(clock.frame, [18, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }} />
          {description ? <div style={{ marginTop: 12, color: '#444', fontSize: 22, opacity: interpolate(clock.frame, [22, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{description}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function CardFlipTransition({ data, clock }: TemplateProps) {
  const lines = readDisplayLines(data.props);
  const items = readItemList(data.props);
  const before = str(data.props, ['labelBefore', 'label_before']) ?? lines[0] ?? items[0];
  const after = str(data.props, ['labelAfter', 'label_after']) ?? lines[1] ?? items[1];
  const colorBefore = str(data.props, ['colorBefore', 'color_before']) ?? '#22223b';
  const colorAfter = str(data.props, ['colorAfter', 'color_after']) ?? '#9a8c98';
  const textColor = str(data.props, ['textColor', 'text_color']) ?? '#fff';
  const rot = interpolate(clock.frame, [8, 48], [0, 180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Fill color={bgOf(data.props, '#14141f')}>
      <div style={{ position: 'absolute', inset: 0, perspective: 1400 }}>
        <div style={{ position: 'absolute', inset: 0, transform: `rotateY(${rot}deg)`, transformStyle: 'preserve-3d' }}>
          <div style={{ position: 'absolute', inset: 0, background: colorBefore, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', color: textColor, fontSize: 96, fontWeight: 800 }}>
            {before}
          </div>
          <div style={{ position: 'absolute', inset: 0, background: colorAfter, display: 'flex', alignItems: 'center', justifyContent: 'center', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', color: textColor, fontSize: 96, fontWeight: 800 }}>
            {after}
          </div>
        </div>
      </div>
    </Fill>
  );
}

export function CharacterJumping({ data, clock }: TemplateProps) {
  const label = readNonEmptyString(data.props, 'label') ?? readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const color = readColor(data.props, '#0ea5e9');
  const period = Math.max(12, Math.round(clock.fps * 0.9));
  const t = ((clock.frame - 8) % period) / (period * 0.85);
  const u = Math.max(0, Math.min(1, t));
  const jump = Math.max(0, -4 * u * u + 4 * u);
  return (
    <Fill color={bgOf(data.props, '#e0f2fe')}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '62%', height: 8, background: '#bae6fd' }} />
      <div style={{ position: 'absolute', left: '50%', top: `${62 - jump * 22}%`, width: 90, height: 90, marginLeft: -45, marginTop: -90, borderRadius: '50% 50% 40% 40%', background: color, transform: `scaleY(${1 - jump * 0.18})` }} />
      {label ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: '18%', textAlign: 'center', color: '#0c4a6e', fontSize: 36, fontWeight: 800 }}>{label}</div> : null}
    </Fill>
  );
}

export function CommunityChat({ data, clock }: TemplateProps) {
  const workspace = str(data.props, ['workspaceName', 'workspace_name', 'title']);
  const channel = str(data.props, ['channelName', 'channel_name']) ?? 'general';
  const messageRows = readObjectArray(data.props, 'messages');
  const messages = messageRows.length
    ? messageRows.map((row, i) => ({
        author: str(row, ['authorName', 'author_name', 'author', 'name']) ?? `User ${i + 1}`,
        text: str(row, ['text', 'message', 'content']) ?? '',
      })).filter((row) => row.text)
    : readItemList(data.props).map((text, i) => ({ author: `User ${i + 1}`, text }));
  return (
    <Fill color={bgOf(data.props, '#0b0d10')}>
      <div style={{ position: 'absolute', left: '12%', top: '10%', right: '12%', bottom: '10%', background: '#21262e', borderRadius: 16, padding: 28, overflow: 'hidden' }}>
        {workspace ? <div style={{ color: '#8b929c', fontSize: 14, marginBottom: 8 }}>{workspace}</div> : null}
        <div style={{ color: '#2f9e8f', fontSize: 18, marginBottom: 18 }}>#{channel}</div>
        {messages.map((item, i) => {
          const s = clockSpring(clock.frame, clock.fps, 8 + i * 10, { damping: 18, stiffness: 110 });
          return (
            <div key={`${item.author}-${i}`} style={{ opacity: s, transform: `translateY(${(1 - s) * 16}px)`, color: '#eef1f4', fontSize: 22, marginBottom: 14, background: '#2a2f38', padding: '12px 16px', borderRadius: 10 }}>
              <div style={{ color: '#cdd3da', fontSize: 14, marginBottom: 4 }}>{item.author}</div>
              {item.text}
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

export function EyeReveal({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const iris = readColor(data.props, '#3b82f6');
  const open = interpolate(clock.frame, [5, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textIn = clockSpring(clock.frame, clock.fps, 52);
  return (
    <Fill color={bgOf(data.props, '#0f172a')}>
      <div style={{ position: 'absolute', left: '50%', top: '38%', width: 280, height: 120, marginLeft: -140, marginTop: -60, borderRadius: '50%', background: '#f8fafc', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 90 + open * 20, height: 90 + open * 20, marginLeft: -55, marginTop: -55, borderRadius: 99, background: iris }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 36, height: 36, marginLeft: -18, marginTop: -18, borderRadius: 99, background: '#0f172a' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${(1 - open) * 50}%`, background: '#1e293b' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${(1 - open) * 50}%`, background: '#1e293b' }} />
      </div>
      {title ? <div style={{ position: 'absolute', left: 0, right: 0, top: '62%', textAlign: 'center', color: '#f8fafc', fontSize: 48, fontWeight: 800, opacity: textIn }}>{title}</div> : null}
      {sub ? <div style={{ position: 'absolute', left: 0, right: 0, top: '72%', textAlign: 'center', color: '#94a3b8', fontSize: 22, opacity: interpolate(clock.frame, [66, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{sub}</div> : null}
    </Fill>
  );
}

export function FireworksBurst({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  return (
    <Fill color={bgOf(data.props, '#0f172a')}>
      {Array.from({ length: 24 }, (_, i) => {
        const local = clock.frame - (i % 3) * 12;
        if (local < 0) return null;
        const p = Math.min(1, local / 28);
        const ang = (i / 24) * Math.PI * 2;
        const r = p * 220;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(50% + ${Math.cos(ang) * r}px)`,
              top: `calc(42% + ${Math.sin(ang) * r}px)`,
              width: 10,
              height: 10,
              borderRadius: 99,
              background: colors[i % colors.length],
              opacity: 1 - p,
            }}
          />
        );
      })}
      {title ? <div style={{ position: 'absolute', left: 0, right: 0, top: '58%', textAlign: 'center', color: '#f8fafc', fontSize: 56, fontWeight: 800, opacity: clockSpring(clock.frame, clock.fps, 40) }}>{title}</div> : null}
      {sub ? <div style={{ position: 'absolute', left: 0, right: 0, top: '70%', textAlign: 'center', color: '#fbbf24', fontSize: 22 }}>{sub}</div> : null}
    </Fill>
  );
}

export function FlipPageTransition({ data, clock }: TemplateProps) {
  const lines = readDisplayLines(data.props);
  const front = lines[0] ?? readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const back = lines[1] ?? readNonEmptyString(data.props, 'subtitle');
  const rot = interpolate(clock.frame, [6, 40], [0, -180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Fill color={bgOf(data.props, '#1c1917')}>
      <div style={{ position: 'absolute', inset: '10% 18%', perspective: 1600 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#faf7f2', transform: `rotateY(${rot}deg)`, transformOrigin: 'left center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1917', fontSize: 56, fontWeight: 800 }}>
          {rot > -90 ? front : back}
        </div>
      </div>
    </Fill>
  );
}

export function FourToneMonoTitler({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const tones = ['#22d3ee', '#a78bfa', '#f472b6', '#fde047'];
  const s = clockSpring(clock.frame, clock.fps);
  return (
    <Fill color={bgOf(data.props, '#030712')}>
      <TemplateStage>
        <div style={{ position: 'relative', fontSize: 84, fontWeight: 900, letterSpacing: '-0.04em' }}>
          {tones.map((c, i) => (
            <div key={c} style={{ position: i ? 'absolute' : 'relative', inset: i ? 0 : undefined, color: c, transform: `translate(${(1 - s) * (i - 1.5) * 18}px, ${(1 - s) * (i - 1.5) * 8}px)`, opacity: 0.85 }}>
              {title}
            </div>
          ))}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function GradientTextSweep({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const color = readColor(data.props, '#22d3ee');
  const x = (clockProgress(clock) * 160) % 160;
  return (
    <Fill color={bgOf(data.props, '#020617')}>
      <TemplateStage>
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            backgroundImage: `linear-gradient(90deg, #fff 0%, ${color} ${x}%, #fff 100%)`,
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {title}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function InkSpreadTransition({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#0f172a');
  const t = clockProgress(clock);
  return (
    <Fill>
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${12 + hash01(i + 2) * 76}%`,
            top: `${10 + hash01(i + 9) * 80}%`,
            width: 40 + t * (220 + i * 40),
            height: 40 + t * (220 + i * 40),
            marginLeft: -80,
            marginTop: -80,
            borderRadius: '45% 55% 50% 50%',
            background: color,
            opacity: 0.55 + i * 0.05,
          }}
        />
      ))}
    </Fill>
  );
}

export function KineticWordStack({ data, clock }: TemplateProps) {
  const listed = readStringArray(data.props, 'words');
  const words = (listed.length ? listed : readItemList(data.props).length ? readItemList(data.props) : readDisplayLines(data.props)).map((w) => w.toUpperCase());
  const color = readColor(data.props, '#ecfeff');
  const accent = readColor(data.props, '#22d3ee');
  return (
    <Fill color={bgOf(data.props, '#050818')}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {words.map((word, i) => {
          const s = clockSpring(clock.frame, clock.fps, 6 + i * 11, { damping: 16, stiffness: 90 });
          return (
            <div key={`${word}-${i}`} style={{ color: i === words.length - 1 ? accent : color, fontSize: 64, fontWeight: 900, letterSpacing: '0.08em', opacity: s, transform: `translateY(${(1 - s) * -80}px)` }}>
              {word}
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

export function KpiCounter({ data, clock }: TemplateProps) {
  const title = str(data.props, ['title']);
  const metricRows = readObjectArray(data.props, 'metrics');
  const items = metricRows.length
    ? metricRows.map((row, i) => ({
        label: str(row, ['label', 'title', 'name']) ?? `KPI ${i + 1}`,
        value: readNumber(row.value) ?? 0,
        prefix: str(row, ['prefix']) ?? '',
        suffix: str(row, ['suffix']) ?? '',
        color: str(row, ['color']) || paletteColor(i, '#6366f1'),
      }))
    : chartValues(readChartData(data.props)).slice(0, 4).map((row, i) => ({
        label: row.label,
        value: row.value,
        prefix: '',
        suffix: '',
        color: row.color || paletteColor(i, '#6366f1'),
      }));
  const fallback = items.length ? items : readItemList(data.props).map((label, i) => ({ label, value: 0, prefix: '', suffix: '', color: paletteColor(i) }));
  const t = clockProgress(clock, 12, Math.max(20, clock.durationInFrames - 8));
  return (
    <Fill color={bgOf(data.props, '#0f172a')}>
      <div style={{ position: 'absolute', inset: 0, padding: 64 }}>
        {title ? <div style={{ color: '#f8fafc', fontSize: 36, fontWeight: 800, marginBottom: 28 }}>{title}</div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, fallback.length)}, 1fr)`, gap: 20 }}>
          {fallback.map((row, i) => {
            const s = clockSpring(clock.frame, clock.fps, i * 6);
            const shown = Math.round((row.value ?? 0) * t);
            return (
              <div key={`${row.label}-${i}`} style={{ background: '#1e293b', borderRadius: 16, padding: 24, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
                <div style={{ color: row.color, fontSize: 44, fontWeight: 800 }}>{`${row.prefix}${formatChartValue(shown)}${row.suffix}`}</div>
                <div style={{ color: '#94a3b8', marginTop: 8, fontSize: 18 }}>{row.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Fill>
  );
}

export function LineChartAnim({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title');
  const rows = chartValues(readChartData(data.props)).slice(0, 10);
  const peak = maxAbs(rows) || 1;
  const w = 1000;
  const h = 420;
  const pad = 50;
  const pts = rows.map((row, i) => {
    const x = pad + (i / Math.max(1, rows.length - 1)) * (w - pad * 2);
    const y = h - pad - (Math.abs(row.value) / peak) * (h - pad * 2);
    return { x, y, row };
  });
  const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  const t = interpolate(clock.frame, [8, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const color = readColor(data.props, '#22d3ee');
  return (
    <Fill color={bgOf(data.props, '#0b1220')}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {title ? <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 16 }}>{title}</div> : null}
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <path d={d || 'M 50 370 L 950 370'} fill="none" stroke={color} strokeWidth="4" strokeDasharray={1200} strokeDashoffset={1200 * (1 - t)} />
          {pts.map((p, i) => (
            <g key={p.row.label} opacity={t > i / Math.max(1, pts.length) ? 1 : 0}>
              <circle cx={p.x} cy={p.y} r="6" fill={color} />
              <text x={p.x} y={h - 16} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="14">{p.row.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </Fill>
  );
}

export function LogoMaskWipe({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const t = interpolate(clock.frame, [0, 28], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Fill color={bgOf(data.props, '#050505')}>
      <TemplateStage>
        <div style={{ clipPath: `inset(0 ${100 - t}% 0 0)` }}>
          <LogoFallback data={data} color={color} style={{ width: 320, height: 320, borderRadius: 28, fontSize: 28 }} />
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function LoopGridWave({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#22d3ee');
  return (
    <Fill color={bgOf(data.props, '#020617')}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', width: '100%', height: '100%', gap: 8, padding: 24 }}>
        {Array.from({ length: 96 }, (_, i) => {
          const wave = Math.sin(clock.frame * 0.12 + (i % 12) * 0.45) * 0.5 + 0.5;
          return <div key={i} style={{ background: color, opacity: 0.15 + wave * 0.7, borderRadius: 6, transform: `scaleY(${0.35 + wave * 0.9})` }} />;
        })}
      </div>
    </Fill>
  );
}

export function LowerThirdGlassCard({ data, clock }: TemplateProps) {
  const name = str(data.props, ['nameText', 'name_text', 'name', 'title']) ?? readDisplayLines(data.props)[0] ?? readDisplayText(data.props);
  const role = str(data.props, ['titleText', 'title_text', 'role', 'subtitle']) ?? readDisplayLines(data.props)[1];
  const accent = readColor(data.props, '#06b6d4');
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 18, stiffness: 90 });
  const glow = 0.5 + 0.5 * Math.sin(clock.frame * 0.08);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: '6%',
          bottom: '12%',
          minWidth: 420,
          transform: `translateY(${(1 - s) * 80}px)`,
          opacity: s,
          background: 'rgba(12, 26, 46, 0.55)',
          border: `1px solid ${accent}66`,
          boxShadow: `0 0 ${24 + glow * 20}px ${accent}44`,
          borderRadius: 18,
          padding: '22px 28px',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ width: 48, height: 3, background: accent, marginBottom: 12 }} />
        <div style={{ color: '#f0f9ff', fontSize: 32, fontWeight: 800 }}>{name}</div>
        {role ? <div style={{ color: 'rgba(240,249,255,0.7)', fontSize: 18, marginTop: 6 }}>{role}</div> : null}
      </div>
    </div>
  );
}

export function NeonSign({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const neon = readColor(data.props, '#f0abfc');
  const flicker = clock.frame < 25 ? Math.sin(clock.frame * 3.7) > -0.2 : !(clock.frame === 38 || clock.frame === 39 || clock.frame === 55);
  return (
    <Fill color={bgOf(data.props, '#080010')}>
      <TemplateStage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: neon, fontSize: 96, fontWeight: 900, letterSpacing: '0.18em', opacity: flicker ? 1 : 0.08, textShadow: flicker ? `0 0 24px ${neon}, 0 0 48px ${neon}` : 'none' }}>{title}</div>
          {sub ? <div style={{ marginTop: 16, color: '#a21caf', fontSize: 22, opacity: interpolate(clock.frame, [30, 44], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{sub}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function ParticleSnow({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#e2e8f0');
  return (
    <Fill color={bgOf(data.props)}>
      {Array.from({ length: 48 }, (_, i) => {
        const x = hash01(i + 3) * 100;
        const y = ((hash01(i + 11) * 100) + clock.frame * (0.4 + hash01(i + 21) * 1.2)) % 110;
        return <div key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: 3 + hash01(i) * 5, height: 3 + hash01(i) * 5, borderRadius: 99, background: color, opacity: 0.35 + hash01(i + 7) * 0.5 }} />;
      })}
    </Fill>
  );
}

export function PencilDraw({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const color = readColor(data.props, '#1e293b');
  const t = interpolate(clock.frame, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Fill color={bgOf(data.props, '#f8fafc')}>
      <TemplateStage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color, fontSize: 72, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</div>
          <div style={{ height: 3, width: 280, background: color, margin: '16px auto 0', transform: `scaleX(${t})`, transformOrigin: 'left' }} />
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function PixelCandlestickOhlc({ data, clock }: TemplateProps) {
  const ticker = str(data.props, ['ticker', 'title', 'symbol']);
  const rows = chartValues(readChartData(data.props)).slice(0, 12);
  const ohlcRows = readObjectArray(data.props, 'candles').concat(readObjectArray(data.props, 'ohlc'));
  const candles = ohlcRows.length
    ? ohlcRows.map((row, i) => ({
        o: readNumber(row.o ?? row.open) ?? 0,
        c: readNumber(row.c ?? row.close) ?? 0,
        h: readNumber(row.h ?? row.high) ?? 0,
        l: readNumber(row.l ?? row.low) ?? 0,
        label: str(row, ['label', 'name']) ?? String(i + 1),
      }))
    : rows.length
      ? rows.map((row) => ({ o: Math.abs(row.value) * 0.7, c: Math.abs(row.value), h: Math.abs(row.value) * 1.15, l: Math.abs(row.value) * 0.55, label: row.label }))
      : Array.from({ length: 8 }, (_, i) => ({ o: 40 + hash01(i) * 20, c: 50 + hash01(i + 2) * 30, h: 90, l: 20, label: String(i + 1) }));
  const peak = Math.max(...candles.map((c) => c.h), 1);
  const t = clockProgress(clock);
  return (
    <Fill color={bgOf(data.props, '#020617')}>
      {ticker ? <div style={{ position: 'absolute', left: 48, top: 24, color: '#7fe9ff', fontSize: 22, fontFamily: 'ui-monospace, Menlo, monospace' }}>{ticker}</div> : null}
      <div style={{ position: 'absolute', inset: 48, display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        {candles.map((c) => {
          const up = c.c >= c.o;
          const body = (Math.abs(c.c - c.o) / peak) * 320 * t;
          return (
            <div key={c.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 2, height: (c.h / peak) * 360 * t, background: up ? '#22c55e' : '#ef4444', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '50%', bottom: (Math.min(c.o, c.c) / peak) * 360 * t, width: 16, height: Math.max(4, body), marginLeft: -8, background: up ? '#22c55e' : '#ef4444' }} />
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>{c.label}</div>
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

export function PixelMosaicTransition({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#111827');
  const t = clockProgress(clock);
  return (
    <Fill>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', width: '100%', height: '100%' }}>
        {Array.from({ length: 128 }, (_, i) => (
          <div key={i} style={{ background: t > hash01(i + 4) ? color : 'transparent' }} />
        ))}
      </div>
    </Fill>
  );
}

export function PixelTypewriterQuote({ data, clock }: TemplateProps) {
  const quote = readNonEmptyString(data.props, 'quote') ?? readDisplayText(data.props);
  const who = readNonEmptyString(data.props, 'attribution') ?? readNonEmptyString(data.props, 'subtitle');
  const n = Math.floor(interpolate(clock.frame, [0, Math.max(12, clock.durationInFrames * 0.7)], [0, quote.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <Fill color={bgOf(data.props, '#0b1020')}>
      <TemplateStage>
        <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#86efac', fontSize: 28, maxWidth: '70%' }}>
          {quote.slice(0, n)}
          <span style={{ opacity: clock.frame % 16 < 8 ? 1 : 0.2 }}>█</span>
          {who ? <div style={{ marginTop: 20, color: '#64748b', fontSize: 16 }}>{who}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function PixelWaterfallCycle({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#22c55e');
  const glyph = (readDisplayText(data.props) || 'PIXEL').replace(/\s+/g, '');
  return (
    <Fill color={bgOf(data.props, '#020617')}>
      {Array.from({ length: 18 }, (_, c) => {
        const y = ((clock.frame * (0.8 + hash01(c) * 1.4) + hash01(c + 3) * 80) % 130) - 20;
        return (
          <div key={c} style={{ position: 'absolute', left: `${(c / 18) * 100}%`, top: `${y}%`, color, fontFamily: 'ui-monospace, monospace', fontSize: 18, opacity: 0.8 }}>
            {glyph[c % Math.max(1, glyph.length)]}
          </div>
        );
      })}
    </Fill>
  );
}

export function PouroverDripFillGauge({ data, clock }: TemplateProps) {
  const t = clockProgress(clock, 8, Math.max(20, clock.durationInFrames - 6));
  const color = readColor(data.props, '#b45309');
  const label = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const pct = Math.round(t * (readNumberProp(data.props, ['value', 'percent']) ?? 100));
  return (
    <Fill color={bgOf(data.props, '#fff7ed')}>
      <TemplateStage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 160, height: 200, margin: '0 auto', border: `6px solid ${color}`, borderRadius: '0 0 80px 80px', overflow: 'hidden', position: 'relative', background: '#fff' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${t * 100}%`, background: color, opacity: 0.85 }} />
          </div>
          <div style={{ marginTop: 16, color, fontSize: 36, fontWeight: 800 }}>{pct}%</div>
          {label ? <div style={{ color: '#7c2d12', marginTop: 6, fontSize: 20 }}>{label}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function RacingChart({ data, clock }: TemplateProps) {
  const title = str(data.props, ['title']);
  const framesPer = Math.max(8, readNumberProp(data.props, ['frames', 'stepFrames', 'step_frames']) ?? 36);
  const series = readObjectArray(data.props, 'data').length
    ? readObjectArray(data.props, 'data')
    : readObjectArray(data.props, 'series');
  const raced = series
    .map((row, i) => {
      const values = Array.isArray(row.values)
        ? row.values.map(readNumber).filter((n): n is number => n != null)
        : [];
      const label = str(row, ['label', 'name']) ?? `Series ${i + 1}`;
      const color = str(row, ['color']) || paletteColor(i, '#d4af37');
      if (!values.length) {
        const value = readNumber(row.value);
        return value == null ? null : { label, color, value };
      }
      const step = Math.min(values.length - 1, Math.floor(clock.frame / framesPer));
      const next = Math.min(values.length - 1, step + 1);
      const u = Math.min(1, (clock.frame - step * framesPer) / framesPer);
      const value = values[step] + (values[next] - values[step]) * u;
      return { label, color, value };
    })
    .filter((row): row is { label: string; color: string; value: number } => Boolean(row));
  const rows = raced.length ? raced : chartValues(readChartData(data.props)).slice(0, 6);
  const peak = maxAbs(rows) || 1;
  const t = raced.length ? 1 : interpolate(clock.frame, [6, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ranked = [...rows].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return (
    <Fill color={bgOf(data.props, '#0b1220')}>
      <div style={{ position: 'absolute', inset: 56 }}>
        {title ? <div style={{ color: '#fff', fontSize: 32, fontWeight: 800, marginBottom: 24 }}>{title}</div> : null}
        {ranked.map((row, i) => (
          <div key={`${row.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 120, color: '#cbd5e1', fontSize: 18 }}>{row.label}</div>
            <div style={{ flex: 1, height: 28, background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ width: `${(Math.abs(row.value) / peak) * 100 * t}%`, height: '100%', background: row.color || paletteColor(i, '#d4af37') }} />
            </div>
            <div style={{ width: 64, color: '#fff', textAlign: 'right' }}>{formatChartValue(row.value)}</div>
          </div>
        ))}
      </div>
    </Fill>
  );
}

export function ScrambleText({ data, clock }: TemplateProps) {
  const text = str(data.props, ['text', 'title']) ?? readDisplayText(data.props);
  const label = readNonEmptyString(data.props, 'label') ?? readNonEmptyString(data.props, 'subtitle');
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  const dur = Math.max(12, Math.round(clock.fps * 2));
  const chars = Array.from(text);
  const resolved = interpolate(clock.frame, [8, 8 + dur], [0, chars.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const color = readColor(data.props, '#00ff9c');
  return (
    <Fill color={bgOf(data.props, '#05080f')}>
      <TemplateStage>
        <div style={{ textAlign: 'center', fontFamily: 'ui-monospace, Menlo, monospace' }}>
          {label ? <div style={{ color: '#7a9a8c', letterSpacing: '0.28em', marginBottom: 16 }}>{label}</div> : null}
          <div style={{ color, fontSize: 48, fontWeight: 800, letterSpacing: '0.12em' }}>
            {chars.map((ch, i) => {
              if (i < resolved) return ch;
              const g = charset[Math.floor(hash01(clock.frame * 0.37 + i * 9) * charset.length)] ?? ch;
              return g;
            }).join('')}
          </div>
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function ShatterReveal({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const t = interpolate(clock.frame, [0, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const color = readColor(data.props, '#f8fafc');
  return (
    <Fill color={bgOf(data.props, '#111827')}>
      <TemplateStage>
        <div style={{ position: 'relative', fontSize: 72, fontWeight: 900, color }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{
                position: i ? 'absolute' : 'relative',
                inset: i ? 0 : undefined,
                clipPath: `inset(${(i % 3) * 33}% ${(i > 2 ? 50 : 0)}% ${100 - ((i % 3) + 1) * 33}% ${i > 2 ? 0 : 50}%)`,
                transform: `translate(${(1 - t) * (hash01(i) - 0.5) * 80}px, ${(1 - t) * (hash01(i + 4) - 0.5) * 60}px) rotate(${(1 - t) * (hash01(i + 8) - 0.5) * 18}deg)`,
                opacity: 0.4 + t * 0.6,
              }}
            >
              {title}
            </div>
          ))}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function SocialReel({ data, clock }: TemplateProps) {
  const items = readItemList(data.props);
  const infoLines = readStringArray(data.props, 'infoLines').length ? readStringArray(data.props, 'infoLines') : items;
  const headline = str(data.props, ['headline', 'title']) ?? readDisplayText(data.props);
  const accentWord = str(data.props, ['headlineAccent', 'headline_accent']);
  const handle = str(data.props, ['handle', 'username']);
  const brand = str(data.props, ['brandName', 'brand_name']);
  const caption = str(data.props, ['caption', 'secondCopy', 'second_copy']);
  const cta = str(data.props, ['ctaText', 'cta_text']);
  const accent = readColor(data.props, '#f472b6');
  const s = clockSpring(clock.frame, clock.fps, 6);
  return (
    <Fill color={bgOf(data.props, '#0b0b0f')}>
      <div style={{ position: 'absolute', left: '50%', top: '8%', width: 360, height: '84%', marginLeft: -180, borderRadius: 36, border: '8px solid #111', overflow: 'hidden', background: '#111827' }}>
        <div style={{ padding: 20, color: '#fff', opacity: s, transform: `translateY(${(1 - s) * 16}px)` }}>
          {handle || brand ? <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>{handle ?? brand}</div> : null}
          {headline ? (
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
              {headline} {accentWord ? <span style={{ color: accent }}>{accentWord}</span> : null}
            </div>
          ) : null}
          {caption ? <div style={{ color: '#cbd5e1', fontSize: 16, marginBottom: 16 }}>{caption}</div> : null}
          {infoLines.map((item, i) => {
            const enter = clockSpring(clock.frame, clock.fps, 10 + i * 8);
            return (
              <div key={`${item}-${i}`} style={{ opacity: enter, transform: `translateY(${(1 - enter) * 20}px)`, background: '#1f2937', borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 16 }}>
                {item}
              </div>
            );
          })}
          {cta ? <div style={{ marginTop: 18, background: accent, color: '#111', textAlign: 'center', borderRadius: 999, padding: '12px 16px', fontWeight: 800 }}>{cta}</div> : null}
        </div>
      </div>
    </Fill>
  );
}

export function TextMaskReveal({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const t = interpolate(clock.frame, [0, 28], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const color = readColor(data.props, '#f8fafc');
  return (
    <Fill color={bgOf(data.props, '#020617')}>
      <TemplateStage>
        <div style={{ fontSize: 84, fontWeight: 900, color, clipPath: `inset(0 ${100 - t}% 0 0)` }}>{title}</div>
      </TemplateStage>
    </Fill>
  );
}

export function ThinkingBubble({ data, clock }: TemplateProps) {
  const text = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const s = clockSpring(clock.frame, clock.fps, 6);
  const dots = 1 + Math.floor((clock.frame / 10) % 3);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: '10%', top: '18%', minWidth: 280, transform: `scale(${s})`, opacity: s, background: '#fff', color: '#111', borderRadius: 28, padding: '22px 28px', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{text || '.'.repeat(dots)}</div>
      </div>
    </div>
  );
}

export function TransitionCircleWipe({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#000');
  const t = clockProgress(clock);
  const r = t * 80;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: color, WebkitMaskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r + 1}%)`, maskImage: `radial-gradient(circle at 50% 50%, transparent ${r}%, black ${r + 1}%)` }} />
  );
}

export function TypewriterMachine({ data, clock }: TemplateProps) {
  const text = str(data.props, ['messageText', 'message_text', 'title', 'text']) ?? readDisplayText(data.props);
  const sub = str(data.props, ['subText', 'sub_text', 'subtitle']);
  const n = Math.floor(interpolate(clock.frame, [12, Math.max(24, clock.durationInFrames * 0.7)], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 11, stiffness: 80 });
  return (
    <Fill color={bgOf(data.props, '#0f0c00')}>
      <TemplateStage>
        <div style={{ transform: `translateY(${(1 - s) * 30}px)`, width: 520, background: '#1f2937', borderRadius: 16, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.45)' }}>
          <div style={{ height: 10, background: '#dc2626', borderRadius: 8, marginBottom: 16 }} />
          <div style={{ background: '#f8fafc', minHeight: 120, borderRadius: 8, padding: 16, color: '#1f2937', fontFamily: 'Georgia, serif', fontSize: 28 }}>
            {text.slice(0, n)}
            <span style={{ opacity: clock.frame % 14 < 7 ? 1 : 0 }}>|</span>
          </div>
          {sub ? <div style={{ marginTop: 12, color: '#d97706', textAlign: 'center' }}>{sub}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function WaveHello({ data, clock }: TemplateProps) {
  const label = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const rot = Math.sin(clock.frame * 0.25) * 22;
  return (
    <Fill color={bgOf(data.props, '#fff7ed')}>
      <TemplateStage>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 120, transform: `rotate(${rot}deg)`, display: 'inline-block' }}>👋</div>
          {label ? <div style={{ marginTop: 16, color: '#9a3412', fontSize: 36, fontWeight: 800 }}>{label}</div> : null}
        </div>
      </TemplateStage>
    </Fill>
  );
}

export function WaveText({ data, clock }: TemplateProps) {
  const text = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const color = readColor(data.props, '#f8fafc');
  const chars = Array.from(text);
  return (
    <Fill color={bgOf(data.props, '#0f172a')}>
      <TemplateStage>
        <div style={{ display: 'flex' }}>
          {chars.map((ch, i) => (
            <span key={`${ch}-${i}`} style={{ color, fontSize: 64, fontWeight: 800, transform: `translateY(${Math.sin(clock.frame * 0.18 + i * 0.45) * 18}px)` }}>
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </div>
      </TemplateStage>
    </Fill>
  );
}
