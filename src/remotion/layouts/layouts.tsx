'use client';

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { InfographicData } from '../types';
import { contentPanelStyle, isFullFramePlacement, rootFillStyle } from '../placement';
import { itemRevealOpacity, slideY, springScale, useFadeWindow } from '../animation';
import {
  propsHaveRenderableContent,
  readAccentColor,
  readNonEmptyString,
  readObjectArray,
  readString,
  readStringArray,
} from '../props';
import { OverlayMotionFrame } from './overlays';

type LayoutProps = {
  data: InfographicData;
};

function FullFrameBackdrop({ dark = '#0b0b0f' }: { dark?: string }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: dark,
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 55%), linear-gradient(160deg, #12121a 0%, #0b0b0f 50%, #16120e 100%)',
      }}
    />
  );
}

/** Layout: title + optional subtitle (animation_type: full_screen_title_card). */
export function TitleCardLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart, opacity } = useFadeWindow(frame, durationInFrames, fps);
  const title = readString(data.props, 'title') ?? '';
  const subtitle = readNonEmptyString(data.props, 'subtitle');
  const color = readAccentColor(data.props);
  const y = slideY(frame, fadeInEnd, 28);
  const subtitleOpacity = interpolate(
    frame,
    [fadeInEnd * 0.5, fadeInEnd + 8, fadeOutStart, durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={rootFillStyle(data.placement)}>
      {isFullFramePlacement(data.placement) ? <FullFrameBackdrop /> : null}
      <div
        style={{
          ...contentPanelStyle(data.placement),
          opacity,
          transform: isFullFramePlacement(data.placement)
            ? `translateY(${y}px)`
            : contentPanelStyle(data.placement).transform,
          textAlign: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: 64,
            height: 2,
            backgroundColor: color,
            margin: '0 auto 28px',
          }}
        />
        <h1
          style={{
            margin: 0,
            color,
            fontSize: isFullFramePlacement(data.placement) ? 72 : 42,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {title || ' '}
        </h1>
        {subtitle ? (
          <p
            style={{
              margin: '22px 0 0',
              color: 'rgba(245,245,247,0.72)',
              fontSize: isFullFramePlacement(data.placement) ? 28 : 20,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              opacity: subtitleOpacity,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

/** Layout: quote + optional attribution. */
export function QuoteCardLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart, opacity } = useFadeWindow(frame, durationInFrames, fps, 0.5);
  const quote = readString(data.props, 'quote') ?? '';
  const attribution = readNonEmptyString(data.props, 'attribution');
  const color = readAccentColor(data.props);
  const y = slideY(frame, fadeInEnd, 20);
  const scale = springScale(frame, fps);
  const attrOpacity = interpolate(
    frame,
    [fadeInEnd * 0.6, fadeInEnd + 10, fadeOutStart, durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={rootFillStyle(data.placement)}>
      {isFullFramePlacement(data.placement) ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at 30% 20%, rgba(212,175,55,0.12) 0%, transparent 50%), linear-gradient(165deg, #141820 0%, #0e1116 55%, #12100c 100%)',
          }}
        />
      ) : null}
      <div
        style={{
          ...contentPanelStyle(data.placement),
          opacity,
          textAlign: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          zIndex: 1,
          transform: isFullFramePlacement(data.placement)
            ? `translateY(${y}px)`
            : contentPanelStyle(data.placement).transform,
        }}
      >
        <div
          style={{
            fontSize: isFullFramePlacement(data.placement) ? 96 : 56,
            lineHeight: 1,
            color: 'rgba(212,175,55,0.85)',
            transform: `scale(${scale})`,
            marginBottom: 12,
          }}
        >
          “
        </div>
        <p
          style={{
            margin: 0,
            color,
            fontSize: isFullFramePlacement(data.placement) ? 48 : 28,
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {quote || ' '}
        </p>
        {attribution ? (
          <p
            style={{
              margin: '28px 0 0',
              color: 'rgba(242,240,234,0.65)',
              fontSize: 22,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: attrOpacity,
            }}
          >
            — {attribution}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

/** Layout: label + caption (stat / data viz). */
export function DataVizLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart, opacity } = useFadeWindow(frame, durationInFrames, fps, 0.4);
  const label = readString(data.props, 'label') ?? '';
  const caption = readString(data.props, 'caption') ?? '';
  const scale = interpolate(frame, [0, fadeInEnd], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barWidth = interpolate(frame, [0, fadeInEnd + 6], [0, 120], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const captionOpacity = interpolate(
    frame,
    [fadeInEnd * 0.55, fadeInEnd + 12, fadeOutStart, durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={rootFillStyle(data.placement)}>
      {isFullFramePlacement(data.placement) ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(circle at 50% 40%, rgba(56,189,248,0.14) 0%, transparent 45%), linear-gradient(180deg, #10141c 0%, #0a0c10 100%)',
          }}
        />
      ) : null}
      <div
        style={{
          ...contentPanelStyle(data.placement),
          opacity,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            color: '#f8fafc',
            fontSize: isFullFramePlacement(data.placement) ? 120 : 64,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {label || ' '}
        </div>
        <div
          style={{
            width: barWidth,
            height: 3,
            backgroundColor: 'rgba(56,189,248,0.9)',
            margin: '28px auto 0',
            borderRadius: 2,
          }}
        />
        {caption ? (
          <p
            style={{
              margin: '28px auto 0',
              maxWidth: 780,
              color: 'rgba(226,232,240,0.78)',
              fontSize: isFullFramePlacement(data.placement) ? 26 : 18,
              lineHeight: 1.45,
              opacity: captionOpacity,
            }}
          >
            {caption}
          </p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

/** Layout: optional title + staggered string items. */
export function BulletListLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart, opacity } = useFadeWindow(frame, durationInFrames, fps, 0.4);
  const title = readNonEmptyString(data.props, 'title');
  const items = readStringArray(data.props, 'items');

  return (
    <AbsoluteFill style={rootFillStyle(data.placement)}>
      {isFullFramePlacement(data.placement) ? <FullFrameBackdrop dark="#0a0c10" /> : null}
      <div
        style={{
          ...contentPanelStyle(data.placement),
          opacity,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1,
          alignItems: isFullFramePlacement(data.placement) ? 'flex-start' : 'stretch',
          justifyContent: isFullFramePlacement(data.placement) ? 'center' : 'flex-start',
          margin: isFullFramePlacement(data.placement) ? '0 auto' : undefined,
          maxWidth: isFullFramePlacement(data.placement) ? 900 : undefined,
        }}
      >
        {title ? (
          <h2
            style={{
              margin: '0 0 28px',
              color: '#f5f5f7',
              fontSize: isFullFramePlacement(data.placement) ? 40 : 28,
              fontWeight: 650,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
        ) : null}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, width: '100%' }}>
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
                key={`${index}-${item.slice(0, 24)}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  marginBottom: 18,
                  opacity: itemOpacity,
                  transform: `translateY(${itemY}px)`,
                  color: '#f2f0ea',
                  fontSize: isFullFramePlacement(data.placement) ? 32 : 22,
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
                    backgroundColor: 'rgba(56,189,248,0.95)',
                  }}
                />
                <span>{item}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
}

/**
 * Safe generic layout: renders recognizable prop keys without inventing design semantics.
 * Used when animation_type is unknown but props still have content.
 */
export function GenericPropsLayout({ data }: LayoutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { fadeInEnd, fadeOutStart } = useFadeWindow(frame, durationInFrames, fps);

  if (!propsHaveRenderableContent(data.props)) {
    return (
      <AbsoluteFill
        style={{
          ...rootFillStyle(data.placement),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: isFullFramePlacement(data.placement) ? 'rgba(0,0,0,0.55)' : 'transparent',
        }}
      >
        <div
          style={{
            ...contentPanelStyle(data.placement === 'full_frame' ? 'center' : data.placement),
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 22,
          }}
        >
          Unsupported infographic animation: {data.animation_type || 'unknown'}
        </div>
      </AbsoluteFill>
    );
  }

  const title = readNonEmptyString(data.props, 'title');
  const subtitle = readNonEmptyString(data.props, 'subtitle');
  const quote = readNonEmptyString(data.props, 'quote');
  const attribution = readNonEmptyString(data.props, 'attribution');
  const label = readNonEmptyString(data.props, 'label');
  const caption = readNonEmptyString(data.props, 'caption');
  const items = readStringArray(data.props, 'items');
  const objectItems = readObjectArray(data.props, 'items');

  const knownKeys = new Set([
    'title',
    'subtitle',
    'quote',
    'attribution',
    'label',
    'caption',
    'items',
    'color',
    'accent',
    'color_hint',
    'background',
    'backgroundColor',
    'bg',
    'icons',
    'icon_name',
    'iconLayout',
    'icon_layout',
    'motion',
    'motion_style',
    'geometryPx',
    'displayText',
    'colorHint',
    'iconName',
    'highlightTargetText',
  ]);
  const extraEntries = Object.entries(data.props).filter(([key, value]) => {
    if (knownKeys.has(key)) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.length > 0;
    return false;
  });
  const color =
    readAccentColor(data.props);

  return (
    <OverlayMotionFrame data={data}>
      <div
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1,
          color,
        }}
      >
        {label ? (
          <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 12 }}>{label}</div>
        ) : null}
        {title ? (
          <h2 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 650 }}>{title}</h2>
        ) : null}
        {subtitle ? (
          <p style={{ margin: '0 0 16px', fontSize: 22, color: 'rgba(245,245,247,0.72)' }}>
            {subtitle}
          </p>
        ) : null}
        {quote ? (
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 28,
              fontFamily: 'Georgia, serif',
              lineHeight: 1.4,
            }}
          >
            “{quote}”
          </p>
        ) : null}
        {attribution ? (
          <p style={{ margin: '0 0 16px', fontSize: 16, color: 'rgba(245,245,247,0.6)' }}>
            — {attribution}
          </p>
        ) : null}
        {caption ? (
          <p style={{ margin: '0 0 16px', fontSize: 20, color: 'rgba(226,232,240,0.8)' }}>
            {caption}
          </p>
        ) : null}
        {items.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item, index) => (
              <li
                key={`${index}-${item.slice(0, 20)}`}
                style={{
                  marginBottom: 12,
                  opacity: itemRevealOpacity(
                    frame,
                    index,
                    fadeInEnd,
                    fadeOutStart,
                    durationInFrames,
                  ),
                  fontSize: 22,
                }}
              >
                • {item}
              </li>
            ))}
          </ul>
        ) : null}
        {objectItems.length > 0 && items.length === 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {objectItems.map((row, index) => {
              const text =
                (typeof row.label === 'string' && row.label) ||
                (typeof row.title === 'string' && row.title) ||
                (typeof row.text === 'string' && row.text) ||
                (typeof row.name === 'string' && row.name) ||
                JSON.stringify(row);
              return (
                <li key={index} style={{ marginBottom: 10, fontSize: 20 }}>
                  • {text}
                </li>
              );
            })}
          </ul>
        ) : null}
        {extraEntries.map(([key, value]) => {
          let text = '';
          if (typeof value === 'string' || typeof value === 'number') text = String(value);
          else if (Array.isArray(value)) {
            text = value
              .map((v) => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
              .filter(Boolean)
              .join(' · ');
          }
          if (!text) return null;
          return (
            <p key={key} style={{ margin: '8px 0 0', fontSize: 18, color: 'rgba(245,245,247,0.75)' }}>
              <span style={{ opacity: 0.55 }}>{key}: </span>
              {text}
            </p>
          );
        })}
      </div>
    </OverlayMotionFrame>
  );
}
