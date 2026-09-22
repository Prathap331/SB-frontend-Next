'use client';

import type { TemplateProps } from '../../../types';
import {
  readColor,
  readDisplayText,
  readIconNames,
  readItemList,
  readNonEmptyString,
  readNumberProp,
} from '../../../props';
import { clockSpring, hash01 } from '../../../animation';
import { LucideIconView } from '../../../icons';
import { CardShell, TemplateStage, appearOpacity, clockProgress, paletteColor, staggeredProgress } from '../shared';

export function AnimatedList({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#F5A623');
  const items = readItemList(data.props);
  const icons = readIconNames(data.props);
  const opacity = appearOpacity(clock);
  return (
    <TemplateStage style={{ opacity }}>
      <CardShell style={{ width: 'min(720px, 82%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item, i) => {
            const s = clockSpring(clock.frame - i * 5, clock.fps, 0, { damping: 12, stiffness: 140, mass: 0.65 });
            return (
              <div
                key={`${item}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: s,
                  transform: `translateX(${(1 - s) * -80}px) scale(${0.3 + 0.7 * s})`,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  padding: '14px 18px',
                  color: '#f5f5f7',
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {icons[i] ? (
                  <LucideIconView name={icons[i]} size={24} color={color} />
                ) : (
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: color, flexShrink: 0 }} />
                )}
                {item}
              </div>
            );
          })}
        </div>
      </CardShell>
    </TemplateStage>
  );
}

export function CardFlip({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const front = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Front');
  const back =
    readNonEmptyString(data.props, 'subtitle') ??
    readNonEmptyString(data.props, 'caption') ??
    readItemList(data.props)[0] ??
    'Back';
  const t = clockProgress(clock);
  const rot = t * 180;
  const showBack = rot > 90;
  return (
    <TemplateStage>
      <div style={{ perspective: 1200 }}>
        <div
          style={{
            width: 420,
            height: 260,
            transform: `rotateY(${rot}deg)`,
            transformStyle: 'preserve-3d',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              background: '#12151c',
              border: `2px solid ${color}`,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              fontSize: 32,
              fontWeight: 800,
              opacity: showBack ? 0 : 1,
            }}
          >
            {front}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: 'rotateY(180deg)',
              background: color,
              color: '#111',
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 800,
              padding: 24,
              textAlign: 'center',
              opacity: showBack ? 1 : 0,
            }}
          >
            {back}
          </div>
        </div>
      </div>
    </TemplateStage>
  );
}

export function CountdownTimer({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const start = Math.max(1, Math.round(readNumberProp(data.props, ['from', 'start', 'seconds', 'value', 'count']) ?? 5));
  const elapsed = clock.frame / Math.max(1, clock.fps);
  const remaining = Math.max(0, Math.ceil(start - elapsed));
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 10, stiffness: 160 });
  return (
    <TemplateStage>
      <div style={{ color, fontSize: 140, fontWeight: 800, transform: `scale(${0.85 + 0.15 * s})` }}>{remaining}</div>
    </TemplateStage>
  );
}

export function NotificationPop({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#3b82f6');
  const title = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Notification');
  const body = readNonEmptyString(data.props, 'subtitle') ?? readNonEmptyString(data.props, 'caption') ?? '';
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 11, stiffness: 170 });
  return (
    <TemplateStage style={{ alignItems: 'flex-start', justifyContent: 'flex-end', padding: 64 }}>
      <div
        style={{
          width: 420,
          transform: `translateY(${(1 - s) * -40}px) scale(${0.86 + 0.14 * s})`,
          opacity: s,
          background: '#111827',
          border: `1px solid ${color}66`,
          borderRadius: 20,
          padding: 18,
          display: 'flex',
          gap: 12,
          boxShadow: '0 18px 50px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 99, background: color, marginTop: 6 }} />
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{title}</div>
          {body ? <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 4, fontSize: 14 }}>{body}</div> : null}
        </div>
      </div>
    </TemplateStage>
  );
}

export function ParticleExplosion({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f59e0b');
  const text = readDisplayText(data.props);
  const t = clockProgress(clock);
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = hash01(i + 1) * Math.PI * 2;
    const dist = 40 + hash01(i + 40) * 180;
    return {
      x: Math.cos(angle) * dist * t,
      y: Math.sin(angle) * dist * t,
      size: 6 + hash01(i + 80) * 10,
      color: paletteColor(i, color),
    };
  });
  return (
    <TemplateStage>
      <div style={{ position: 'relative', width: 1, height: 1 }}>
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.size,
              borderRadius: 99,
              background: p.color,
              opacity: 1 - t * 0.35,
            }}
          />
        ))}
      </div>
      {text ? (
        <div style={{ position: 'absolute', color: '#fff', fontSize: 36, fontWeight: 800 }}>{text}</div>
      ) : null}
    </TemplateStage>
  );
}

export function ProgressSteps({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#22c55e');
  const items = readItemList(data.props);
  const steps = items.length ? items : ['Start', 'Next', 'Done'];
  const active = Math.min(steps.length - 1, Math.floor(clockProgress(clock) * steps.length));
  return (
    <TemplateStage>
      <CardShell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {steps.map((step, i) => {
            const on = i <= active;
            const s = staggeredProgress(clock, i, 6, 12);
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 99,
                    background: on ? color : 'rgba(255,255,255,0.12)',
                    color: on ? '#111' : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    transform: `scale(${0.7 + 0.3 * s})`,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ color: on ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600 }}>{step}</div>
                {i < steps.length - 1 ? (
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 99 }}>
                    <div style={{ width: `${on ? s * 100 : 0}%`, height: '100%', background: color }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardShell>
    </TemplateStage>
  );
}

export function RotatingCarousel({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const items = readItemList(data.props);
  const cards = items.length ? items : [readDisplayText(data.props) || 'Card'];
  const idx = Math.floor((clock.frame / Math.max(8, clock.fps * 0.9)) % cards.length);
  const s = clockSpring(clock.frame % Math.max(8, Math.round(clock.fps * 0.9)), clock.fps);
  return (
    <TemplateStage>
      <div
        style={{
          width: 520,
          minHeight: 180,
          background: '#12151c',
          border: `1px solid ${color}55`,
          borderRadius: 24,
          padding: 32,
          color,
          fontSize: 36,
          fontWeight: 800,
          textAlign: 'center',
          transform: `scale(${0.92 + 0.08 * s})`,
          opacity: 0.55 + 0.45 * s,
        }}
      >
        {cards[idx]}
      </div>
    </TemplateStage>
  );
}

export function SoundWave({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#38bdf8');
  const bars = 28;
  return (
    <TemplateStage>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 180 }}>
        {Array.from({ length: bars }, (_, i) => {
          const h = 24 + Math.abs(Math.sin(clock.frame * 0.18 + i * 0.45)) * 140;
          return (
            <div
              key={i}
              style={{
                width: 10,
                height: h,
                borderRadius: 99,
                background: color,
                opacity: 0.55 + (i % 3) * 0.15,
              }}
            />
          );
        })}
      </div>
    </TemplateStage>
  );
}

export function TextHighlight({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#facc15');
  const text = readDisplayText(data.props);
  const highlight =
    readNonEmptyString(data.props, 'highlight') ??
    readNonEmptyString(data.props, 'highlightTargetText') ??
    '';
  const t = clockProgress(clock, Math.round(clock.fps * 0.3), Math.round(clock.fps * 1.2));
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  return (
    <TemplateStage>
      <div style={{ color: '#f5f5f7', fontSize: 42, fontWeight: 700, maxWidth: '80%', lineHeight: 1.35, textAlign: 'center' }}>
        {parts.map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 ? (
              <span style={{ position: 'relative', display: 'inline' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 2,
                    height: '0.7em',
                    width: `${t * 100}%`,
                    background: color,
                    opacity: 0.55,
                    zIndex: 0,
                  }}
                />
                <span style={{ position: 'relative' }}>{highlight}</span>
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </TemplateStage>
  );
}
