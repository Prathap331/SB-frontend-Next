import { supabase } from '@/lib/supabaseClient';
import { normalizeTopicCategory } from '@/services/api';
import {
  normalizeIdeasJson,
  type TopicWorkspace,
} from '@/lib/recent-topics';

const PAGE_SIZE = 1000;
const MAX_ROWS = 30000;
const SUGGESTED_TOPIC_COUNT = 20;

export function parseProfileCategories(raw: unknown): string[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      const trimmed = raw.trim();
      return trimmed ? [trimmed] : [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const name = String(item ?? '').trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function topicKey(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function normalizeTitleKey(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const SUGGESTED_UNUSED_TOPIC_KEY = 'storio_suggested_unused_topic';

/** Tag-click: content-ideas should show only ideas without scripts. */
export function markSuggestedTopicForUnusedIdeas(topic: string): void {
  const key = topic.trim().toLowerCase();
  if (!key || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SUGGESTED_UNUSED_TOPIC_KEY, key);
  } catch { /* ignore */ }
}

export function isSuggestedUnusedIdeasTopic(topic: string): boolean {
  const key = topic.trim().toLowerCase();
  if (!key || typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(SUGGESTED_UNUSED_TOPIC_KEY) === key;
  } catch {
    return false;
  }
}

export function clearSuggestedUnusedIdeasTopic(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SUGGESTED_UNUSED_TOPIC_KEY);
  } catch { /* ignore */ }
}

function collectMatchingTitles(
  rows: unknown[] | null | undefined,
  wanted: Set<string>,
  found: Set<string>,
) {
  for (const row of rows ?? []) {
    const key = normalizeTitleKey((row as { title?: string | null }).title);
    if (key && wanted.has(key)) found.add(key);
  }
}

/**
 * Titles that already have a script. Checks scripts_universal first, then scripts_assigned.
 * Matches `title` case-insensitively, and also scripts whose `topic` matches.
 */
export async function fetchTitlesWithGeneratedScripts(
  titles: string[],
  topic?: string | null,
): Promise<Set<string>> {
  const unique = [...new Set(titles.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  const wanted = new Set(unique.map((t) => normalizeTitleKey(t)));
  const found = new Set<string>();
  if (!wanted.size) return found;

  const leftoverOriginals = () =>
    unique.filter((title) => !found.has(normalizeTitleKey(title)));

  const universalExact = await supabase
    .from('scripts_universal')
    .select('title')
    .in('title', unique);
  if (universalExact.error) {
    console.error('[scripts_universal title check]', universalExact.error.message);
  }
  collectMatchingTitles(universalExact.data, wanted, found);

  if (topic?.trim()) {
    const universalTopic = await supabase
      .from('scripts_universal')
      .select('title')
      .ilike('topic', escapeIlike(topic.trim()))
      .limit(500);
    if (universalTopic.error) {
      console.error('[scripts_universal topic check]', universalTopic.error.message);
    }
    collectMatchingTitles(universalTopic.data, wanted, found);
  }

  for (const title of leftoverOriginals()) {
    const { data, error } = await supabase
      .from('scripts_universal')
      .select('title')
      .ilike('title', escapeIlike(title))
      .limit(20);
    if (error) {
      console.error('[scripts_universal title ilike]', error.message);
      break;
    }
    collectMatchingTitles(data, wanted, found);
  }

  const leftoverAfterUniversal = leftoverOriginals();
  if (!leftoverAfterUniversal.length) return found;

  const assignedExact = await supabase
    .from('scripts_assigned')
    .select('title')
    .in('title', leftoverAfterUniversal);
  if (assignedExact.error) {
    console.error('[scripts_assigned title check]', assignedExact.error.message);
  }
  collectMatchingTitles(assignedExact.data, wanted, found);

  if (topic?.trim()) {
    const assignedTopic = await supabase
      .from('scripts_assigned')
      .select('title')
      .ilike('topic', escapeIlike(topic.trim()))
      .limit(500);
    if (assignedTopic.error) {
      console.error('[scripts_assigned topic check]', assignedTopic.error.message);
    }
    collectMatchingTitles(assignedTopic.data, wanted, found);
  }

  for (const title of leftoverOriginals()) {
    const { data, error } = await supabase
      .from('scripts_assigned')
      .select('title')
      .ilike('title', escapeIlike(title))
      .limit(20);
    if (error) {
      console.error('[scripts_assigned title ilike]', error.message);
      break;
    }
    collectMatchingTitles(data, wanted, found);
  }

  return found;
}

export async function filterIdeasWithoutGeneratedScripts<T extends { title: string }>(
  ideas: T[],
  topic?: string | null,
): Promise<T[]> {
  const generated = await fetchTitlesWithGeneratedScripts(
    ideas.map((idea) => idea.title),
    topic,
  );
  return ideas.filter((idea) => !generated.has(normalizeTitleKey(idea.title)));
}

/** Distinct values from saved_ideas.category (Supabase table, not a backend API). */
export async function fetchSavedIdeaCategories(): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('saved_ideas')
      .select('category')
      .not('category', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      const retry = await supabase
        .from('saved_ideas')
        .select('category')
        .range(from, from + PAGE_SIZE - 1);
      if (retry.error) {
        console.error('[saved_ideas category]', retry.error.message);
        break;
      }
      for (const row of retry.data ?? []) {
        const name = normalizeTopicCategory((row as { category?: unknown }).category);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
      }
      if (!retry.data || retry.data.length < PAGE_SIZE) break;
      continue;
    }

    for (const row of data ?? []) {
      const name = normalizeTopicCategory((row as { category?: unknown }).category);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function fetchCurrentUserTopicKeys(userId: string | null): Promise<Set<string>> {
  const uid = (userId || '').trim();
  if (!uid) return new Set();
  const keys = new Set<string>();
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('saved_ideas')
      .select('topic')
      .eq('userId', uid)
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('[saved_ideas user topics]', error.message);
      break;
    }
    for (const row of data ?? []) {
      const key = topicKey((row as { topic?: string | null }).topic);
      if (key) keys.add(key);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return keys;
}

/** Topics in this category owned by other users — never the signed-in userId. */
export async function fetchSuggestedTopicsForCategory(opts: {
  category: string;
  userId: string | null;
  limit?: number;
}): Promise<string[]> {
  const category = opts.category.trim();
  if (!category) return [];
  const limit = opts.limit ?? SUGGESTED_TOPIC_COUNT;
  const uid = (opts.userId || '').trim();
  const ownTopics = await fetchCurrentUserTopicKeys(uid || null);
  const catKey = category.toLowerCase();
  const seen = new Set<string>(ownTopics);
  const topics: string[] = [];

  for (let from = 0; from < MAX_ROWS && topics.length < limit; from += PAGE_SIZE) {
    let query = supabase
      .from('saved_ideas')
      .select('topic, category, userId')
      .ilike('category', escapeIlike(category))
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (uid) {
      query = query.neq('userId', uid);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[saved_ideas suggested topics]', error.message);
      break;
    }

    for (const row of data ?? []) {
      const rec = row as { topic?: string | null; category?: unknown; userId?: string | null };
      if (uid && rec.userId && String(rec.userId) === uid) continue;
      if (normalizeTopicCategory(rec.category).toLowerCase() !== catKey) continue;
      const topic = String(rec.topic ?? '').trim();
      const key = topicKey(topic);
      if (!topic || seen.has(key)) continue;
      seen.add(key);
      topics.push(topic);
      if (topics.length >= limit) break;
    }
    if (!data || data.length < PAGE_SIZE) break;
  }

  return topics;
}

/** Ideas from another user's saved_ideas row, excluding titles that already have scripts. */
export async function loadSharedSavedIdeasTopic(
  topic: string,
  userId?: string | null,
): Promise<TopicWorkspace | null> {
  const trimmed = topic.trim();
  if (!trimmed) return null;
  const uid = (userId || '').trim();

  let query = supabase
    .from('saved_ideas')
    .select('id, created_at, topic, ideas, userId, topic_summary, category, sources, books')
    .ilike('topic', escapeIlike(trimmed))
    .order('created_at', { ascending: false })
    .limit(30);

  if (uid) {
    query = query.neq('userId', uid);
  }

  const { data, error } = await query;
  const rows = (!error ? data : null) as Array<{
    topic?: string | null;
    ideas?: unknown;
    created_at?: string | null;
    topic_summary?: string | null;
    category?: unknown;
    sources?: unknown;
    books?: unknown;
    userId?: string | null;
  }> | null;

  if (error) {
    console.error('[saved_ideas shared topic]', error.message);
    return null;
  }

  const preferred = (rows ?? []).find((row) => {
    const ideas = normalizeIdeasJson(row.ideas);
    if (!ideas.length) return false;
    if (uid && row.userId && String(row.userId) === uid) return false;
    return true;
  });

  if (!preferred) return null;

  const ideas = normalizeIdeasJson(preferred.ideas);
  const remaining = await filterIdeasWithoutGeneratedScripts(ideas, trimmed);

  const sources = Array.isArray(preferred.sources)
    ? preferred.sources
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return String(obj.url ?? obj.link ?? obj.href ?? '').trim();
          }
          return '';
        })
        .filter(Boolean)
    : [];
  const books = Array.isArray(preferred.books)
    ? preferred.books
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const obj = item as Record<string, unknown>;
          const title = String(obj.title ?? '').trim();
          if (!title) return null;
          return { title, author: String(obj.author ?? '').trim() };
        })
        .filter((b): b is { title: string; author: string } => !!b)
    : [];

  return {
    topic: String(preferred.topic ?? trimmed).trim() || trimmed,
    ideas: remaining.map((idea) => ({
      ...idea,
      generated: false,
      script: null,
      scriptRowId: null,
      fromAssigned: false,
    })),
    createdAt: preferred.created_at ?? null,
    topicSummary: preferred.topic_summary ?? null,
    category: normalizeTopicCategory(preferred.category) || null,
    sources,
    books,
    shared: true,
  };
}
