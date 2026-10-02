import { measureText } from '@remotion/layout-utils';
import type { Measure } from './fit';
import type { Style } from './style';
import { fontStack } from './style';

/**
 * Real text width via @remotion/layout-utils. Fonts must be loaded first (see loadFonts.ts)
 * or widths are measured in a fallback font.
 */
let fontsReady = false;

/**
 * layout-utils caches every width for the page's lifetime. Widths taken before the web fonts
 * arrive are fallback-font widths, so they get a different cache key (letterSpacing '0px' renders
 * the same as unset) and are never reused once the real fonts are in.
 */
export function markStorybitFontsReady(): void {
  fontsReady = true;
}

/** Measure with explicit font stacks (heading for weight ≥ 700, body for the rest). */
export const measureWith =
  (heading: string, body: string): Measure =>
  (text, fontSize, weight, opts) =>
    measureText({
      text,
      fontFamily: weight >= 700 ? heading : body,
      fontSize,
      fontWeight: weight,
      letterSpacing: fontsReady ? undefined : '0px',
      validateFontIsLoaded: false,
      // via additionalStyles so it is part of layout-utils' cache key (fontVariantNumeric alone is not)
      ...(opts?.tabular ? { additionalStyles: { fontVariantNumeric: 'tabular-nums' } } : {}),
    }).width;

/** Measure for the template's chosen fonts (heading font for weight ≥ 700). */
export const measureFor = (style: Style): Measure => measureWith(style.heading, style.body);

/** Default measure (Poppins). */
export const remotionMeasure: Measure = measureWith(fontStack('poppins'), fontStack('poppins'));
