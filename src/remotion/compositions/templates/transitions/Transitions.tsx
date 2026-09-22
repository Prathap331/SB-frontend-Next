'use client';

import type { ReactNode } from 'react';
import type { TemplateProps } from '../../../types';
import { readColor } from '../../../props';
import { clockProgress } from '../shared';

function Overlay({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>;
}

export function BlindsTransition({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#050505');
  const t = clockProgress(clock);
  const slats = 12;
  return (
    <Overlay>
      {Array.from({ length: slats }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(i / slats) * 100}%`,
            height: `${100 / slats}%`,
            background: color,
            transform: `scaleX(${1 - t})`,
            transformOrigin: i % 2 ? 'left' : 'right',
          }}
        />
      ))}
    </Overlay>
  );
}

export function ClockWipe({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#000');
  const t = clockProgress(clock);
  return (
    <Overlay>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          WebkitMaskImage: `conic-gradient(transparent ${t * 360}deg, black ${t * 360}deg)`,
          maskImage: `conic-gradient(transparent ${t * 360}deg, black ${t * 360}deg)`,
        }}
      />
    </Overlay>
  );
}

export function CrossDissolve({ clock }: TemplateProps) {
  const t = clockProgress(clock);
  return <Overlay><div style={{ position: 'absolute', inset: 0, background: '#000', opacity: t * 0.85 }} /></Overlay>;
}

export function FadeThroughBlack({ clock }: TemplateProps) {
  const t = clockProgress(clock);
  const opacity = t < 0.5 ? t * 2 : (1 - t) * 2;
  return <Overlay><div style={{ position: 'absolute', inset: 0, background: '#000', opacity }} /></Overlay>;
}

export function IrisTransition({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  const r = 10 + t * 90;
  return (
    <Overlay>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: readColor(data.props, '#000'),
          WebkitMaskImage: `radial-gradient(circle, transparent ${r}%, black ${r + 2}%)`,
          maskImage: `radial-gradient(circle, transparent ${r}%, black ${r + 2}%)`,
        }}
      />
    </Overlay>
  );
}

export function MorphTransition({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  const color = readColor(data.props, '#111827');
  return (
    <Overlay>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${t * 160}%`,
          height: `${t * 160}%`,
          transform: 'translate(-50%, -50%)',
          background: color,
          borderRadius: `${(1 - t) * 50}%`,
        }}
      />
    </Overlay>
  );
}

export function PushTransition({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  return (
    <Overlay>
      <div style={{ position: 'absolute', inset: 0, background: readColor(data.props, '#0b0b0f'), transform: `translateX(${(1 - t) * 100}%)` }} />
    </Overlay>
  );
}

export function SlideWipe({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  return (
    <Overlay>
      <div style={{ position: 'absolute', inset: 0, background: readColor(data.props, '#000'), transform: `translateY(${(1 - t) * -100}%)` }} />
    </Overlay>
  );
}

export function ZoomThrough({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  return (
    <Overlay>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: readColor(data.props, '#000'),
          transform: `scale(${1 + t * 8})`,
          opacity: 1 - t,
        }}
      />
    </Overlay>
  );
}
