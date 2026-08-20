'use client';

import React from 'react';
import type { InfographicRemotionInputProps } from '../types';
import {
  BulletListLayout,
  DataVizLayout,
  GenericPropsLayout,
  QuoteCardLayout,
  TitleCardLayout,
} from '../layouts/layouts';

/**
 * Single Remotion composition for all backend infographics.
 * Receives the COMPLETE InfographicData object — never individual hard-coded fields.
 * Layout is chosen by animation_type (not composition_id).
 */
export const DataDrivenInfographic: React.FC<InfographicRemotionInputProps> = ({ data }) => {
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
    default:
      // Unknown animation_type: render props generically when possible.
      return <GenericPropsLayout data={data} />;
  }
};
