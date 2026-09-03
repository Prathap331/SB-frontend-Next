'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { InfographicRemotionInputProps } from '../types';
import {
  BulletListLayout,
  DataVizLayout,
  QuoteCardLayout,
  TitleCardLayout,
} from '../layouts/layouts';
import { IconOverlayLayout } from '../layouts/overlays';
import { TaxonomyVisual } from '../layouts/taxonomyVisuals';

/**
 * Single Remotion composition for all backend infographics.
 * The 7 remapped types keep their dedicated layouts; everything else uses
 * the shared taxonomy visuals (same clock-driven preview as the timeline).
 */
export const DataDrivenInfographic: React.FC<InfographicRemotionInputProps> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const type = (data.animation_type || '').trim();

  switch (type) {
    case 'full_screen_title_card':
      return <TitleCardLayout data={data} />;
    case 'full_screen_quote_card':
      return <QuoteCardLayout data={data} />;
    case 'full_screen_data_viz':
      return <DataVizLayout data={data} />;
    case 'bullet_list_reveal':
      return <BulletListLayout data={data} />;
    case 'icon_sequence':
    case 'icon_pop_in':
      return <IconOverlayLayout data={data} />;
    default:
      return <TaxonomyVisual data={data} clock={{ frame, fps, durationInFrames }} />;
  }
};
