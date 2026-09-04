/**
 * Human-readable names for b-roll media.
 *
 * Beat ids (`s1_b2`) are backend bookkeeping — they were leaking into timeline clip
 * labels and library cards. Both surfaces call this so a clip and its media-library
 * card always read the same.
 */

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** First usable keyword from `keywords: string | string[]`. */
export function firstKeyword(keywords: unknown): string {
  const direct = clean(keywords);
  if (direct) return direct;
  if (!Array.isArray(keywords)) return '';
  for (const entry of keywords) {
    const word = clean(entry);
    if (word) return word;
  }
  return '';
}

export type BrollNameInput = {
  /** An explicit name already carried by the payload, preferred over keywords. */
  name?: unknown;
  title?: unknown;
  keywords?: unknown;
  mediaKind?: 'video' | 'image' | null;
  /** 0-based position within the scene, used for the numbered fallback. */
  index?: number;
};

/**
 * Name to show for one b-roll item: its own name/title, else its first keyword,
 * else a numbered fallback ("Video 2"). Never returns a beat id.
 */
export function brollDisplayName(input: BrollNameInput): string {
  const base = clean(input.name) || clean(input.title) || firstKeyword(input.keywords);
  if (base) return base.charAt(0).toUpperCase() + base.slice(1);
  const position = (input.index ?? 0) + 1;
  return input.mediaKind === 'image' ? `Image ${position}` : `Video ${position}`;
}

/**
 * Whether a timeline clip is a still image. `mediaKind` wins when the payload set it;
 * otherwise the URL decides. Shared by the preview and the media library so a clip is
 * never classified one way in the player and the other way on its card.
 */
export function isImageClip(
  clip: { mediaKind?: 'video' | 'image'; sourceUrl?: string; thumbnailUrl?: string } | undefined | null,
): boolean {
  if (!clip) return false;
  if (clip.mediaKind === 'image') return true;
  if (clip.mediaKind === 'video') return false;
  const url = clip.sourceUrl || clip.thumbnailUrl || '';
  if (!url) return false;
  if (/^data:image/i.test(url)) return true;
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url)) return true;
  // Common still-image CDNs without file extensions in the path
  if (/images\.pexels\.com|images\.unsplash\.com|img\.freepik\.com|cdn\.pixabay\.com/i.test(url)) {
    return true;
  }
  return false;
}

/** `'image' | 'video'` for one clip, using the same rule as isImageClip. */
export function clipMediaKind(
  clip: { mediaKind?: 'video' | 'image'; sourceUrl?: string; thumbnailUrl?: string } | undefined | null,
): 'video' | 'image' {
  return isImageClip(clip) ? 'image' : 'video';
}
