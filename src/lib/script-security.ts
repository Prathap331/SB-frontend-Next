import type { GeneratedScriptData } from '@/services/api';
import { normalizeScriptData } from '@/lib/script-data';

/** Select list for locked (universal) rows — never expose `script` to the browser. */
export const SCRIPT_ROW_SELECT_LOCKED =
  'id, title, topic, description, youtube_metadata, thumbnail, metrics, sources, books, structure, category, sub_category';

/**
 * Hard cap on REAL script characters exposed while locked.
 * Anything beyond this is non-secret visual filler for the blur layer.
 */
export const MAX_SCRIPT_PREVIEW_CHARS = 800;

/** Non-secret filler so the blur stack looks full without leaking paid text. */
function blurFiller(structure?: Array<{ name: string; percentage: number }> | null): string {
  const sections =
    structure?.length
      ? structure.map((s) => s.name)
      : ['Hook', 'Context', 'Analysis', 'Examples', 'Conclusion'];

  return sections
    .map(
      (name) =>
        `\n\n[${name}]\n\n` +
        '████████ ███████ █████████ ██████ ████████ ███████ ████████.\n' +
        '█████ ████████ ██████ █████████ ████ ███████ ████████ █████.\n' +
        '██████ ████ ████████ ███████ █████████ ██████ ████████.\n',
    )
    .join('');
}

/**
 * Teaser for locked UI / Network tab.
 * - At most MAX_SCRIPT_PREVIEW_CHARS of real script
 * - Never more than ~15% of the full script (whichever is smaller)
 * - Pads with non-secret filler for blur depth
 */
export function scriptPreviewText(
  full: string,
  structure?: Array<{ name: string; percentage: number }> | null,
): string {
  const text = (full || '').replace(/\r\n/g, '\n').trim();
  if (!text) return lockedScriptPlaceholder(structure);

  const percentCap = Math.max(70, Math.floor(text.length * 0.12));
  const hardCap = Math.min(MAX_SCRIPT_PREVIEW_CHARS, percentCap);

  let cut = hardCap;
  const slice = text.slice(0, hardCap);
  const lastBreak = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
  if (lastBreak > hardCap * 0.4) cut = lastBreak + (slice[lastBreak] === '.' ? 1 : 0);

  const head = text.slice(0, cut).trimEnd();
  // Absolute safety: never return nearly-full body
  if (head.length >= text.length * 0.5) {
    return `${text.slice(0, Math.min(160, hardCap)).trimEnd()}\n\n…${blurFiller(structure)}`;
  }

  return `${head}\n\n…${blurFiller(structure)}`;
}

/** Fallback only when no preview text exists. */
export function lockedScriptPlaceholder(
  structure?: Array<{ name: string; percentage: number }> | null,
): string {
  if (structure?.length) {
    return structure
      .map(
        (s) =>
          `[${s.name}]\n\nYour ${s.name.toLowerCase()} continues here after unlock…\n`,
      )
      .join('\n');
  }
  return '[Script]\n\nUnlock to view the full script…';
}

/**
 * Strip full script body from a generate-script payload before it reaches the browser.
 * Keeps a tiny real teaser + filler so the blur UI still looks like a script.
 */
export function redactGeneratedScriptForClient(
  raw: unknown,
  opts?: { scriptRowId?: string | null },
): GeneratedScriptData & { locked: true; scriptRowId: string | null } {
  const full = normalizeScriptData(raw);
  const preview = scriptPreviewText(full.script || '', full.structure);

  return {
    title: full.title,
    metrics: full.metrics,
    youtube_metadata: full.youtube_metadata,
    sources: full.sources,
    source_urls: full.source_urls,
    books: full.books,
    structure: full.structure,
    analysis: full.analysis,
    estimated_word_count: full.estimated_word_count,
    thumbnail: full.thumbnail,
    category: full.category,
    subcategories: full.subcategories,
    script: preview,
    scriptsByLanguage: undefined,
    locked: true,
    scriptRowId: opts?.scriptRowId ?? null,
  };
}
