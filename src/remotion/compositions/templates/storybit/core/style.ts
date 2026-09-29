/**
 * Style inputs shared by every Storybit template: fonts, font sizes and colours.
 *
 * props.style = { heading_font, body_font, <slot>_color… }   (all optional, hex colours)
 * props.font_sizes = { <field>: px }                           (clamped to each field's range)
 *
 * Font rule: text with weight ≥ 700 uses the heading font, everything else the body font.
 * Every font stack falls back to Noto Sans Devanagari / Telugu / Tamil for Indian scripts.
 */
import type { CSSProperties } from 'react';

export const FONT_CHOICES = {
  poppins: { family: 'Poppins', label: 'Poppins', serif: false },
  inter: { family: 'Inter', label: 'Inter', serif: false },
  montserrat: { family: 'Montserrat', label: 'Montserrat', serif: false },
  dm_sans: { family: 'DM Sans', label: 'DM Sans', serif: false },
  space_grotesk: { family: 'Space Grotesk', label: 'Space Grotesk', serif: false },
  oswald: { family: 'Oswald', label: 'Oswald (condensed)', serif: false },
  bebas_neue: { family: 'Bebas Neue', label: 'Bebas Neue (display, caps)', serif: false },
  playfair_display: { family: 'Playfair Display', label: 'Playfair Display (serif)', serif: true },
  roboto_slab: { family: 'Roboto Slab', label: 'Roboto Slab (slab serif)', serif: true },
  lora: { family: 'Lora', label: 'Lora (serif)', serif: true },
  baloo_2: { family: 'Baloo 2', label: 'Baloo 2 (rounded, Devanagari)', serif: false },
  mukta: { family: 'Mukta', label: 'Mukta (Devanagari)', serif: false },
  hind: { family: 'Hind', label: 'Hind (Devanagari)', serif: false },
  kalam: { family: 'Kalam', label: 'Kalam (handwriting, Devanagari)', serif: false },
} as const;

export type FontKey = keyof typeof FONT_CHOICES;
export const FONT_KEYS = Object.keys(FONT_CHOICES) as FontKey[];

const INDIC = '"Noto Sans Devanagari", "Noto Sans Telugu", "Noto Sans Tamil"';
export const fontStack = (k: FontKey) =>
  `"${FONT_CHOICES[k].family}", ${INDIC}, ${FONT_CHOICES[k].serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

/** Colour slots. `null` default = derived (see readStyle). */
export const COLOR_SLOTS = {
  background: { label: 'Background', default: '#141A45', fills: 'Theme background (gradient start, or solid)' },
  background_2: { label: 'Background 2', default: '#0C1030', fills: 'Theme background gradient end (set equal to background for a solid colour)' },
  scrim: { label: 'Scrim', default: '#080A1C', fills: 'Dark overlay behind text on images and footage' },
  text: { label: 'Text', default: '#FFF6E6', fills: 'Main text (titles, labels, numbers)' },
  muted: { label: 'Secondary text', default: '#C9CDE8', fills: 'Secondary text (subtitles, descriptions, context)' },
  accent: { label: 'Accent', default: '#F5A524', fills: 'Accent lines, highlights, kicker, units' },
  icon: { label: 'Icon', default: null, fills: 'Icon strokes (default: accent)' },
  icon_bg: { label: 'Icon background', default: null, fills: 'Circle behind icons (default: accent at 18%)' },
  card: { label: 'Card', default: null, fills: 'Chip / card / step fill (default: translucent white, darker over footage)' },
  card_border: { label: 'Card border', default: null, fills: 'Chip / card outline (default: translucent white)' },
  on_accent: { label: 'On accent', default: '#141A45', fills: 'Icons and numbers drawn on accent-filled shapes' },
  positive: { label: 'Positive', default: '#34D399', fills: 'Good change (up arrows, gains)' },
  negative: { label: 'Negative', default: '#F87171', fills: 'Bad change (down arrows, losses)' },
  series_2: { label: 'Series 2', default: '#22D3EE', fills: 'Second data series / slice (the first uses accent)' },
  series_3: { label: 'Series 3', default: '#A78BFA', fills: 'Third data series / slice' },
  series_4: { label: 'Series 4', default: '#F472B6', fills: 'Fourth data series / slice' },
  series_5: { label: 'Series 5', default: '#34D399', fills: 'Fifth slice' },
  series_6: { label: 'Series 6', default: '#FB923C', fills: 'Sixth slice' },
} as const;

/** Colour for data series / slice i (0 = accent). */
export const seriesColor = (colors: Record<string, string>, i: number) =>
  i === 0 ? colors.accent : colors[`series_${Math.min(6, i + 1)}`] ?? colors.accent;

export type ColorSlot = keyof typeof COLOR_SLOTS;
export const COMMON_COLORS: ColorSlot[] = ['background', 'background_2', 'scrim', 'text', 'muted', 'accent'];

export const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** #RGB / #RRGGBB / #RRGGBBAA → rgba() with an extra alpha multiplier. */
export function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r},${g},${b},${+(a * alpha).toFixed(3)})`;
}

/** Blend a colour towards white by `amt` (0–1). */
export function lighten(hex: string, amt: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const ch = (i: number) => Math.round(parseInt(h.slice(i, i + 2), 16) + (255 - parseInt(h.slice(i, i + 2), 16)) * amt);
  return `rgb(${ch(0)},${ch(2)},${ch(4)})`;
}

export type Colors = Record<ColorSlot, string>;

export type Style = {
  headingFont: FontKey;
  bodyFont: FontKey;
  heading: string;
  body: string;
  colors: Colors;
  /** Slots the user actually set (templates keep footage-aware defaults for the rest). */
  custom: Set<ColorSlot>;
};

export function readStyle(props: Record<string, unknown>): Style {
  const bag = props.style && typeof props.style === 'object' ? (props.style as Record<string, unknown>) : {};
  const font = (v: unknown, d: FontKey): FontKey => (typeof v === 'string' && v in FONT_CHOICES ? (v as FontKey) : d);
  const headingFont = font(bag.heading_font, 'poppins');
  const bodyFont = font(bag.body_font, headingFont === 'bebas_neue' ? 'poppins' : headingFont);
  const custom = new Set<ColorSlot>();
  // A colour can be given at the top level (props.background_color, props.background_2_color, …) or
  // inside props.style (style.background_color). The top-level value wins when both are valid.
  const pick = (slot: ColorSlot): string | undefined => {
    for (const v of [props[`${slot}_color`], bag[`${slot}_color`]]) {
      if (typeof v === 'string' && HEX.test(v.trim())) {
        custom.add(slot);
        return v.trim();
      }
    }
    return undefined;
  };
  const accent = pick('accent') ?? COLOR_SLOTS.accent.default;
  const colors = {} as Colors;
  for (const slot of Object.keys(COLOR_SLOTS) as ColorSlot[]) {
    const d = COLOR_SLOTS[slot].default;
    colors[slot] =
      pick(slot) ??
      (d ??
        (slot === 'icon'
          ? accent
          : slot === 'icon_bg'
            ? withAlpha(accent, 0.18)
            : slot === 'card'
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(255,255,255,0.14)'));
  }
  colors.accent = accent;
  return { headingFont, bodyFont, heading: fontStack(headingFont), body: fontStack(bodyFont), colors, custom };
}

/** Root CSS: body font + CSS variables used by shared components. */
export function styleVars(style: Style): CSSProperties {
  return {
    fontFamily: style.body,
    ['--sb-heading' as string]: style.heading,
    ['--sb-body' as string]: style.body,
    ['--sb-text' as string]: style.colors.text,
  } as CSSProperties;
}

/** Font family for a weight (heading font for ≥ 700). */
export const fontFor = (weight: number) => (weight >= 700 ? 'var(--sb-heading)' : 'var(--sb-body)');

/** Secondary text colour; brighter default over footage unless the user set it. */
export const mutedFor = (style: Style, onFootage: boolean) =>
  onFootage && !style.custom.has('muted') ? '#E8EAF6' : style.colors.muted;

/** Card fill/border that stay readable over footage unless the user set them. */
export function cardColors(style: Style, onFootage: boolean) {
  return {
    fill: style.custom.has('card') ? style.colors.card : onFootage ? 'rgba(10,12,32,0.62)' : style.colors.card,
    border: style.custom.has('card_border') ? style.colors.card_border : onFootage ? 'rgba(255,255,255,0.22)' : style.colors.card_border,
  };
}

/** A hex colour from props, or undefined (used for per-row / per-column background colours). */
export function readHex(v: unknown): string | undefined {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : undefined;
}
