'use client';

import { interpolate } from 'remotion';
import type { TemplateProps } from '../../../types';
import { readColor, readDisplayText, readImageUrl, readImageUrls, readNonEmptyString, readNumberProp } from '../../../props';
import { clockSpring } from '../../../animation';
import { CardShell, SafeImage, TemplateStage, appearOpacity, clockProgress, staggeredProgress } from '../shared';

export function GalleryGrid({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props);
  const cells = images.length ? images.slice(0, 6) : [];
  const opacity = appearOpacity(clock);
  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {(cells.length ? cells : [undefined, undefined, undefined, undefined]).map((src, i) => (
            <div key={i} style={{ aspectRatio: '16 / 10', overflow: 'hidden', borderRadius: 16, transform: `scale(${0.85 + 0.15 * staggeredProgress(clock, i, 3, 12)})` }}>
              <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      </CardShell>
    </TemplateStage>
  );
}

export function ImageCarousel({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props);
  const list = images.length ? images : [undefined];
  const idx = Math.floor((clock.frame / Math.max(10, clock.fps)) % list.length);
  return (
    <TemplateStage>
      <div style={{ width: '70%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 24 }}>
        <SafeImage src={list[idx]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </TemplateStage>
  );
}

export function ImageComparisonSlider({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props);
  const left = images[0];
  const right = images[1] ?? images[0];
  const t = readNumberProp(data.props, ['split', 'percent']) ?? clockProgress(clock) * 100;
  const split = Math.max(4, Math.min(96, t));
  return (
    <TemplateStage>
      <div style={{ width: '74%', aspectRatio: '16 / 9', position: 'relative', overflow: 'hidden', borderRadius: 20 }}>
        <SafeImage src={right} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, width: `${split}%`, overflow: 'hidden' }}>
          <SafeImage src={left} style={{ width: `${10000 / split}%`, height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${split}%`, width: 3, background: '#fff' }} />
      </div>
    </TemplateStage>
  );
}

export function ImageZoomReveal({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const t = clockProgress(clock);
  return (
    <TemplateStage>
      <div style={{ width: '70%', aspectRatio: '16 / 9', overflow: 'hidden', borderRadius: 24, transform: `scale(${0.82 + 0.18 * t})` }}>
        <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </TemplateStage>
  );
}

export function MasonryGallery({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props).slice(0, 6);
  return (
    <TemplateStage style={{ opacity: appearOpacity(clock) }}>
      <div style={{ display: 'flex', gap: 12, width: '80%', alignItems: 'flex-start' }}>
        {[0, 1, 2].map((col) => (
          <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(images.length ? images : [undefined, undefined]).filter((_, i) => i % 3 === col).map((src, i) => (
              <div key={i} style={{ height: col === 1 ? 180 : 140, overflow: 'hidden', borderRadius: 16 }}>
                <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </TemplateStage>
  );
}

export function PhotoStack({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props).slice(0, 4);
  const list = images.length ? images : [undefined, undefined, undefined];
  return (
    <TemplateStage>
      <div style={{ position: 'relative', width: 420, height: 300 }}>
        {list.map((src, i) => {
          const s = staggeredProgress(clock, i, 4, 12);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 20,
                transform: `rotate(${(i - 1) * 8}deg) translateY(${(1 - s) * 24}px)`,
                overflow: 'hidden',
                borderRadius: 16,
                boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              }}
            >
              <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          );
        })}
      </div>
    </TemplateStage>
  );
}

export function PictureInPicture({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props);
  const main = images[0] ?? readImageUrl(data.props);
  const pip = images[1] ?? images[0] ?? main;
  const title = readNonEmptyString(data.props, 'title') ?? readNonEmptyString(data.props, 'caption');
  const pipLabel = readNonEmptyString(data.props, 'pipLabel') ?? readNonEmptyString(data.props, 'label');
  const pipScale = clockSpring(clock.frame, clock.fps, 15, { damping: 12, stiffness: 100 });
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b0b0f' }}>
      {main ? <SafeImage src={main} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      {title ? (
        <div style={{ position: 'absolute', left: 48, bottom: 48, color: '#fff', fontSize: 32, fontWeight: 800 }}>{title}</div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          right: 48,
          bottom: 48,
          width: 420,
          height: 236,
          borderRadius: 18,
          overflow: 'hidden',
          transform: `scale(${pipScale})`,
          transformOrigin: 'bottom right',
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          border: '3px solid rgba(255,255,255,0.85)',
          background: '#111',
        }}
      >
        <SafeImage src={pip} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {pipLabel ? (
          <div style={{ position: 'absolute', left: 12, bottom: 10, color: '#fff', fontSize: 16, fontWeight: 700 }}>{pipLabel}</div>
        ) : null}
      </div>
    </div>
  );
}

export function PolaroidFrame({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const caption = readNonEmptyString(data.props, 'caption') ?? readDisplayText(data.props);
  const s = clockProgress(clock);
  const color = readColor(data.props, '#111');
  return (
    <TemplateStage>
      <div style={{ background: '#f7f4ee', padding: 16, paddingBottom: 64, transform: `rotate(${-6 + s * 6}deg)`, boxShadow: '0 18px 50px rgba(0,0,0,0.3)', width: 360 }}>
        <div style={{ height: 240, overflow: 'hidden', background: '#ddd' }}>
          <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {caption ? <div style={{ marginTop: 16, textAlign: 'center', color, fontFamily: 'Georgia, serif', fontSize: 18 }}>{caption}</div> : null}
      </div>
    </TemplateStage>
  );
}

export function SplitScreen({ data, clock }: TemplateProps) {
  const images = readImageUrls(data.props);
  const left = images[0];
  const right = images[1];
  const labels = [
    readNonEmptyString(data.props, 'leftLabel') ?? readNonEmptyString(data.props, 'left_title'),
    readNonEmptyString(data.props, 'rightLabel') ?? readNonEmptyString(data.props, 'right_title'),
  ];
  const color = readColor(data.props, '#fff');
  const leftSlide = clockSpring(clock.frame, clock.fps, 0, { damping: 15, stiffness: 80 });
  const rightSlide = clockSpring(clock.frame, clock.fps, 5, { damping: 15, stiffness: 80 });
  const dividerOpacity = interpolate(clock.frame, [clock.fps * 0.6, clock.fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: '#050505' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', transform: `translateX(${(1 - leftSlide) * -100}%)` }}>
        {left ? (
          <SafeImage src={left} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#111827' }} />
        )}
        {labels[0] ? (
          <div style={{ position: 'absolute', bottom: 32, left: 32, color, fontSize: 28, fontWeight: 800 }}>{labels[0]}</div>
        ) : null}
      </div>
      <div style={{ width: 4, background: color, opacity: dividerOpacity, zIndex: 2 }} />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', transform: `translateX(${(1 - rightSlide) * 100}%)` }}>
        {right ? (
          <SafeImage src={right} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#1f2937' }} />
        )}
        {labels[1] ? (
          <div style={{ position: 'absolute', bottom: 32, right: 32, color, fontSize: 28, fontWeight: 800 }}>{labels[1]}</div>
        ) : null}
      </div>
    </div>
  );
}
