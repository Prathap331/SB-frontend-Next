/** Safe readers for backend `props` — never assume a shape. */

import type { ChartDatum } from './types';

export function readString(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === 'string' ? v : undefined;
}

export function readNonEmptyString(
  props: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = readString(props, key);
  if (!v || !v.trim()) return undefined;
  return v;
}

/** String array from `items`, or any array of strings under a known key. */
export function readStringArray(
  props: Record<string, unknown>,
  key: string,
): string[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

/** `content_binding: "fallback_icon:arrow-right"` from overlay tracks. */
export function iconNamesFromContentBinding(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  const names: string[] = [];
  const re = /(?:fallback_icon|icon_name)\s*[:=]\s*([a-z0-9][a-z0-9_-]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    if (match[1]) names.push(match[1]);
  }
  return names;
}

/** `icon_name` / `iconName` / `icons` as a string, comma list, or string[]. */
export function readIconNames(props: Record<string, unknown>): string[] {
  const fromUnknown = (value: unknown): string[] => {
    if (value == null) return [];
    if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return [];
      const fromBinding = iconNamesFromContentBinding(t);
      if (fromBinding.length) return fromBinding;
      if (t.includes(',')) return t.split(',').map((part) => part.trim()).filter(Boolean);
      return [t];
    }
    if (Array.isArray(value)) return value.flatMap(fromUnknown);
    if (value && typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      return fromUnknown(rec.name ?? rec.icon ?? rec.icon_name ?? rec.iconName ?? rec.value);
    }
    return [];
  };
  let best: string[] = [];
  for (const key of ['icon_name', 'iconName', 'icons', 'icon_names', 'icon']) {
    const list = fromUnknown(props[key]);
    if (list.length > best.length) best = list;
  }
  if (best.length) return best;
  return fromUnknown(props.content_binding ?? props.contentBinding);
}

/**
 * Backend `text_animation_style` (fade_in, slide_in_left, typewriter, …) as handed to
 * Remotion. Same value the timeline's CSS text overlay uses, so both render alike.
 */
export function readTextAnimationStyle(props: Record<string, unknown>): string | undefined {
  for (const key of ['textAnimationStyle', 'text_animation_style', 'animationStyle']) {
    const v = readNonEmptyString(props, key);
    if (v) return v;
  }
  return undefined;
}

export function readObjectArray(
  props: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

export function readAccentColor(
  props: Record<string, unknown>,
  fallback = '#f5f5f7',
): string {
  return readColor(props, fallback);
}

const HEX_RE = /^#?[0-9a-f]{3,8}$/i;
const FUNC_COLOR_RE = /^(rgb|hsl)a?\(/i;
const NAMED_COLOR_RE = /^[a-z]{3,24}$/i;

export function normalizeColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const s = raw.trim();
  if (!s) return fallback;
  if (HEX_RE.test(s)) return s.startsWith('#') ? s : `#${s}`;
  if (FUNC_COLOR_RE.test(s) || NAMED_COLOR_RE.test(s)) return s;
  return fallback;
}

export function readColor(props: Record<string, unknown>, fallback = '#f5f5f7'): string {
  for (const key of ['color', 'accentColor', 'accent_color', 'accent', 'colorHint', 'color_hint', 'tint']) {
    const v = readNonEmptyString(props, key);
    if (v) return normalizeColor(v, fallback);
  }
  return fallback;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function readNumberProp(
  props: Record<string, unknown>,
  keys: string | string[],
): number | undefined {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    const n = readNumber(props[key]);
    if (n != null) return n;
  }
  return undefined;
}

export function readNumberArray(props: Record<string, unknown>, key: string): number[] {
  const v = props[key];
  if (!Array.isArray(v)) {
    const single = readNumber(v);
    return single == null ? [] : [single];
  }
  return v.map(readNumber).filter((n): n is number => n != null);
}

/** `displayText` as a string, a string[], or common title/label/quote fallbacks. */
export function readDisplayText(props: Record<string, unknown>): string {
  const lines = readDisplayLines(props);
  return lines.join(' ');
}

export function readDisplayLines(props: Record<string, unknown>): string[] {
  const raw = props.displayText ?? props.display_text ?? props.text;
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  if (Array.isArray(raw)) {
    const lines = raw.flatMap((item) => {
      if (typeof item === 'string' && item.trim()) return [item.trim()];
      if (typeof item === 'number' && Number.isFinite(item)) return [String(item)];
      return [];
    });
    if (lines.length) return lines;
  }
  const collected: string[] = [];
  for (const key of ['title', 'headline', 'quote', 'label', 'caption', 'subtitle']) {
    const v = readNonEmptyString(props, key);
    if (v) collected.push(v);
  }
  const items = readStringArray(props, 'items');
  if (!collected.length && items.length) return items;
  return collected;
}

export function readItemList(props: Record<string, unknown>): string[] {
  for (const key of ['items', 'list', 'steps', 'bullets', 'lines', 'credits', 'names']) {
    const fromStrings = readStringArray(props, key);
    if (fromStrings.length) return fromStrings;
    const objects = readObjectArray(props, key);
    if (objects.length) {
      const labels = objects.flatMap((row) => {
        const label =
          readNonEmptyString(row, 'label') ??
          readNonEmptyString(row, 'title') ??
          readNonEmptyString(row, 'text') ??
          readNonEmptyString(row, 'name');
        return label ? [label] : [];
      });
      if (labels.length) return labels;
    }
  }
  const display = props.displayText ?? props.display_text;
  if (Array.isArray(display)) return readDisplayLines(props);
  return [];
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function isRenderableSrc(value: string): boolean {
  const s = value.trim();
  return /^(https?:\/\/|\/|data:|blob:)/i.test(s);
}

export function readImageUrl(props: Record<string, unknown>): string | undefined {
  const direct = firstString(
    props.image,
    props.imageUrl,
    props.image_url,
    props.src,
    props.url,
    props.photo,
    props.poster,
    props.logo,
    props.logoUrl,
    props.logo_url,
    props.video,
    props.videoUrl,
    props.video_url,
  );
  if (direct && isRenderableSrc(direct)) return direct;
  const images = readImageUrls(props);
  return images[0];
}

export function readImageUrls(props: Record<string, unknown>): string[] {
  const fromUnknown = (value: unknown): string[] => {
    if (typeof value === 'string' && isRenderableSrc(value)) return [value.trim()];
    if (!Array.isArray(value)) {
      if (value && typeof value === 'object') {
        const rec = value as Record<string, unknown>;
        return fromUnknown(rec.url ?? rec.src ?? rec.image ?? rec.imageUrl ?? rec.image_url);
      }
      return [];
    }
    return value.flatMap(fromUnknown);
  };
  for (const key of ['images', 'imageUrls', 'image_urls', 'photos', 'gallery', 'srcs', 'media']) {
    const list = fromUnknown(props[key]);
    if (list.length) return list;
  }
  const single = firstString(
    props.image,
    props.imageUrl,
    props.image_url,
    props.src,
    props.logo,
    props.logoUrl,
    props.logo_url,
    props.photo,
  );
  return single && isRenderableSrc(single) ? [single] : [];
}

export function readChartData(props: Record<string, unknown>): ChartDatum[] {
  const fromArray = (arr: unknown[]): ChartDatum[] => {
    const out: ChartDatum[] = [];
    arr.forEach((item, i) => {
      const n = readNumber(item);
      if (n != null) {
        out.push({ label: String(i + 1), value: n });
        return;
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const rec = item as Record<string, unknown>;
      const value = readNumber(rec.value ?? rec.y ?? rec.count ?? rec.amount ?? rec.n ?? rec.percent);
      if (value == null) return;
      const label =
        readNonEmptyString(rec, 'label') ??
        readNonEmptyString(rec, 'name') ??
        (typeof rec.x === 'string' ? rec.x.trim() : undefined) ??
        String(i + 1);
      const colorRaw = readNonEmptyString(rec, 'color') ?? readNonEmptyString(rec, 'accent');
      out.push({
        label,
        value,
        ...(colorRaw ? { color: normalizeColor(colorRaw, colorRaw) } : {}),
      });
    });
    return out;
  };

  for (const key of ['data', 'chartData', 'chart_data', 'points', 'dataset', 'series', 'bars']) {
    const v = props[key];
    if (Array.isArray(v) && v.length) {
      const parsed = fromArray(v);
      if (parsed.length) return parsed;
    }
  }

  const labels =
    readStringArray(props, 'labels').length > 0
      ? readStringArray(props, 'labels')
      : readStringArray(props, 'categories');
  const values =
    readNumberArray(props, 'values').length > 0
      ? readNumberArray(props, 'values')
      : readNumberArray(props, 'series');
  if (labels.length || values.length) {
    const n = Math.max(labels.length, values.length);
    const out: ChartDatum[] = [];
    for (let i = 0; i < n; i++) {
      const value = values[i];
      if (value == null) continue;
      out.push({ label: labels[i] ?? String(i + 1), value });
    }
    return out;
  }

  const items = readObjectArray(props, 'items');
  if (items.length) return fromArray(items);
  return [];
}

export function readDuration(props: Record<string, unknown>, fallbackFrames: number): number {
  const frames = readNumberProp(props, ['duration_frames', 'durationFrames']);
  if (frames != null && frames > 0) return frames;
  const seconds = readNumberProp(props, ['duration', 'durationSeconds', 'duration_seconds']);
  if (seconds != null && seconds > 0) return Math.max(1, Math.round(seconds * 30));
  return Math.max(1, fallbackFrames);
}

/** Whether props contain anything a generic layout can show. */
export function propsHaveRenderableContent(props: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.trim()) return true;
    if (typeof value === 'number' && Number.isFinite(value)) return true;
    if (Array.isArray(value) && value.length > 0) return true;
    if (value && typeof value === 'object') return true;
    void key;
  }
  return false;
}
