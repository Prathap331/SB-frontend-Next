'use client';

import React, { type CSSProperties } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { InfographicData } from '../types';
import { contentPanelStyle, isFullFramePlacement, rootFillStyle } from '../placement';
import { itemRevealOpacity, springScale, useFadeWindow } from '../animation';
import { readAccentColor, readNonEmptyString, readString, readStringArray, readIconNames } from '../props';
import { LucideIconView } from '../icons';

type LayoutProps = {
  data: InfographicData;
};

type OverlayMotion = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  style?: string;
};

function readGeometryPx(props: Record<string, unknown>): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  const raw = props.geometryPx;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const x = num(rec.x);
  const y = num(rec.y);
  const width = num(rec.width);
  const height = num(rec.height);
  if (x == null && y == null && width == null && height == null) return null;
  return {
    x: x ?? 64,
    y: y ?? 854,
    width: Math.max(1, width ?? 520),
    height: Math.max(1, height ?? 160),
  };
}

function readOverlayMotion(props: Record<string, unknown>): OverlayMotion | null {
  const raw = props.motion;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const startX = num(rec.startX);
  const startY = num(rec.startY);
  const endX = num(rec.endX);
  const endY = num(rec.endY);
  const style = typeof rec.style === 'string' ? rec.style : undefined;
  if (startX == null && startY == null && endX == null && endY == null && !style) return null;
  return {
    startX: startX ?? endX ?? 0,
    startY: startY ?? endY ?? 0,
    endX: endX ?? startX ?? 0,
    endY: endY ?? startY ?? 0,
    style,
  };
}

function motionFlavor(styleKey: string, frame: number, fadeInEnd: number, fps: number) {
  let extraX = 0;
  let extraY = 0;
  let scale = 1;
  if (styleKey.includes('slide_in_left') || styleKey.includes('slide left')) {
    extraX = interpolate(frame, [0, fadeInEnd], [-48, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (styleKey.includes('slide_in_right') || styleKey.includes('slide right')) {
    extraX = interpolate(frame, [0, fadeInEnd], [48, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (
    styleKey.includes('slide_up') ||
    styleKey.includes('rise') ||
    styleKey.includes('cascad')
  ) {
    extraY = interpolate(frame, [0, fadeInEnd], [28, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (styleKey.includes('slide_down')) {
    extraY = interpolate(frame, [0, fadeInEnd], [-28, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }
  if (
    styleKey.includes('pop') ||
    styleKey.includes('zoom') ||
    styleKey.includes('bounce') ||
    styleKey.includes('icon')
  ) {
    scale = springScale(frame, fps);
  }
  return { extraX, extraY, scale };
}

/**
 * Shared wrapper: interpolates start_xy_px → end_xy_px and applies motion_style.
 */
export function OverlayMotionFrame({
  data,
  children,
  bare = false,
}: {
  data: InfographicData;
  children: React.ReactNode;
  bare?: boolean;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const fade = useFadeWindow(frame, durationInFrames, fps);
  const motion = readOverlayMotion(data.props);
  const geometry = readGeometryPx(data.props);
  const styleKey = `${motion?.style || ''} ${data.animation_type || ''}`.toLowerCase();
  const flavor = motionFlavor(styleKey, frame, fade.fadeInEnd, fps);
  const color = readAccentColor(data.props, '#6F7F93');
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isFull = isFullFramePlacement(data.placement);
  const hasPixel = Boolean(motion || geometry) && !isFull;
  const x = motion
    ? motion.startX + (motion.endX - motion.startX) * t
    : (geometry?.x ?? 0);
  const y = motion
    ? motion.startY + (motion.endY - motion.startY) * t
    : (geometry?.y ?? 0);
  const glow = styleKey.includes('glow') ? `drop-shadow(0 0 18px ${color}99)` : undefined;

  const panel: CSSProperties =
    hasPixel || bare
      ? {
          position: 'absolute',
          left: hasPixel ? x : undefined,
          top: hasPixel ? y : undefined,
          ...(hasPixel ? {} : contentPanelStyle(data.placement)),
          backgroundColor: 'transparent',
          backdropFilter: 'none',
          padding: hasPixel ? 0 : 8,
          width: hasPixel ? (geometry?.width ?? 'auto') : undefined,
          height: hasPixel ? (geometry?.height ?? undefined) : undefined,
          maxWidth: hasPixel ? undefined : 720,
        }
      : contentPanelStyle(data.placement);

  const baseTransform = typeof panel.transform === 'string' ? panel.transform : '';

  return (
    <AbsoluteFill style={rootFillStyle(data.placement)}>
      {isFull ? (
        <AbsoluteFill
          style={{
            backgroundColor: '#0b0b0f',
            backgroundImage:
              'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 55%)',
          }}
        />
      ) : null}
      <div
        style={{
          ...panel,
          opacity: fade.opacity,
          transform: `${baseTransform} translate(${flavor.extraX}px, ${flavor.extraY}px) scale(${flavor.scale})`.trim(),
          filter: glow,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

/** Icon sequence / single icon pop from `icon_name` / `iconName`. */
export function IconOverlayLayout({ data }: LayoutProps) {
  const resolvedIcons = readIconNames(data.props);
  if (resolvedIcons.length === 0) return <OverlayTextLayout data={data} />;
  return <IconSequenceInner data={data} icons={resolvedIcons} />;
}

function IconSequenceInner({ data, icons }: LayoutProps & { icons: string[] }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart } = useFadeWindow(frame, durationInFrames, fps);
  const color = readAccentColor(data.props, '#6F7F93');
  const layout = (readString(data.props, 'iconLayout') ?? 'sequence').toLowerCase();
  const isPop = (data.animation_type || '').toLowerCase() === 'icon_pop_in' || icons.length <= 1;
  const connect = `${readOverlayMotion(data.props)?.style || ''} ${data.animation_type || ''}`
    .toLowerCase()
    .includes('connect');
  const title = readNonEmptyString(data.props, 'title');
  const textItems = readStringArray(data.props, 'items');

  return (
    <OverlayMotionFrame data={data} bare>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isFullFramePlacement(data.placement) ? 'center' : 'flex-start',
          gap: 20,
        }}
      >
      <div
        style={{
          display: 'flex',
          flexDirection: layout === 'stack' ? 'column' : 'row',
          alignItems: 'center',
          gap: 28,
        }}
      >
        {icons.map((name, index) => {
          const itemOpacity = isPop
            ? 1
            : itemRevealOpacity(frame, index, fadeInEnd, fadeOutStart, durationInFrames, 8);
          const scale = springScale(frame, fps, isPop ? 0 : index * 6);
          return (
            <React.Fragment key={`${name}-${index}`}>
              {connect && index > 0 ? (
                <div
                  style={{
                    width: layout === 'stack' ? 2 : 36,
                    height: layout === 'stack' ? 28 : 2,
                    backgroundColor: `${color}66`,
                    opacity: itemOpacity,
                    boxShadow: `0 0 10px ${color}88`,
                  }}
                />
              ) : null}
              <div
                style={{
                  opacity: itemOpacity,
                  transform: `scale(${scale})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 88,
                  height: 88,
                  borderRadius: 20,
                  backgroundColor: 'rgba(12, 16, 22, 0.55)',
                  boxShadow: `0 0 22px ${color}44`,
                }}
              >
                <LucideIconView name={name} size={52} color={color} />
              </div>
            </React.Fragment>
          );
        })}
      </div>
        {title ? (
          <div
            style={{
              color,
              fontSize: isFullFramePlacement(data.placement) ? 48 : 28,
              fontWeight: 650,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
        ) : null}
        {textItems.map((item, index) => (
          <div
            key={`${index}-${item.slice(0, 20)}`}
            style={{
              color,
              fontSize: 22,
              fontWeight: 500,
              opacity: itemRevealOpacity(
                frame,
                icons.length + index,
                fadeInEnd,
                fadeOutStart,
                durationInFrames,
                8,
              ),
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </OverlayMotionFrame>
  );
}

/** Lower-third / nameplate for text_list items. */
export function LowerThirdLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart } = useFadeWindow(frame, durationInFrames, fps);
  const title = readNonEmptyString(data.props, 'title');
  const items = readStringArray(data.props, 'items');
  const color = readAccentColor(data.props);
  const lines = title ? [title, ...items] : items;

  return (
    <OverlayMotionFrame data={data} bare>
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 16,
          padding: '14px 22px 14px 0',
          backgroundColor: 'rgba(8, 10, 14, 0.72)',
          borderRadius: 6,
          minWidth: 280,
        }}
      >
        <div
          style={{
            width: 5,
            borderRadius: 4,
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}88`,
          }}
        />
        <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color }}>
          {lines.map((line, index) => (
            <div
              key={`${index}-${line.slice(0, 20)}`}
              style={{
                opacity: itemRevealOpacity(frame, index, fadeInEnd, fadeOutStart, durationInFrames, 6),
                transform: `translateY(${interpolate(
                  frame,
                  [Math.floor(fadeInEnd * 0.3) + index * 6, Math.floor(fadeInEnd * 0.3) + index * 6 + 8],
                  [12, 0],
                  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                )}px)`,
                fontSize: index === 0 ? 32 : 20,
                fontWeight: index === 0 ? 650 : 500,
                letterSpacing: '-0.02em',
                marginTop: index === 0 ? 0 : 6,
                color: index === 0 ? color : 'rgba(245,245,247,0.75)',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </OverlayMotionFrame>
  );
}

/** text_list overlays: stagger items the same way bullet infographics do. */
export function OverlayTextLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart } = useFadeWindow(frame, durationInFrames, fps);
  const title = readNonEmptyString(data.props, 'title');
  const items = readStringArray(data.props, 'items');
  const color = readAccentColor(data.props);
  const styleKey = `${readOverlayMotion(data.props)?.style || ''} ${data.animation_type || ''}`.toLowerCase();
  const typewriter = styleKey.includes('typewriter');
  const visibleTitle =
    typewriter && title
      ? title.slice(
          0,
          Math.max(
            0,
            Math.floor(
              interpolate(frame, [0, Math.max(1, fadeInEnd + 12)], [0, title.length], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            ),
          ),
        )
      : title;

  return (
    <OverlayMotionFrame data={data}>
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color }}>
        {visibleTitle ? (
          <h2 style={{ margin: '0 0 14px', fontSize: 36, fontWeight: 650, letterSpacing: '-0.02em' }}>
            {visibleTitle}
          </h2>
        ) : null}
        {items.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item, index) => {
              const itemOpacity = itemRevealOpacity(
                frame,
                index,
                fadeInEnd,
                fadeOutStart,
                durationInFrames,
                7,
              );
              const itemY = interpolate(
                frame,
                [
                  Math.floor(fadeInEnd * 0.35) + index * 7,
                  Math.floor(fadeInEnd * 0.35) + index * 7 + 8,
                ],
                [16, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return (
                <li
                  key={`${index}-${item.slice(0, 20)}`}
                  style={{
                    marginBottom: 12,
                    opacity: itemOpacity,
                    transform: `translateY(${itemY}px)`,
                    fontSize: 24,
                    fontWeight: 550,
                    lineHeight: 1.35,
                  }}
                >
                  {item}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </OverlayMotionFrame>
  );
}

/**
 * Icon row for layouts that are not icon-first (title / quote / data-viz / bullets).
 * Renders whatever `icon_name` the backend sent — one name or a list — so an icon is
 * never silently dropped just because the animation type is not `icon_*`.
 */
export function IconRow({
  data,
  size = 44,
  align = 'center',
}: {
  data: InfographicData;
  size?: number;
  align?: 'center' | 'flex-start';
}) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart } = useFadeWindow(frame, durationInFrames, fps);
  const icons = readIconNames(data.props);
  const color = readAccentColor(data.props);
  if (icons.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: align,
        gap: 18,
        marginBottom: 24,
      }}
    >
      {icons.map((name, index) => (
        <div
          key={`${name}-${index}`}
          style={{
            opacity: itemRevealOpacity(frame, index, fadeInEnd, fadeOutStart, durationInFrames, 6),
            transform: `scale(${springScale(frame, fps, index * 5)})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size + 28,
            height: size + 28,
            borderRadius: 16,
            backgroundColor: 'rgba(12, 16, 22, 0.55)',
            boxShadow: `0 0 18px ${color}44`,
          }}
        >
          <LucideIconView name={name} size={size} color={color} />
        </div>
      ))}
    </div>
  );
}
