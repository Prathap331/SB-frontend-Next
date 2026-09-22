'use client';

import { interpolate } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayLines, readDisplayText, readItemList, readNonEmptyString, readNumberProp } from '../../../props';
import { clockSpring } from '../../../animation';
import { CardShell, TemplateStage, appearOpacity, clockProgress } from '../shared';

export function ChapterTitle({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayLines(data.props)[0] ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle') ?? readDisplayLines(data.props)[1];
  const n = readNumberProp(data.props, ['chapter', 'number', 'index']) ?? 1;
  const label = readNonEmptyString(data.props, 'label') ?? 'Chapter';
  const numberScale = clockSpring(clock.frame, clock.fps, 0, { damping: 12, stiffness: 80 });
  const labelOpacity = interpolate(clock.frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lineWidth = interpolate(clock.frame, [10, 40], [0, 120], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(clock.frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleY = interpolate(clock.frame, [20, 40], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <TemplateStage style={{ background: '#050505' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color, letterSpacing: '0.28em', fontSize: 16, marginBottom: 16, opacity: labelOpacity, textTransform: 'uppercase' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ width: lineWidth, height: 2, background: color }} />
          <div style={{ color: '#fff', fontSize: 96, fontWeight: 800, transform: `scale(${numberScale})` }}>{n}</div>
          <div style={{ width: lineWidth, height: 2, background: color }} />
        </div>
        {title ? (
          <div
            style={{
              marginTop: 28,
              color: '#fff',
              fontSize: 48,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
            }}
          >
            {title}
          </div>
        ) : null}
        {sub ? (
          <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.65)', fontSize: 22, opacity: subtitleOpacity }}>{sub}</div>
        ) : null}
      </div>
    </TemplateStage>
  );
}

export function CinematicTitleIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const titleY = clockSpring(clock.frame, clock.fps, 0, { damping: 14, mass: 0.8 });
  const titleOpacity = clockSpring(clock.frame, clock.fps);
  const underlineWidth = interpolate(clock.frame, [20, 50], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(clock.frame, [40, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <TemplateStage style={{ background: '#050505' }}>
      <div style={{ textAlign: 'center', transform: `translateY(${(1 - titleY) * 50}px)`, opacity: titleOpacity }}>
        <div style={{ color, fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</div>
        <div style={{ width: `${underlineWidth}%`, maxWidth: 420, height: 3, background: color, margin: '20px auto 0' }} />
        {sub ? (
          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 22, opacity: subtitleOpacity }}>{sub}</div>
        ) : null}
      </div>
    </TemplateStage>
  );
}

export function CountdownIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fff');
  const start = Math.max(1, Math.round(readNumberProp(data.props, ['from', 'seconds', 'value']) ?? 3));
  const goText = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'GO');
  const secondFrames = Math.max(1, clock.fps);
  const totalCountdownFrames = start * secondFrames;
  const currentSecond = Math.max(start - Math.floor(clock.frame / secondFrames), 0);
  const isCountdownDone = clock.frame >= totalCountdownFrames;
  const frameInSecond = clock.frame % secondFrames;
  const ringProgress = frameInSecond / secondFrames;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = isCountdownDone ? circumference : circumference * ringProgress;
  const goScale = clockSpring(clock.frame, clock.fps, totalCountdownFrames, { damping: 8, stiffness: 100 });
  const goOpacity = interpolate(
    clock.frame,
    [totalCountdownFrames, totalCountdownFrames + 5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <TemplateStage style={{ background: '#050505' }}>
      <div style={{ textAlign: 'center', position: 'relative', width: 220, height: 220 }}>
        {!isCountdownDone ? (
          <svg width={220} height={220} viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0 }}>
            <circle cx={110} cy={110} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={8} />
            <circle
              cx={110}
              cy={110}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
            />
          </svg>
        ) : null}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!isCountdownDone ? (
            <div style={{ color, fontSize: 96, fontWeight: 800 }}>{currentSecond}</div>
          ) : (
            <div style={{ color, fontSize: 72, fontWeight: 800, transform: `scale(${goScale})`, opacity: goOpacity }}>
              {goText}
            </div>
          )}
        </div>
      </div>
    </TemplateStage>
  );
}

export function CreditsRoll({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const items = readItemList(data.props);
  const title = readNonEmptyString(data.props, 'title') ?? 'Credits';
  const y = 40 - clockProgress(clock) * 120;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#050505' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, textAlign: 'center' }}>
        <div style={{ color, fontSize: 28, letterSpacing: '0.2em', marginBottom: 28 }}>{title}</div>
        {items.map((item) => (
          <div key={item} style={{ color: '#fff', fontSize: 26, marginBottom: 14, fontWeight: 600 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EndCard({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#F5A623');
  const title = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Thanks for watching');
  const sub = readNonEmptyString(data.props, 'subtitle') ?? readNonEmptyString(data.props, 'caption');
  const s = clockSpring(clock.frame, clock.fps);
  return (
    <TemplateStage style={{ background: '#0b0b0f' }}>
      <div style={{ textAlign: 'center', transform: `scale(${0.88 + 0.12 * s})`, opacity: s }}>
        <div style={{ width: 72, height: 4, background: color, margin: '0 auto 24px' }} />
        <div style={{ color: '#fff', fontSize: 56, fontWeight: 800 }}>{title}</div>
        {sub ? <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>{sub}</div> : null}
      </div>
    </TemplateStage>
  );
}

export function SubscribeReminder({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#ef4444');
  const title = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Subscribe');
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 10, stiffness: 170 });
  return (
    <TemplateStage>
      <div
        style={{
          transform: `translateY(${(1 - s) * 30}px) scale(${s})`,
          background: '#111',
          borderRadius: 999,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: `1px solid ${color}66`,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 4, background: color }} />
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{title}</div>
      </div>
    </TemplateStage>
  );
}

export function TitleSplit({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fff');
  const lines = readDisplayLines(data.props);
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  let top = readNonEmptyString(data.props, 'top') ?? lines[0];
  let bottom = readNonEmptyString(data.props, 'bottom') ?? lines[1];
  if (!top && title) {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      top = words.slice(0, mid).join(' ');
      bottom = words.slice(mid).join(' ');
    } else {
      top = title;
    }
  }
  const topY = clockSpring(clock.frame, clock.fps, 0, { damping: 14, stiffness: 80 });
  const bottomY = clockSpring(clock.frame, clock.fps, 0, { damping: 14, stiffness: 80 });
  return (
    <TemplateStage style={{ background: '#050505', opacity: appearOpacity(clock) }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color, fontSize: 72, fontWeight: 800, letterSpacing: '0.08em', transform: `translateY(${(1 - topY) * -120}px)` }}>
          {top}
        </div>
        {bottom ? (
          <div style={{ color, fontSize: 72, fontWeight: 800, letterSpacing: '0.08em', transform: `translateY(${(1 - bottomY) * 120}px)` }}>
            {bottom}
          </div>
        ) : null}
      </div>
    </TemplateStage>
  );
}

export function QuoteCardIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const quote = readNonEmptyString(data.props, 'quote') ?? readDisplayText(data.props);
  const who = readNonEmptyString(data.props, 'attribution') ?? readNonEmptyString(data.props, 'subtitle');
  const quoteMarkOpacity = interpolate(clock.frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textOpacity = interpolate(clock.frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const attributionOpacity = interpolate(clock.frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const attributionX = interpolate(clock.frame, [30, 45], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <TemplateStage>
      <CardShell style={{ textAlign: 'center', width: 'min(900px, 84%)' }}>
        <div style={{ fontSize: 96, color, opacity: quoteMarkOpacity, lineHeight: 0.8 }}>“</div>
        <div style={{ color, fontSize: 36, fontFamily: 'Georgia, serif', lineHeight: 1.4, opacity: textOpacity }}>{quote}</div>
        {who ? (
          <div
            style={{
              marginTop: 20,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '0.08em',
              opacity: attributionOpacity,
              transform: `translateX(${attributionX}px)`,
            }}
          >
            — {who}
          </div>
        ) : null}
      </CardShell>
    </TemplateStage>
  );
}

export function IntroLowerThird({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#3b82f6');
  const lines = readDisplayLines(data.props);
  const name =
    readNonEmptyString(data.props, 'name') ??
    readNonEmptyString(data.props, 'title') ??
    lines[0] ??
    readDisplayText(data.props);
  const role =
    readNonEmptyString(data.props, 'role') ??
    readNonEmptyString(data.props, 'subtitle') ??
    readNonEmptyString(data.props, 'caption') ??
    lines[1];
  const accentSlide = clockSpring(clock.frame, clock.fps, 0, { damping: 15, mass: 0.6 });
  const barSlide = clockSpring(clock.frame, clock.fps, 5, { damping: 14, mass: 0.7 });
  const textOpacity = clockSpring(clock.frame, clock.fps, 15);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 64,
          bottom: 80,
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 88,
          transform: `translateX(${(1 - barSlide) * -400}px)`,
        }}
      >
        <div
          style={{
            width: 8,
            background: color,
            transform: `translateX(${(1 - accentSlide) * -40}px)`,
          }}
        />
        <div style={{ background: 'rgba(8,10,14,0.9)', padding: '16px 28px 16px 22px', minWidth: 320, opacity: textOpacity }}>
          <div style={{ color: '#fff', fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>
          {role ? <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 20, marginTop: 6 }}>{role}</div> : null}
        </div>
      </div>
    </div>
  );
}

export const IntroQuoteCard = QuoteCardIntro;
