'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { InfographicData, InfographicRemotionInputProps } from '../types';
import { TaxonomyVisual, type Clock } from '../layouts/taxonomyVisuals';
import { textEntrance } from '../animation';
import { readIconNames, readTextAnimationStyle } from '../props';

/** Normalize backend `icon_name` (string or list) for Remotion props. */
export function iconNameForRemotion(props: Record<string, unknown>): string | string[] | undefined {
  const names = readIconNames(props);
  if (!names.length) return undefined;
  return names.length === 1 ? names[0] : names;
}

/** Ensure `icon_name` / `icons` are on `data.props` so Lucide layouts can render them. */
export function withIconNameProp(data: InfographicData, icon_name?: string | string[]): InfographicData {
  const fromArg = icon_name != null ? readIconNames({ icon_name }) : [];
  const names = fromArg.length ? fromArg : readIconNames(data.props);
  if (!names.length) return data;
  const passed = icon_name ?? (names.length === 1 ? names[0] : names);
  return {
    ...data,
    props: {
      ...data.props,
      icon_name: passed,
      icons: names,
      iconName: data.props.iconName ?? passed,
    },
  };
}

/**
 * Shared visual used by the Remotion Player (library preview) and the timeline
 * overlay (video preview). Same layout, same `text_animation_style` entrance,
 * same Lucide `icon_name` — so the two surfaces cannot drift.
 */
export function InfographicVisual({
  data,
  clock,
  icon_name,
}: {
  data: InfographicData;
  clock: Clock;
  icon_name?: string | string[];
}) {
  const merged = withIconNameProp(data, icon_name);
  const entrance = textEntrance(readTextAnimationStyle(merged.props), clock.frame, clock.fps);
  const visual = <TaxonomyVisual data={merged} clock={clock} />;
  if (!entrance) return visual;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: entrance.opacity,
        transform: `translate(${entrance.translateX}px, ${entrance.translateY}px) scale(${entrance.scale})`,
        clipPath: entrance.clipPath,
      }}
    >
      {visual}
    </div>
  );
}

/**
 * Single Remotion composition for all backend infographics.
 * `icon_name` is a first-class input prop (string or string[]) so Lucide icons
 * resolve from whatever the /edit-video payload sent.
 */
export const DataDrivenInfographic: React.FC<InfographicRemotionInputProps> = ({ data, icon_name }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <InfographicVisual
      data={data}
      icon_name={icon_name}
      clock={{ frame, fps, durationInFrames }}
    />
  );
};
