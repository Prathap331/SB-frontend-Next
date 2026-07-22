import type { GeneratedScriptData } from '@/services/api';

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
    structure: Array.isArray(raw?.structure) ? raw.structure : [],
  };
}
