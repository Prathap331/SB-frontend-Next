import { listKeyFromPath } from '@/lib/video-editor/storybitEditorFields';

/** Top-level prop key for a catalog path (`tags[].text` / `tags[0].text` → `tags`, `name` → `name`). */
export function beatEditRootKey(path: string): string {
  const fromEmpty = listKeyFromPath(path);
  if (fromEmpty) return fromEmpty;
  const indexed = path.match(/^([^[\].]+)\[\d+\]/);
  if (indexed) return indexed[1];
  const dot = path.split('.')[0] ?? path;
  return dot.replace(/\[.*$/, '');
}

export function isBeatColorPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    /(^|\.)(text_color|icon_color|icon_bg_color|background_color|background_2_color|scrim_color|accent_color|muted_color|bg_color)$/.test(
      p,
    ) || p.includes('color')
  );
}

export function colorPayloadKey(path: string, index?: number): string {
  const indexed = index != null && path.includes('[]') ? path.replace('[]', `[${index}]`) : path;
  return indexed.replace(/^style\./, '');
}

/**
 * Body for PATCH /edit/{videoId}/{sceneId}/{beatId}/text.
 * Scalars: `{ name: "Alex" }`. Lists: the whole array `{ tags: [...] }`.
 */
export function beatTextEditPayload(
  props: Record<string, unknown>,
  path: string,
): Record<string, unknown> | null {
  if (isBeatColorPath(path)) return null;
  const key = beatEditRootKey(path);
  if (!key || key === 'style' || key === 'animations' || key === 'font_sizes') return null;
  const value = props[key];
  if (value === undefined) return null;
  return { [key]: value };
}

export function beatColorEditPayload(path: string, hex: string, index?: number): Record<string, unknown> {
  return { [colorPayloadKey(path, index)]: hex };
}

export type BeatAddMediaPayload = {
  media_id: number;
  media_type: string;
  media_url: string;
  query: string;
  width: number;
  height: number;
  duration: number;
  photographer: string;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseWxH(meta?: string | null): { width: number; height: number } {
  const match = meta?.match(/(\d+)\s*[×x]\s*(\d+)/);
  return {
    width: match ? Number(match[1]) : 0,
    height: match ? Number(match[2]) : 0,
  };
}

/** Body for POST /edit/{videoId}/{sceneId}/{beatId}/add-media. */
export function beatAddMediaPayload(input: {
  mediaId?: number | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  query?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  photographer?: string | null;
  meta?: string | null;
}): BeatAddMediaPayload {
  const parsed = parseWxH(input.meta);
  const mediaType = (input.mediaType || '').trim().toLowerCase();
  const isImage = mediaType === 'image' || mediaType === 'photo';
  return {
    media_id: finiteNumber(input.mediaId, 0),
    media_type: isImage ? 'photo' : 'video',
    media_url: (input.mediaUrl || '').trim(),
    query: (input.query || '').trim(),
    width: finiteNumber(input.width, parsed.width),
    height: finiteNumber(input.height, parsed.height),
    duration: isImage ? 0 : finiteNumber(input.duration, 0),
    photographer: (input.photographer || '').trim(),
  };
}
