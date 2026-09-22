'use client';

import { interpolate } from 'remotion';
import type { TemplateProps } from '../../../types';
import {
  readChartData,
  readColor,
  readDisplayLines,
  readDisplayText,
  readImageUrl,
  readImageUrls,
  readItemList,
  readNonEmptyString,
  readNumberProp,
} from '../../../props';
import { clockSpring } from '../../../animation';
import {
  CardShell,
  SafeImage,
  TemplateStage,
  chartValues,
  clockProgress,
  formatChartValue,
  maxAbs,
  paletteColor,
} from '../shared';

function motionTranslate(props: Record<string, unknown>, t: number): { x: number; y: number } {
  const motion = props.motion && typeof props.motion === 'object' ? (props.motion as Record<string, unknown>) : null;
  const start = Array.isArray(motion?.start_xy_px) ? motion.start_xy_px : Array.isArray(motion?.startXyPx) ? motion.startXyPx : [0, 0];
  const end = Array.isArray(motion?.end_xy_px) ? motion.end_xy_px : Array.isArray(motion?.endXyPx) ? motion.endXyPx : [0, 0];
  const sx = typeof start[0] === 'number' ? start[0] : 0;
  const sy = typeof start[1] === 'number' ? start[1] : 0;
  const ex = typeof end[0] === 'number' ? end[0] : 0;
  const ey = typeof end[1] === 'number' ? end[1] : 0;
  return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t };
}

/** Original remotion-templates `chart-animation` — SVG bars on a dark board. Distinct from `bar_chart`. */
export function ChartAnimation({ data, clock }: TemplateProps) {
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const rows = chartValues(readChartData(data.props)).slice(0, 10);
  const peak = maxAbs(rows) || 100;
  const w = 900;
  const h = 500;
  const pad = 60;
  const barWidth = rows.length ? ((w - pad * 2) / rows.length) * 0.7 : 40;
  const xAt = (i: number) => (rows.length <= 1 ? w / 2 : (i / (rows.length - 1)) * (w - pad * 2) + pad);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom right, #111827, #1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: w, height: h, background: 'rgba(0,0,0,0.2)', borderRadius: 16, overflow: 'hidden' }}>
        {title ? (
          <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 28, fontWeight: 700, zIndex: 1 }}>
            {title}
          </div>
        ) : null}
        {sub ? (
          <div style={{ position: 'absolute', top: 52, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 16, zIndex: 1 }}>
            {sub}
          </div>
        ) : null}
        <svg width={w} height={h}>
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          {rows.map((row, i) => {
            const barHeight = (Math.abs(row.value) / peak) * (h - pad * 2);
            const progress = interpolate(clock.frame, [i * 3, 15 + i * 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const currentHeight = barHeight * progress;
            const x = xAt(i);
            const y = h - pad - currentHeight;
            const color = row.color || paletteColor(i, '#4361ee');
            return (
              <g key={`${row.label}-${i}`}>
                <rect x={x - barWidth / 2} y={y} width={barWidth} height={currentHeight} fill={color} rx={6} />
                <text x={x} y={h - pad + 25} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="14">
                  {row.label}
                </text>
                <text x={x} y={y - 10} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold" opacity={progress > 0.9 ? 1 : 0}>
                  {formatChartValue(row.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Original `popping-text` — per-letter colored spring. Distinct from `popping_scale_text`. */
export function PoppingText({ data, clock }: TemplateProps) {
  const text = readDisplayText(data.props) || readNonEmptyString(data.props, 'title') || '';
  const chars = Array.from(text);
  const colors = [readColor(data.props, '#1e3a8a'), '#3b82f6', '#A9D6E5'];
  return (
    <TemplateStage>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        {chars.map((ch, i) => {
          const scale = clockSpring(clock.frame, clock.fps, i * 7, { mass: 0.4, damping: 8, stiffness: 100 });
          return (
            <span
              key={`${ch}-${i}`}
              style={{
                display: 'inline-block',
                color: colors[i % colors.length],
                fontSize: 96,
                fontWeight: 900,
                margin: '0 0.06em',
                fontFamily: 'Impact, Arial Black, sans-serif',
                transform: `scale(${scale})`,
                opacity: scale,
                textShadow: `-2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff`,
              }}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          );
        })}
      </div>
    </TemplateStage>
  );
}

/** Original `floating-bubble-text` — large gradient bubble. Distinct from `floating_text_chip`. */
export function FloatingBubbleText({ data, clock }: TemplateProps) {
  const text = readDisplayText(data.props) || readNonEmptyString(data.props, 'title') || '';
  const color = readColor(data.props, '#3b82f6');
  const float = Math.sin(clock.frame / 30) * 20;
  const scale = clockSpring(clock.frame, clock.fps, 0, { damping: 12, mass: 0.5 });
  return (
    <TemplateStage>
      <div
        style={{
          transform: `translateY(${float}px) scale(${scale})`,
          fontSize: 56,
          fontWeight: 800,
          color: '#fff',
          padding: '32px 56px',
          borderRadius: 24,
          background: `linear-gradient(45deg, #1e3a8a, ${color})`,
          boxShadow: '0 8px 32px rgba(30, 58, 138, 0.35)',
        }}
      >
        {text}
      </div>
    </TemplateStage>
  );
}

/** Backend `ken_burns_pan_zoom` — follows authored motion path. Distinct from `ken_burns`. */
export function KenBurnsPanZoom({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const t = clockProgress(clock);
  const { x, y } = motionTranslate(data.props, t);
  const fromScale = readNumberProp(data.props, ['fromScale', 'start_scale', 'startScale']) ?? 1;
  const toScale = readNumberProp(data.props, ['toScale', 'end_scale', 'endScale', 'scale']) ?? 1.18;
  const scale = fromScale + (toScale - fromScale) * t;
  if (!src) return <div style={{ position: 'absolute', inset: 0 }} />;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <SafeImage
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}

/** `image_pip` — small photo frame. Distinct from `picture_in_picture`. */
export function ImagePip({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const caption = readNonEmptyString(data.props, 'caption') ?? readNonEmptyString(data.props, 'label');
  const s = clockSpring(clock.frame, clock.fps, 8, { damping: 11, stiffness: 140 });
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top: 48,
          right: 48,
          width: 280,
          transform: `translateY(${(1 - s) * 24}px) scale(${0.86 + 0.14 * s})`,
          opacity: s,
          background: '#f4f1ea',
          padding: 10,
          paddingBottom: caption ? 40 : 10,
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
          borderRadius: 6,
        }}
      >
        <div style={{ height: 168, overflow: 'hidden', background: '#ddd' }}>
          <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {caption ? (
          <div style={{ marginTop: 8, textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 16, color: '#111' }}>{caption}</div>
        ) : null}
      </div>
    </div>
  );
}

/** `pip_video` — labeled 16:9 video chip. Distinct from `pip_video_frame` overlay box. */
export function PipVideo({ data, clock }: TemplateProps) {
  const src = readImageUrl(data.props);
  const label = readNonEmptyString(data.props, 'title') ?? readNonEmptyString(data.props, 'label') ?? readDisplayText(data.props);
  const s = clockSpring(clock.frame, clock.fps, 4, { damping: 13, stiffness: 120 });
  const color = readColor(data.props, '#ef4444');
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: 56,
          bottom: 56,
          width: 480,
          height: 270,
          borderRadius: 16,
          overflow: 'hidden',
          transform: `translateX(${(1 - s) * 40}px)`,
          opacity: s,
          border: `3px solid ${color}`,
          boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
          background: '#0b0b0f',
        }}
      >
        <SafeImage src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
          {label ? <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{label}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** Remotion-templates split-screen: labeled panels. Distinct from `image_split_screen` and `split_screen_divider`. */
export function SplitScreenPanels({ data, clock }: TemplateProps) {
  const lines = readDisplayLines(data.props);
  const items = readItemList(data.props);
  const leftTitle = readNonEmptyString(data.props, 'leftLabel') ?? readNonEmptyString(data.props, 'left_title') ?? lines[0] ?? items[0];
  const rightTitle = readNonEmptyString(data.props, 'rightLabel') ?? readNonEmptyString(data.props, 'right_title') ?? lines[1] ?? items[1];
  const leftSub = readNonEmptyString(data.props, 'leftSubtitle') ?? readNonEmptyString(data.props, 'left_body');
  const rightSub = readNonEmptyString(data.props, 'rightSubtitle') ?? readNonEmptyString(data.props, 'right_body');
  const images = readImageUrls(data.props);
  const leftSlide = clockSpring(clock.frame, clock.fps, 0, { damping: 15, stiffness: 80 });
  const rightSlide = clockSpring(clock.frame, clock.fps, 5, { damping: 15, stiffness: 80 });
  const dividerOpacity = interpolate(clock.frame, [clock.fps * 0.6, clock.fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden', background: '#111827' }}>
      <div
        style={{
          width: '50%',
          height: '100%',
          transform: `translateX(${(1 - leftSlide) * -100}%)`,
          background: images[0] ? undefined : 'linear-gradient(135deg, #1e3a5f, #1d4ed8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48,
          position: 'relative',
        }}
      >
        {images[0] ? <SafeImage src={images[0]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} /> : null}
        {leftTitle ? <div style={{ color: '#fff', fontSize: 42, fontWeight: 800, zIndex: 1, textAlign: 'center' }}>{leftTitle}</div> : null}
        {leftSub ? <div style={{ color: '#bfdbfe', fontSize: 20, marginTop: 12, zIndex: 1, textAlign: 'center' }}>{leftSub}</div> : null}
      </div>
      <div
        style={{
          width: '50%',
          height: '100%',
          transform: `translateX(${(1 - rightSlide) * 100}%)`,
          background: images[1] ? undefined : 'linear-gradient(135deg, #5b21b6, #7c3aed)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 48,
          position: 'relative',
        }}
      >
        {images[1] ? <SafeImage src={images[1]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} /> : null}
        {rightTitle ? <div style={{ color: '#fff', fontSize: 42, fontWeight: 800, zIndex: 1, textAlign: 'center' }}>{rightTitle}</div> : null}
        {rightSub ? <div style={{ color: '#ddd6fe', fontSize: 20, marginTop: 12, zIndex: 1, textAlign: 'center' }}>{rightSub}</div> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          top: '10%',
          bottom: '10%',
          left: '50%',
          width: 2,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.85), transparent)',
          opacity: dividerOpacity,
        }}
      />
    </div>
  );
}

/** `shake_impact` — decaying jolt, no white flash. Distinct from `shake_impact_flash` and `camera_shake`. */
export function ShakeImpact({ data, clock }: TemplateProps) {
  const text = readDisplayText(data.props);
  const amp = interpolate(clock.frame, [0, Math.max(8, clock.fps * 0.45)], [22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const x = Math.sin(clock.frame * 1.7) * amp;
  const y = Math.cos(clock.frame * 2.1) * amp * 0.6;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${x}px, ${y}px)` }}>
      {text ? (
        <TemplateStage>
          <div style={{ color: readColor(data.props, '#fff'), fontSize: 72, fontWeight: 900 }}>{text}</div>
        </TemplateStage>
      ) : null}
    </div>
  );
}

/** `parallax_layering` — stacked drifting planes. Distinct from `parallax_accent` and `parallax_pan`. */
export function ParallaxLayering({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#3b82f6');
  const t = clockProgress(clock);
  const text = readDisplayText(data.props);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {[0.15, 0.35, 0.6].map((speed, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${8 + i * 18 + t * 12 * (i + 1)}%`,
            top: `${18 + i * 16}%`,
            width: 280 - i * 40,
            height: 180 - i * 20,
            borderRadius: 28,
            background: color,
            opacity: 0.12 + i * 0.1,
            filter: `blur(${8 + i * 6}px)`,
            transform: `translateX(${Math.sin(clock.frame * 0.03 * (i + 1)) * 24}px)`,
          }}
        />
      ))}
      {text ? (
        <div style={{ position: 'absolute', left: 80, bottom: 80, color: '#fff', fontSize: 40, fontWeight: 800 }}>
          {text}
        </div>
      ) : null}
    </div>
  );
}

/** `full_screen_transition` — hard wipe. Distinct from `full_screen_transition_fx` fade. */
export function FullScreenTransition({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#050505');
  const t = clockProgress(clock);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: color,
          transform: `translateX(${(t - 0.5) * 200}%)`,
        }}
      />
    </div>
  );
}

export function QuoteCardTemplate({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const quote = readNonEmptyString(data.props, 'quote') ?? readDisplayText(data.props);
  const who = readNonEmptyString(data.props, 'attribution') ?? readNonEmptyString(data.props, 'subtitle');
  const quoteMarkOpacity = interpolate(clock.frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const textOpacity = interpolate(clock.frame, [10, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const attributionOpacity = interpolate(clock.frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const attributionX = interpolate(clock.frame, [30, 45], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <TemplateStage style={{ background: 'transparent' }}>
      <CardShell style={{ textAlign: 'center', width: 'min(900px, 84%)', background: 'rgba(17,24,39,0.72)' }}>
        <div style={{ fontSize: 96, color, opacity: quoteMarkOpacity, lineHeight: 0.8 }}>“</div>
        <div style={{ color, fontSize: 36, fontFamily: 'Georgia, serif', lineHeight: 1.4, opacity: textOpacity }}>{quote}</div>
        {who ? (
          <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', opacity: attributionOpacity, transform: `translateX(${attributionX}px)` }}>
            — {who}
          </div>
        ) : null}
      </CardShell>
    </TemplateStage>
  );
}
