'use client';

import { interpolate } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayText, readImageUrl, readNonEmptyString } from '../../../props';
import { SafeImage, TemplateStage, clockProgress } from '../shared';

export function CameraShake({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fff');
  const amplitude = interpolate(clock.frame, [0, Math.max(1, clock.durationInFrames - 1)], [15, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = Math.sin(clock.frame * 0.8) * amplitude;
  const y = Math.cos(clock.frame * 1.1) * amplitude;
  const src = readImageUrl(data.props);
  const text = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {src ? <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, background: '#111827' }} />}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `translate(${x}px, ${y}px)` }}>
        {text ? (
          <div
            style={{
              background: src ? 'rgba(15,23,42,0.72)' : 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 16,
              padding: '40px 56px',
              textAlign: 'center',
            }}
          >
            <div style={{ color, fontSize: 56, fontWeight: 800, letterSpacing: '0.12em' }}>{text}</div>
            {sub ? <div style={{ marginTop: 12, color: '#93c5fd', fontSize: 20 }}>{sub}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FilmBurn({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at ${40 + t * 20}% 20%, rgba(251,146,60,${0.35 + t * 0.3}) 0%, transparent 40%), linear-gradient(180deg, rgba(0,0,0,0.15), rgba(120,40,0,${0.25 + t * 0.4}))`,
        mixBlendMode: 'screen',
      }}
    />
  );
}

export function KenBurns({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  if (!src) return <div style={{ position: 'absolute', inset: 0 }} />;
  const t = clockProgress(clock);
  const scale = 1.08 + t * 0.12;
  const x = (1 - t) * -3;
  const y = t * 2;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <SafeImage
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${x}%, ${y}%) scale(${scale})`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}

export function LetterboxReveal({ data, clock }: TemplateProps) {
  const t = clockProgress(clock, 0, Math.max(10, clock.fps * 0.7));
  const band = 18 * (1 - t);
  const text = readDisplayText(data.props);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${band}%`, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${band}%`, background: '#000' }} />
      {text ? (
        <TemplateStage>
          <div style={{ color: '#fff', fontSize: 48, fontWeight: 700 }}>{text}</div>
        </TemplateStage>
      ) : null}
    </div>
  );
}

export function ParallaxPan({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const t = clockProgress(clock);
  const text = readDisplayText(data.props);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {src ? (
        <SafeImage
          src={src}
          style={{
            width: '120%',
            height: '120%',
            objectFit: 'cover',
            transform: `translate(${-10 + t * 8}%, ${-6 + t * 4}%)`,
          }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: '-10%', background: `radial-gradient(circle at ${30 + t * 40}% 40%, #1f2937, #020617)` }} />
      )}
      {text ? (
        <div style={{ position: 'absolute', bottom: 80, left: 80, color: '#fff', fontSize: 40, fontWeight: 800, transform: `translateX(${(1 - t) * 40}px)` }}>
          {text}
        </div>
      ) : null}
    </div>
  );
}

export function SpotlightReveal({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  const text = readDisplayText(data.props);
  const color = readColor(data.props, '#fff');
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#050505' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, transparent ${12 + t * 38}%, rgba(0,0,0,0.92) ${28 + t * 50}%)`,
        }}
      />
      <TemplateStage>
        <div style={{ color, fontSize: 56, fontWeight: 800, opacity: 0.4 + t * 0.6 }}>{text}</div>
      </TemplateStage>
    </div>
  );
}

export function VignettePulse({ data, clock }: TemplateProps) {
  const pulse = 0.45 + Math.abs(Math.sin(clock.frame * 0.08)) * 0.35;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        boxShadow: `inset 0 0 ${120 * pulse}px ${80 * pulse}px rgba(0,0,0,${0.55 + pulse * 0.25})`,
        pointerEvents: 'none',
      }}
    />
  );
}

export function WhipPan({ data, clock }: TemplateProps) {
  const t = clockProgress(clock);
  const x = (t - 0.5) * 160;
  const blur = Math.abs(0.5 - t) * 18;
  const text = readDisplayText(data.props);
  const src = readImageUrl(data.props);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${x}%)`, filter: `blur(${blur}px)` }}>
      {src ? <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, background: '#111' }} />}
      {text ? (
        <TemplateStage>
          <div style={{ color: '#fff', fontSize: 64, fontWeight: 800 }}>{text}</div>
        </TemplateStage>
      ) : null}
    </div>
  );
}

export function ZoomPulse({ data, clock }: TemplateProps) {
  const pulse = 1 + Math.sin(clock.frame * 0.12) * 0.06;
  const text = readDisplayText(data.props);
  const src = readImageUrl(data.props);
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${pulse})` }}>
      {src ? <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      {text ? (
        <TemplateStage>
          <div style={{ color: readColor(data.props, '#fff'), fontSize: 56, fontWeight: 800 }}>{text}</div>
        </TemplateStage>
      ) : null}
    </div>
  );
}
