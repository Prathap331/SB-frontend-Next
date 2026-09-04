'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { InfographicData } from '../types';
import { LucideIconView } from '../icons';
import { readAccentColor, readNonEmptyString, readStringArray, readIconNames } from '../props';
import {
  OVERLAY_DESIGN_W,
  isCenterXPlacement,
  isRightPlacement,
  resolveOverlayGeometry,
} from '../placement';

export type Clock = {
  frame: number;
  fps: number;
  durationInFrames: number;
};

type GeometryPx = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MotionXY = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style?: string;
};

type BaseAnim = {
  type: string;
  text: string;
  lines: string[];
  subtitle?: string;
  quote?: string;
  attribution?: string;
  label?: string;
  caption?: string;
  items: string[];
  color: string;
  placement: string;
  geometry: GeometryPx;
  icons: string[];
  iconLayout?: string;
  highlight?: string;
  motion: MotionXY | null;
};

function defaultGeometry(type: string): GeometryPx {
  switch (type) {
    case 'emoji_reaction':
      return { x: 1696, y: 64, width: 160, height: 160 };
    case 'badge_sticker':
      return { x: 1696, y: 64, width: 200, height: 200 };
    case 'pip_video_frame':
      return { x: 1280, y: 64, width: 576, height: 324 };
    case 'avatar_overlay':
    case 'avatar_overlay_placeholder':
      return { x: 64, y: 64, width: 160, height: 160 };
    case 'mascot_animation':
    case 'mascot_animation_placeholder':
      return { x: 1600, y: 700, width: 260, height: 260 };
    case 'speed_ramp_indicator':
      return { x: 1700, y: 64, width: 160, height: 80 };
    case 'icon_pop_in':
      return { x: 1696, y: 64, width: 160, height: 160 };
    case 'icon_sequence':
    case 'stat_counter_overlay':
      return { x: 64, y: 360, width: 720, height: 280 };
    default:
      return { x: 64, y: 854, width: 520, height: 160 };
  }
}

export function interp(frame: number, input: number[], output: number[]): number {
  if (input.length < 2 || output.length !== input.length) return output[0] ?? 0;
  if (frame <= input[0]) return output[0];
  const last = input.length - 1;
  if (frame >= input[last]) return output[last];
  for (let i = 0; i < last; i++) {
    if (frame >= input[i] && frame <= input[i + 1]) {
      const span = input[i + 1] - input[i] || 1;
      const u = (frame - input[i]) / span;
      return output[i] + (output[i + 1] - output[i]) * u;
    }
  }
  return output[last];
}

function fadeIn(clock: Clock, durationSec = 0.3): number {
  return interp(clock.frame, [0, Math.max(1, clock.fps * durationSec)], [0, 1]);
}

function easeOut(clock: Clock, durationSec = 0.45): number {
  const t = Math.min(1, clock.frame / Math.max(1, clock.fps * durationSec));
  return 1 - (1 - t) ** 3;
}

function Fill({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {children}
    </div>
  );
}

function LucideSvg({
  name,
  size = 64,
  color = 'white',
}: {
  name?: string;
  size?: number;
  color?: string;
}) {
  return <LucideIconView name={name} size={size} color={color} />;
}

function ClockIconRow({
  p,
  clock,
  size = 36,
  stacked = true,
}: {
  p: BaseAnim;
  clock: Clock;
  size?: number;
  stacked?: boolean;
}) {
  if (!p.icons.length) return null;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        marginBottom: stacked ? 16 : 0,
        marginRight: stacked ? 0 : 16,
        flexShrink: 0,
      }}
    >
      {p.icons.map((name, index) => {
        const appear = interp(clock.frame, [index * 6, index * 6 + 8], [0, 1]);
        return (
          <div
            key={`${name}-${index}`}
            style={{
              opacity: appear,
              transform: `scale(${0.75 + 0.25 * appear})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size + 20,
              height: size + 20,
              borderRadius: 14,
              backgroundColor: 'rgba(12, 16, 22, 0.55)',
              boxShadow: `0 0 16px ${p.color}44`,
            }}
          >
            <LucideSvg name={name} size={size} color={p.color} />
          </div>
        );
      })}
    </div>
  );
}

function readGeometry(
  props: Record<string, unknown>,
  type: string,
  placement: string | undefined,
): GeometryPx {
  const defaults = defaultGeometry(type);
  const raw = props.geometryPx;
  let parsed: Partial<GeometryPx> | null = null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const g = raw as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    parsed = {
      x: n(g.x),
      y: n(g.y),
      width: n(g.width),
      height: n(g.height),
    };
  }
  return resolveOverlayGeometry(parsed, placement, defaults);
}

function readMotion(props: Record<string, unknown>): MotionXY | null {
  const raw = props.motion;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const startX = n(rec.startX);
  const startY = n(rec.startY);
  const endX = n(rec.endX);
  const endY = n(rec.endY);
  const style = typeof rec.style === 'string' ? rec.style : undefined;
  if (startX == null && startY == null && endX == null && endY == null) return null;
  return {
    startX: startX ?? endX ?? 0,
    startY: startY ?? endY ?? 0,
    endX: endX ?? startX ?? 0,
    endY: endY ?? startY ?? 0,
    style,
  };
}

function displayTextOf(props: Record<string, unknown>): { text: string; lines: string[] } {
  const raw = props.displayText;
  if (typeof raw === 'string' && raw.trim()) return { text: raw.trim(), lines: [raw.trim()] };
  if (Array.isArray(raw)) {
    const lines = raw.filter((v): v is string => typeof v === 'string' && Boolean(v.trim()));
    return { text: lines.join(' '), lines };
  }
  const title = readNonEmptyString(props, 'title');
  const items = readStringArray(props, 'items');
  const quote = readNonEmptyString(props, 'quote');
  const label = readNonEmptyString(props, 'label');
  const lines = [...(title ? [title] : []), ...items];
  return { text: quote || label || lines.join(' '), lines };
}

function readBase(data: InfographicData): BaseAnim {
  const type = (data.animation_type || '').trim().toLowerCase();
  const { text, lines } = displayTextOf(data.props);
  const icons = readIconNames(data.props);
  const placement =
    data.placement ||
    (typeof data.props.placement === 'string' ? data.props.placement : '');
  return {
    type,
    text,
    lines,
    subtitle: readNonEmptyString(data.props, 'subtitle'),
    quote: readNonEmptyString(data.props, 'quote'),
    attribution: readNonEmptyString(data.props, 'attribution'),
    label: readNonEmptyString(data.props, 'label'),
    caption: readNonEmptyString(data.props, 'caption'),
    items: readStringArray(data.props, 'items'),
    color: readAccentColor(data.props, '#F5A623'),
    placement,
    geometry: readGeometry(data.props, type, placement),
    icons,
    iconLayout:
      typeof data.props.iconLayout === 'string' ? data.props.iconLayout : undefined,
    highlight: readNonEmptyString(data.props, 'highlightTargetText'),
    motion: readMotion(data.props),
  };
}

function motionProgress(clock: Clock, motion: MotionXY | null): number {
  if (!motion) return 1;
  const style = (motion.style || '').toLowerCase();
  const popFast = style.includes('pop') || style.includes('bounce');
  const span = popFast
    ? Math.max(1, Math.round(clock.fps * 0.4))
    : Math.max(1, clock.durationInFrames - 1);
  const raw = Math.min(1, clock.frame / span);
  return popFast ? 1 - (1 - raw) ** 3 : raw;
}

function xyAt(clock: Clock, p: BaseAnim): { x: number; y: number } {
  const { geometry: g, motion } = p;
  if (!motion) return { x: g.x, y: g.y };
  const t = motionProgress(clock, motion);
  return {
    x: motion.startX + (motion.endX - motion.startX) * t,
    y: motion.startY + (motion.endY - motion.startY) * t,
  };
}

/** Scale 80% → 100% with a slight bounce overshoot when motion_style asks for it. */
function popScaleAt(clock: Clock, motion: MotionXY | null): number {
  const style = (motion?.style || '').toLowerCase();
  const bounce = style.includes('bounce') || style.includes('pop');
  const dur = Math.max(1, clock.fps * (bounce ? 0.42 : 0.35));
  const t = Math.min(1, clock.frame / dur);
  if (!bounce) return 0.8 + 0.2 * (1 - (1 - t) ** 3);
  if (t < 0.72) {
    const u = t / 0.72;
    return 0.8 + 0.26 * (1 - (1 - u) ** 3);
  }
  const u = (t - 0.72) / 0.28;
  return 1.06 - 0.06 * (1 - (1 - u) ** 2);
}

function box(p: BaseAnim, clock: Clock, extra?: CSSProperties): CSSProperties {
  const { x, y } = xyAt(clock, p);
  return {
    position: 'absolute',
    left: x,
    top: y,
    width: p.geometry.width,
    height: p.geometry.height,
    ...extra,
  };
}

/** Clock-driven visuals matching the render-service taxonomy compositions. */
export function TaxonomyVisual({ data, clock }: { data: InfographicData; clock: Clock }) {
  const p = readBase(data);
  const type = p.type;

  switch (type) {
    case 'full_screen_broll':
    case 'ken_burns':
    case 'ken_burns_pan_zoom':
      return <Fill />;
    case 'full_screen_transition_fx':
      return <FullScreenTransitionFx p={p} clock={clock} />;
    case 'full_screen_color_wash':
      return <FullScreenColorWash p={p} clock={clock} />;
    case 'full_screen_document_highlight':
      return <DocumentHighlight p={p} clock={clock} />;
    case 'lower_third':
      return <LowerThird p={p} clock={clock} />;
    case 'kinetic_caption':
      return <KineticCaption p={p} clock={clock} />;
    case 'callout_textbox':
    case 'callout':
      return <CalloutTextbox p={p} clock={clock} />;
    case 'logo_watermark':
      return <LogoWatermark p={p} clock={clock} />;
    case 'emoji_reaction':
      return <EmojiReaction p={p} clock={clock} />;
    case 'arrow_highlight':
      return <ArrowHighlight p={p} clock={clock} />;
    case 'badge_sticker':
      return <BadgeSticker p={p} clock={clock} />;
    case 'pip_video_frame':
      return <PipFrame p={p} clock={clock} />;
    case 'split_screen_divider':
      return <SplitDivider p={p} clock={clock} />;
    case 'multi_panel_grid':
      return <MultiPanelGrid p={p} clock={clock} />;
    case 'avatar_overlay':
    case 'avatar_overlay_placeholder':
      return <AvatarPlaceholder p={p} clock={clock} />;
    case 'mascot_animation':
    case 'mascot_animation_placeholder':
      return <MascotPlaceholder p={p} clock={clock} />;
    case 'parallax_accent':
      return <ParallaxAccent p={p} clock={clock} />;
    case 'shake_impact_flash':
      return <ShakeFlash clock={clock} />;
    case 'speed_ramp_indicator':
      return <SpeedRamp p={p} clock={clock} />;
    case 'icon_sequence':
    case 'icon_pop_in':
      return <IconGraphic p={p} clock={clock} />;
    case 'stat_counter_overlay':
      return p.icons.length ? <IconGraphic p={p} clock={clock} /> : <StatCounter p={p} clock={clock} />;
    case 'full_screen_title_card':
      return <TitleCardVisual p={p} clock={clock} />;
    case 'full_screen_quote_card':
      return <QuoteCardVisual p={p} clock={clock} />;
    case 'full_screen_data_viz':
      return <DataVizVisual p={p} clock={clock} />;
    case 'bullet_list_reveal':
      return <BulletListVisual p={p} clock={clock} />;
    default:
      if (p.icons.length) return <IconGraphic p={p} clock={clock} />;
      if (p.text) return <CalloutTextbox p={p} clock={clock} />;
      return <Fill />;
  }
}

function FullScreenTransitionFx({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const fadeInOp = interp(clock.frame, [0, clock.fps * 0.25], [0, 0.6]);
  const fadeOutOp = interp(
    clock.frame,
    [clock.durationInFrames - clock.fps * 0.25, clock.durationInFrames],
    [0.6, 0],
  );
  const opacity = clock.frame > clock.durationInFrames / 2 ? fadeOutOp : fadeInOp;
  return <Fill style={{ background: p.color, opacity }} />;
}

function FullScreenColorWash({ p, clock }: { p: BaseAnim; clock: Clock }) {
  return <Fill style={{ background: p.color, opacity: fadeIn(clock, 0.4) * 0.5 }} />;
}

function DocumentHighlight({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const sweep = interp(clock.frame, [clock.fps * 1, clock.fps * 2.5], [0, 100]);
  const copy = p.highlight || p.text;
  return (
    <Fill style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', padding: 120 }}>
      <div
        style={{
          position: 'relative',
          fontFamily: 'Georgia, serif',
          fontSize: 56,
          color: '#111827',
          background: 'white',
          padding: 48,
          borderRadius: 12,
          maxWidth: 1400,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            height: '1.2em',
            width: `${sweep}%`,
            background: p.color,
            opacity: 0.55,
            zIndex: 0,
            transform: 'translateY(-50%)',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1 }}>{copy}</span>
      </div>
    </Fill>
  );
}

function LowerThird({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const enter = easeOut(clock, 0.4);
  const translateX = -40 + 40 * enter;
  const opacity = fadeIn(clock, 0.3);
  return (
    <Fill>
      <div
        style={box(p, clock, {
          transform: `translateX(${translateX}px)`,
          opacity,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 16,
          background: 'rgba(0,0,0,0.55)',
          borderLeft: `6px solid ${p.color}`,
        })}
      >
        <ClockIconRow p={p} clock={clock} size={32} stacked={false} />
        <span style={{ color: 'white', fontSize: 40, fontWeight: 700, fontFamily: 'Arial Black, sans-serif' }}>
          {p.text}
        </span>
      </div>
    </Fill>
  );
}

function KineticCaption({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const pop = easeOut(clock, 0.35);
  const opacity = fadeIn(clock, 0.15);
  return (
    <Fill>
      <div
        style={box(p, clock, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${0.8 + 0.2 * pop})`,
          opacity,
          flexDirection: 'column',
          gap: 12,
        })}
      >
        <ClockIconRow p={p} clock={clock} size={40} />
        <span
          style={{
            color: 'white',
            fontSize: 56,
            fontWeight: 900,
            textShadow: `0 0 20px ${p.color}`,
            textAlign: 'center',
          }}
        >
          {p.text}
        </span>
      </div>
    </Fill>
  );
}

function CalloutTextbox({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.25);
  return (
    <Fill>
      <div
        style={box(p, clock, {
          opacity,
          background: 'rgba(17,24,39,0.85)',
          border: `2px solid ${p.color}`,
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          gap: 16,
        })}
      >
        <ClockIconRow p={p} clock={clock} size={32} stacked={false} />
        <span style={{ color: 'white', fontSize: 34, fontWeight: 600, lineHeight: 1.3 }}>
          {p.lines.length > 1 ? p.lines.join('\n') : p.text}
        </span>
      </div>
    </Fill>
  );
}

function LogoWatermark({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.5) * 0.85;
  return (
    <Fill>
      <div
        style={box(p, clock, {
          opacity,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        })}
      >
        <LucideSvg name={p.icons[0]} size={32} color={p.color} />
        {p.text ? (
          <span style={{ color: 'white', fontSize: 26, fontWeight: 700 }}>{p.text}</span>
        ) : null}
      </div>
    </Fill>
  );
}

function EmojiReaction({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const bounce = easeOut(clock, 0.4);
  const size = Math.min(p.geometry.width, p.geometry.height);
  return (
    <Fill>
      <div
        style={box(p, clock, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${bounce}) translateY(${(1 - bounce) * 20}px)`,
        })}
      >
        <LucideSvg name={p.icons[0] || 'sparkles'} size={size * 0.7} color={p.color} />
      </div>
    </Fill>
  );
}

function ArrowHighlight({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const pulse = 1 + 0.08 * Math.sin((clock.frame / clock.fps) * Math.PI * 3);
  const sx = p.motion?.startX ?? p.geometry.x;
  const sy = p.motion?.startY ?? p.geometry.y;
  const ex = p.motion?.endX ?? p.geometry.x + p.geometry.width;
  const ey = p.motion?.endY ?? p.geometry.y + p.geometry.height;
  const angle = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
  const length = Math.hypot(ex - sx, ey - sy) || 100;
  return (
    <Fill>
      <svg
        style={{
          position: 'absolute',
          left: sx,
          top: sy,
          transform: `rotate(${angle}deg) scale(${pulse})`,
          transformOrigin: '0 50%',
        }}
        width={length}
        height={40}
      >
        <line x1={0} y1={20} x2={length - 20} y2={20} stroke={p.color} strokeWidth={6} />
        <polygon points={`${length - 20},8 ${length},20 ${length - 20},32`} fill={p.color} />
      </svg>
    </Fill>
  );
}

function BadgeSticker({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const pop = easeOut(clock, 0.4);
  const rotate = -15 + 7 * pop;
  const size = Math.min(p.geometry.width, p.geometry.height);
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: xyAt(clock, p).x,
          top: xyAt(clock, p).y,
          width: size,
          height: size,
          borderRadius: '50%',
          background: p.color,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pop}) rotate(${rotate}deg)`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      >
        <LucideSvg name={p.icons[0]} size={size * 0.35} color="white" />
        {p.text ? (
          <span style={{ color: 'white', fontSize: size * 0.14, fontWeight: 800, marginTop: 4 }}>
            {p.text}
          </span>
        ) : null}
      </div>
    </Fill>
  );
}

function PipFrame({ p, clock }: { p: BaseAnim; clock: Clock }) {
  return (
    <Fill>
      <div
        style={box(p, clock, {
          border: `4px solid ${p.color}`,
          borderRadius: 12,
          opacity: fadeIn(clock, 0.3),
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          background: 'rgba(0,0,0,0.2)',
        })}
      />
    </Fill>
  );
}

function SplitDivider({ p, clock }: { p: BaseAnim; clock: Clock }) {
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 4,
          background: p.color,
          opacity: fadeIn(clock, 0.3),
          transform: 'translateX(-2px)',
        }}
      />
    </Fill>
  );
}

function MultiPanelGrid({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.3);
  return (
    <Fill style={{ opacity }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 3,
          background: p.color,
          transform: 'translateX(-1.5px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 3,
          background: p.color,
          transform: 'translateY(-1.5px)',
        }}
      />
    </Fill>
  );
}

function AvatarPlaceholder({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const size = Math.min(p.geometry.width, p.geometry.height);
  const { x, y } = xyAt(clock, p);
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: '50%',
          border: `3px solid ${p.color}`,
          opacity: fadeIn(clock, 0.3),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(17,24,39,0.6)',
        }}
      >
        <LucideSvg name={p.icons[0] || 'user'} size={size * 0.5} color={p.color} />
      </div>
    </Fill>
  );
}

function MascotPlaceholder({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const bob = Math.sin((clock.frame / clock.fps) * Math.PI * 2) * 10;
  const { x, y } = xyAt(clock, p);
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y + bob,
          width: p.geometry.width,
          height: p.geometry.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LucideSvg
          name={p.icons[0] || 'sparkles'}
          size={Math.min(p.geometry.width, p.geometry.height) * 0.7}
          color={p.color}
        />
      </div>
    </Fill>
  );
}

function ParallaxAccent({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const drift = Math.sin((clock.frame / clock.fps) * Math.PI) * 30;
  return (
    <Fill style={{ opacity: fadeIn(clock, 0.4) * 0.25 }}>
      <div
        style={{
          position: 'absolute',
          left: `calc(50% + ${drift}px)`,
          top: '20%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: p.color,
          filter: 'blur(120px)',
        }}
      />
    </Fill>
  );
}

function ShakeFlash({ clock }: { clock: Clock }) {
  const opacity = interp(clock.frame, [0, clock.fps * 0.05, clock.fps * 0.25], [0, 0.85, 0]);
  return <Fill style={{ background: 'white', opacity }} />;
}

function SpeedRamp({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const { x, y } = xyAt(clock, p);
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          opacity: fadeIn(clock, 0.15),
          color: p.color,
          fontSize: 56,
          fontWeight: 900,
          fontFamily: 'Arial Black, sans-serif',
        }}
      >
        »»
      </div>
    </Fill>
  );
}

function IconGraphic({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const names = p.icons;
  const layout = (p.iconLayout || (names.length > 1 ? 'sequence' : 'cluster')).toLowerCase();
  const isPop = p.type === 'icon_pop_in' || names.length <= 1;
  const { x, y } = xyAt(clock, p);
  const iconBox = isPop
    ? Math.max(96, Math.min(p.geometry.width, p.geometry.height) || 160)
    : Math.max(88, Math.min(112, p.geometry.height * 0.45 || 88));
  const iconSize = Math.round(iconBox * 0.58);
  const connect = (p.motion?.style || p.type).toLowerCase().includes('connect');
  const growLeft = isRightPlacement(p.placement) || x > OVERLAY_DESIGN_W * 0.62;
  const alignItems = growLeft
    ? 'flex-end'
    : isCenterXPlacement(p.placement)
      ? 'center'
      : 'flex-start';
  const textAlign = growLeft ? 'right' : alignItems === 'center' ? 'center' : 'left';
  const iconSpan = isPop ? iconBox : p.geometry.width;
  const scale = isPop ? popScaleAt(clock, p.motion) : 1;
  return (
    <Fill>
      <div
        style={{
          position: 'absolute',
          left: growLeft ? undefined : x,
          right: growLeft ? OVERLAY_DESIGN_W - (x + iconSpan) : undefined,
          top: y,
          display: 'flex',
          flexDirection: 'column',
          alignItems,
          gap: 14,
          maxWidth: 420,
          overflow: 'visible',
          opacity: fadeIn(clock, 0.2),
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: layout === 'stack' ? 'column' : 'row',
            flexWrap: layout === 'cluster' ? 'wrap' : undefined,
            alignItems: 'center',
            justifyContent: growLeft ? 'flex-end' : 'flex-start',
            gap: layout === 'pair' ? 28 : 16,
            transform: `scale(${scale})`,
            transformOrigin: growLeft ? 'top right' : 'top left',
          }}
        >
          {names.map((name, index) => {
            const appear = isPop
              ? 1
              : interp(clock.frame, [index * 6, index * 6 + 8], [0, 1]);
            return (
              <Fragment key={`${name}-${index}`}>
                {connect && index > 0 ? (
                  <div
                    style={{
                      width: layout === 'stack' ? 2 : 28,
                      height: layout === 'stack' ? 24 : 2,
                      backgroundColor: `${p.color}66`,
                      opacity: appear,
                      boxShadow: `0 0 10px ${p.color}88`,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    opacity: appear,
                    transform: `scale(${0.75 + 0.25 * appear})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: iconBox,
                    height: iconBox,
                    flexShrink: 0,
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    boxShadow: `0 8px 28px ${p.color}99, 0 0 0 6px rgba(255,255,255,0.18)`,
                  }}
                >
                  <LucideSvg name={name} size={iconSize} color="#ffffff" />
                </div>
              </Fragment>
            );
          })}
        </div>
        {p.text ? (
          <span
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1.25,
              textAlign,
              maxWidth: 400,
              textShadow: '0 2px 12px rgba(0,0,0,0.7)',
              whiteSpace: 'normal',
            }}
          >
            {p.text}
          </span>
        ) : null}
      </div>
    </Fill>
  );
}

function TitleCardVisual({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.45);
  const y = 28 * (1 - easeOut(clock, 0.45));
  const title = p.lines[0] || p.text;
  const subtitle = p.subtitle || p.lines[1];
  return (
    <Fill
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 55%), linear-gradient(160deg, #12121a 0%, #0b0b0f 50%, #16120e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, color: p.color }}>
        <ClockIconRow p={p} clock={clock} size={44} />
        <div style={{ width: 64, height: 2, backgroundColor: p.color, margin: '0 auto 28px' }} />
        <div style={{ fontSize: 72, fontWeight: 600, fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              color: 'rgba(245,245,247,0.72)',
              fontSize: 28,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </Fill>
  );
}

function QuoteCardVisual({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.5);
  const y = 20 * (1 - easeOut(clock, 0.45));
  const quote = p.quote || p.highlight || p.text;
  return (
    <Fill
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, rgba(212,175,55,0.12) 0%, transparent 50%), linear-gradient(165deg, #141820 0%, #0e1116 55%, #12100c 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 120px',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${y}px)`, maxWidth: 1400 }}>
        <ClockIconRow p={p} clock={clock} size={44} />
        <div style={{ fontSize: 96, lineHeight: 1, color: 'rgba(212,175,55,0.85)', marginBottom: 12 }}>“</div>
        <div
          style={{
            color: p.color,
            fontSize: 48,
            fontWeight: 500,
            fontFamily: 'Georgia, serif',
            lineHeight: 1.35,
          }}
        >
          {quote}
        </div>
        {p.attribution ? (
          <div
            style={{
              marginTop: 28,
              color: 'rgba(242,240,234,0.65)',
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            — {p.attribution}
          </div>
        ) : null}
      </div>
    </Fill>
  );
}

function DataVizVisual({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.4);
  const scale = 0.92 + 0.08 * easeOut(clock, 0.45);
  const bar = interp(clock.frame, [0, clock.fps * 0.5], [0, 120]);
  const label = p.label || p.lines[0] || p.text;
  const caption = p.caption || p.subtitle || p.lines.slice(1).join(' ');
  return (
    <Fill
      style={{
        background:
          'radial-gradient(circle at 50% 40%, rgba(56,189,248,0.14) 0%, transparent 45%), linear-gradient(180deg, #10141c 0%, #0a0c10 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${scale})` }}>
        <ClockIconRow p={p} clock={clock} size={44} />
        <div
          style={{
            color: '#f8fafc',
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: bar,
            height: 3,
            backgroundColor: p.color,
            margin: '28px auto 0',
            borderRadius: 2,
          }}
        />
        {caption ? (
          <div
            style={{
              margin: '28px auto 0',
              maxWidth: 780,
              color: 'rgba(226,232,240,0.78)',
              fontSize: 26,
              lineHeight: 1.45,
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </Fill>
  );
}

function BulletListVisual({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const opacity = fadeIn(clock, 0.4);
  const title = p.lines[0] && p.items.length ? p.lines[0] : p.text && p.items.length ? p.text : undefined;
  const items = p.items.length ? p.items : p.lines;
  return (
    <Fill
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 55%), #0a0c10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 160px',
        opacity,
      }}
    >
      <div style={{ width: '100%', maxWidth: 900 }}>
        <ClockIconRow p={p} clock={clock} size={40} />
        {title ? (
          <div
            style={{
              margin: '0 0 28px',
              color: '#f5f5f7',
              fontSize: 40,
              fontWeight: 650,
            }}
          >
            {title}
          </div>
        ) : null}
        {items.map((item, index) => {
          const appear = interp(clock.frame, [index * 7, index * 7 + 8], [0, 1]);
          return (
            <div
              key={`${index}-${item.slice(0, 24)}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                marginBottom: 18,
                opacity: appear,
                transform: `translateY(${16 * (1 - appear)}px)`,
                color: '#f2f0ea',
                fontSize: 32,
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  marginTop: 12,
                  flexShrink: 0,
                  backgroundColor: p.color,
                }}
              />
              <span>{item}</span>
            </div>
          );
        })}
      </div>
    </Fill>
  );
}

function StatCounter({ p, clock }: { p: BaseAnim; clock: Clock }) {
  const raw = p.label || p.text;
  const match = raw.match(/-?\d+(\.\d+)?/);
  const target = match ? Number(match[0]) : null;
  const t = easeOut(clock, 0.85);
  const prefix = match ? raw.slice(0, match.index) : '';
  const suffix = match ? raw.slice((match.index ?? 0) + match[0].length) : '';
  const value =
    target == null
      ? raw
      : Number.isInteger(target)
        ? `${prefix}${Math.round(target * t)}${suffix}`
        : `${prefix}${(target * t).toFixed(1)}${suffix}`;
  const opacity = fadeIn(clock, 0.3);
  return (
    <Fill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            color: p.color,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontFamily: 'Arial Black, system-ui, sans-serif',
          }}
        >
          {value}
        </div>
        {p.caption || p.subtitle ? (
          <div style={{ marginTop: 18, color: 'rgba(245,245,247,0.75)', fontSize: 28 }}>
            {p.caption || p.subtitle}
          </div>
        ) : null}
      </div>
    </Fill>
  );
}
