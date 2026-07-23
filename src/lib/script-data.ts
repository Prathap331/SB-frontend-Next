import type { GeneratedScriptData } from '@/services/api';
import {
  normalizeGeneratedThumbnail,
  normalizeScriptCategory,
  normalizeScriptSubcategories,
  readThumbnailGeneratedColumn,
  toThumbnailGeneratedJson,
} from '@/lib/script-persistence';

export function unwrapScriptJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.script === 'string') return parsed.script;
  } catch {
    const m = trimmed.match(/"script"\s*:\s*"([\s\S]*)"/);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return trimmed;
}

export function extractScriptText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'object') {
    const s = raw.script || '';
    return typeof s === 'string' ? unwrapScriptJson(s) : '';
  }
  if (typeof raw === 'string') return unwrapScriptJson(raw);
  return '';
}

/**
 * Normalizes a /generate-script response (or a Supabase row) into
 * GeneratedScriptData for studio + script page.
 */
export function normalizeScriptData(raw: any): GeneratedScriptData {
  const metrics = raw?.metrics ?? undefined;

  const youtube_metadata = raw?.youtube_metadata ?? raw?.seo?.youtube_metadata ?? undefined;

  const sources: string[] =
    Array.isArray(raw?.sources) && raw.sources.length > 0
      ? raw.sources
      : Array.isArray(raw?.source_urls)
        ? raw.source_urls
        : [];

  const books = Array.isArray(raw?.books) && raw.books.length > 0
    ? raw.books
    : Array.isArray(raw?.seo?.books)
      ? raw.seo.books
      : [];

  const analysis = raw?.analysis ?? {
    examples_count:       metrics?.generalExamples ?? 0,
    research_facts_count: metrics?.researchFacts ?? 0,
    proverbs_count:       metrics?.proverbs_count ?? 0,
    emotional_depth:      metrics?.emotionalDepth != null ? String(metrics.emotionalDepth) : '',
    history:              metrics?.historical_facts ?? metrics?.history ?? 0,
  };

  const thumbnailGeneratedRaw =
    readThumbnailGeneratedColumn(raw as Record<string, unknown>) ??
    raw?.thumbnail_generated ??
    null;

  let thumbnail_generated: GeneratedScriptData['thumbnail_generated'] = null;
  if (thumbnailGeneratedRaw != null) {
    if (Array.isArray(thumbnailGeneratedRaw)) {
      thumbnail_generated = thumbnailGeneratedRaw as GeneratedScriptData['thumbnail_generated'];
    } else {
      const item = normalizeGeneratedThumbnail(thumbnailGeneratedRaw);
      thumbnail_generated = item ? toThumbnailGeneratedJson(item) : null;
    }
  }

  return {
    ...raw,
    script: extractScriptText(raw),
    estimated_word_count: raw?.estimated_word_count ?? metrics?.totalWords ?? metrics?.word_count ?? 0,
    source_urls: sources,
    sources,
    books,
    analysis,
    youtube_metadata,
    metrics: metrics ?? raw?.metrics,
    thumbnail: raw?.thumbnail ?? youtube_metadata?.thumbnail_text ?? null,
    thumbnail_generated: thumbnail_generated ?? undefined,
    structure: Array.isArray(raw?.structure) ? raw.structure : [],
    category: normalizeScriptCategory(raw?.category) ?? undefined,
    subcategories: (() => {
      const fromApi = normalizeScriptSubcategories(raw?.subcategories);
      if (fromApi.length) return fromApi;
      const fromDb = normalizeScriptSubcategories(raw?.sub_category);
      return fromDb.length ? fromDb : undefined;
    })(),
  };
}
