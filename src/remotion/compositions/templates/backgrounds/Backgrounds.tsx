'use client';

import { useVideoConfig } from 'remotion';
import { type ReactNode } from 'react';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayText } from '../../../props';
import { hash01 } from '../../../animation';
import { clockProgress } from '../shared';

function Stage({ children }: { children: ReactNode }) {
  return <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{children}</div>;
}

export function BokehCircles({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fbbf24');
  const dots = Array.from({ length: 18 }, (_, i) => ({
    x: hash01(i + 3) * 100,
    y: hash01(i + 9) * 100,
    r: 18 + hash01(i + 21) * 70,
    delay: hash01(i + 33),
  }));
  return (
    <Stage>
      {dots.map((d, i) => {
        const pulse = 0.25 + Math.abs(Math.sin(clock.frame * 0.05 + d.delay * 8)) * 0.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: d.r,
              height: d.r,
              marginLeft: -d.r / 2,
              marginTop: -d.r / 2,
              borderRadius: 99,
              background: color,
              opacity: pulse * 0.35,
              filter: 'blur(8px)',
            }}
          />
        );
      })}
    </Stage>
  );
}

export function GeometricPatterns({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#38bdf8');
  const rot = clock.frame * 0.6;
  return (
    <Stage>
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 80 + i * 70,
            height: 80 + i * 70,
            marginLeft: -(40 + i * 35),
            marginTop: -(40 + i * 35),
            border: `2px solid ${color}`,
            opacity: 0.18 + (i % 3) * 0.08,
            transform: `rotate(${rot + i * 8}deg)`,
          }}
        />
      ))}
    </Stage>
  );
}

export function GradientShift({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#6366f1');
  const t = (clock.frame * 2) % 360;
  return (
    <Stage>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(${t}deg, ${color}, #0b1220 40%, #111827 70%, ${color})`,
        }}
      />
    </Stage>
  );
}

export function GridPulse({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#22d3ee');
  const pulse = 0.12 + Math.abs(Math.sin(clock.frame * 0.08)) * 0.18;
  return (
    <Stage>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${color}33 1px, transparent 1px), linear-gradient(90deg, ${color}33 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          opacity: pulse + 0.25,
        }}
      />
    </Stage>
  );
}

export function LiquidWave({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#0ea5e9');
  const y = 55 + Math.sin(clock.frame * 0.07) * 8;
  return (
    <Stage>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path
          d={`M0 ${y} Q 25 ${y - 10} 50 ${y} T 100 ${y} V100 H0 Z`}
          fill={color}
          opacity="0.35"
        />
        <path
          d={`M0 ${y + 8} Q 25 ${y + 16} 50 ${y + 8} T 100 ${y + 8} V100 H0 Z`}
          fill={color}
          opacity="0.2"
        />
      </svg>
    </Stage>
  );
}

export function MatrixRain({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#22c55e');
  const glyph = (readDisplayText(data.props) || '01010111STORIO').replace(/\s+/g, '');
  const cols = 16;
  return (
    <Stage>
      {Array.from({ length: cols }, (_, c) => {
        const speed = 0.6 + hash01(c + 2) * 1.4;
        const y = ((clock.frame * speed + hash01(c) * 200) % 140) - 20;
        const ch = glyph[Math.floor(clock.frame / 4 + c) % glyph.length] ?? '0';
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              left: `${(c / cols) * 100}%`,
              top: `${y}%`,
              color,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 22,
              opacity: 0.75,
            }}
          >
            {ch}
            <div style={{ opacity: 0.35 }}>{glyph[(c + 3) % glyph.length]}</div>
          </div>
        );
      })}
    </Stage>
  );
}

export function NoiseGrain({ clock }: TemplateProps) {
  const specks = Array.from({ length: 40 }, (_, i) => ({
    x: hash01(i + 1 + Math.floor(clock.frame / 2)) * 100,
    y: hash01(i + 70 + Math.floor(clock.frame / 2)) * 100,
    o: 0.08 + hash01(i + 140) * 0.2,
  }));
  return (
    <Stage>
      {specks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: 3,
            height: 3,
            background: '#fff',
            opacity: s.o,
          }}
        />
      ))}
    </Stage>
  );
}

export function PixelTransition({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#111827');
  const t = clockProgress(clock);
  const cells = 48;
  return (
    <Stage>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', width: '100%', height: '100%' }}>
        {Array.from({ length: cells }, (_, i) => {
          const threshold = hash01(i + 4);
          return <div key={i} style={{ background: t > threshold ? color : 'transparent' }} />;
        })}
      </div>
    </Stage>
  );
}

export function Starfield({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f8fafc');
  const { width, height } = useVideoConfig();
  const stars = Array.from({ length: 42 }, (_, i) => ({
    x: hash01(i + 1) * width,
    y: hash01(i + 50) * height,
    z: 0.3 + hash01(i + 90) * 1.7,
    s: 1 + hash01(i + 120) * 2.4,
  }));
  return (
    <Stage>
      {stars.map((st, i) => {
        const y = (st.y + clock.frame * st.z * 3) % height;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: st.x,
              top: y,
              width: st.s,
              height: st.s,
              borderRadius: 99,
              background: color,
              opacity: 0.35 + st.z * 0.3,
            }}
          />
        );
      })}
    </Stage>
  );
}
