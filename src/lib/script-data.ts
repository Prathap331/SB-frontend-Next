import type { GeneratedScriptData } from '@/services/api';
import {
  normalizeGeneratedThumbnail,
  normalizeScriptCategory,
  normalizeScriptSubcategories,
  readThumbnailGeneratedColumn,
  toThumbnailGeneratedJson,
} from '@/lib/script-persistence';
import { DEFAULT_SCRIPT_LANGUAGE } from '@/lib/script-languages';

/** Multilingual script column shape (jsonb): { english: "...", telugu: "..." } */
export type ScriptLanguageMap = Record<string, string>;

export function unwrapScriptJson(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.script === 'string') return parsed.script;
    const map = parseScriptLanguageMap(parsed);
    if (Object.keys(map).length) return getScriptTextFromMap(map);
  } catch {
    const m = trimmed.match(/"script"\s*:\s*"([\s\S]*)"/);
    if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return trimmed;
}

/**
 * Parse scripts_*.script (plain text, JSON string, or jsonb object) into a language map.
 * Legacy plain strings become { english: "..." }.
 */
export function parseScriptLanguageMap(raw: unknown): ScriptLanguageMap {
  if (raw == null) return {};

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: ScriptLanguageMap = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k.toLowerCase()] = v;
    }
    // Legacy wrapper { script: "..." }
    if (out.script && !out.english) {
      const { script, ...rest } = out;
      return { english: script, ...rest };
    }
    if (out.script && out.english) {
      const { script: _drop, ...rest } = out;
      return rest;
    }
    return out;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{')) {
      try {
        return parseScriptLanguageMap(JSON.parse(trimmed));
      } catch {
        /* plain script that happens to start with { */
      }
    }
    return { [DEFAULT_SCRIPT_LANGUAGE]: unwrapScriptJson(trimmed) };
  }

  return {};
}

export function getScriptTextFromMap(
  map: ScriptLanguageMap,
  preferred: string = DEFAULT_SCRIPT_LANGUAGE,
): string {
  const key = preferred.toLowerCase();
  if (map[key]?.trim()) return map[key];
  if (map[DEFAULT_SCRIPT_LANGUAGE]?.trim()) return map[DEFAULT_SCRIPT_LANGUAGE];
  const first = Object.values(map).find((v) => typeof v === 'string' && v.trim());
  return first ?? '';
}

/** Wrap a plain script as the default english entry for unlock persistence */
export function wrapEnglishScript(script: string): ScriptLanguageMap {
  const text = (script || '').trim();
  return text ? { [DEFAULT_SCRIPT_LANGUAGE]: text } : {};
}

export function mergeScriptLanguage(
  map: ScriptLanguageMap,
  language: string,
  text: string,
): ScriptLanguageMap {
  const key = language.toLowerCase();
  const value = (text || '').trim();
  if (!key || !value) return { ...map };
  return { ...map, [key]: value };
}

export function extractScriptText(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if (typeof raw.script === 'string') return unwrapScriptJson(raw.script);
    if (raw.script != null && typeof raw.script === 'object') {
      return getScriptTextFromMap(parseScriptLanguageMap(raw.script));
    }
    return '';
  }
  if (typeof raw === 'string') return getScriptTextFromMap(parseScriptLanguageMap(raw));
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

  const languageMap = parseScriptLanguageMap(raw?.script);
  const scriptText = getScriptTextFromMap(languageMap) || extractScriptText(raw);

  return {
    ...raw,
    script: scriptText,
    scriptsByLanguage: Object.keys(languageMap).length
      ? languageMap
      : scriptText
        ? wrapEnglishScript(scriptText)
        : undefined,
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
