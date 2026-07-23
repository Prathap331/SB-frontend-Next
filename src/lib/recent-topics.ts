import { supabase } from '@/lib/supabaseClient';
import type { GeneratedScriptData } from '@/services/api';
import { ApiService } from '@/services/api';
import { normalizeScriptData } from '@/lib/script-data';
import { SCRIPT_ROW_SELECT } from '@/lib/script-persistence';

export const TOTAL_STAGES = 5;

/** Sidebar row for Recent Topics (from saved_ideas) */
export type RecentTopicItem = {
  id: string;
  topic: string;
  createdAt: string;
  ideasCount: number;
  stagesCompleted: number;
};

export type ScriptIdeaBase = {
  id: number;
  title: string;
  description: string;
  category: string;
};

/** Idea merged with any generated script from scripts_assigned / scripts_universal */
export type MergedIdea = ScriptIdeaBase & {
  generated: boolean;
  script: GeneratedScriptData | null;
  scriptRowId?: string | null;
  fromAssigned?: boolean;
};

export type TopicWorkspace = {
  topic: string;
  ideas: MergedIdea[];
  createdAt: string | null;
};

/**
 * Matches saved_ideas columns from DB export:
 * id, created_at, topic, ideas, topic_embeddings, summary_embeddings, userId
 * (embeddings are never selected — too large)
 */
type SavedIdeaRow = {
  id: number | string;
  created_at: string;
  topic: string;
  ideas: unknown;
  userId: string | null;
};

type ScriptDbRow = {
  id: string;
  title: string | null;
  topic: string | null;
  description?: string | null;
  script: string | null;
  youtube_metadata?: unknown;
  thumbnail?: unknown;
  'thumbnail-generated'?: unknown;
  thumbnail_generated?: unknown;
  category?: unknown;
  sub_category?: unknown;
  metrics?: GeneratedScriptData['metrics'] | null;
  sources?: string[] | null;
  books?: GeneratedScriptData['books'] | null;
  structure?: GeneratedScriptData['structure'] | null;
};

function coerceIdeasRaw(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return raw;
}

function normalizeIdeasJson(raw: unknown): ScriptIdeaBase[] {
  const parsed = coerceIdeasRaw(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return [];

  // Shape A: ["Title 1", "Title 2"]
  if (typeof parsed[0] === 'string') {
    return (parsed as string[]).map((title, idx) => ({
      id: idx + 1,
      title,
      description: 'No description available.',
      category: 'General',
    }));
  }

  // Shape B: [{ title, description, ... }]  ← actual saved_ideas format
  return (parsed as any[]).map((item, idx) => ({
    id: typeof item?.id === 'number' ? item.id : idx + 1,
    title: String(item?.title ?? item?.idea ?? `Idea ${idx + 1}`),
    description: String(item?.description ?? 'No description available.'),
    category: String(item?.category ?? 'General'),
  }));
}

function rowToScriptData(row: ScriptDbRow): GeneratedScriptData {
  return normalizeScriptData({
    ...row,
    title: row.title ?? undefined,
    youtube_metadata: row.youtube_metadata,
    thumbnail: row.thumbnail,
    'thumbnail-generated':
      row['thumbnail-generated'] ?? row.thumbnail_generated ?? null,
    metrics: row.metrics,
    sources: row.sources,
    books: row.books,
    structure: row.structure,
    script: row.script,
  });
}

function stagesFromCounts(ideasCount: number, scriptCount: number, hasMeta: boolean, hasThumb: boolean): number {
  let n = 0;
  if (ideasCount > 0) n += 1;
  if (scriptCount > 0) n += 1;
  if (hasMeta) n += 1;
  if (hasThumb) n += 1;
  return n;
}

async function resolveUserId(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Recent topics from saved_ideas for the signed-in user.
 * Dedupes by topic (same userId + same topic → one row, newest created_at wins).
 */
export async function fetchRecentTopics(userId?: string | null, limit = 40): Promise<RecentTopicItem[]> {
  const uid = await resolveUserId(userId);
  if (!uid) {
    console.warn('[saved_ideas recent] no userId — skipping fetch');
    return [];
  }

  const { data, error } = await supabase
    .from('saved_ideas')
    .select('id, created_at, topic, ideas, userId')
    .eq('userId', uid)
    .order('created_at', { ascending: false })
    .limit(Math.max(limit * 5, 100));

  if (error) {
    console.error('[saved_ideas recent]', error.message, error);
    return [];
  }

  const rows = (data ?? []) as SavedIdeaRow[];
  console.log(`[saved_ideas recent] userId=${uid} rows=${rows.length}`);

  // Dedupe by topic — keep first row (already newest-first from order)
  const byTopic = new Map<string, SavedIdeaRow>();
  for (const row of rows) {
    const key = (row.topic || '').trim().toLowerCase();
    if (!key || byTopic.has(key)) continue;
    byTopic.set(key, row);
  }

  const unique = Array.from(byTopic.values()).slice(0, limit);
  const topics = unique.map((r) => r.topic.trim());
  const scriptStats = new Map<string, { count: number; hasMeta: boolean; hasThumb: boolean }>();

  if (topics.length > 0) {
    const [assignedRes, universalRes] = await Promise.all([
      supabase
        .from('scripts_assigned')
        .select('topic, title, youtube_metadata, thumbnail')
        .eq('userId', uid)
        .in('topic', topics),
      supabase
        .from('scripts_universal')
        .select('topic, title, youtube_metadata, thumbnail')
        .eq('userId', uid)
        .in('topic', topics),
    ]);

    const allScripts = [...(assignedRes.data ?? []), ...(universalRes.data ?? [])];
    for (const s of allScripts) {
      const key = String(s.topic || '').trim().toLowerCase();
      if (!key) continue;
      const prev = scriptStats.get(key) ?? { count: 0, hasMeta: false, hasThumb: false };
      prev.count += 1;
      const meta = s.youtube_metadata as any;
      if (meta && (meta.titles?.length || meta.descriptions?.length || meta.hashtags?.length)) {
        prev.hasMeta = true;
      }
      const thumb = s.thumbnail;
      if (
        (Array.isArray(thumb) && thumb.length > 0) ||
        (meta?.thumbnail_text?.length)
      ) {
        prev.hasThumb = true;
      }
      scriptStats.set(key, prev);
    }
  }

  return unique.map((row) => {
    const ideas = normalizeIdeasJson(row.ideas);
    const key = row.topic.trim().toLowerCase();
    const stats = scriptStats.get(key);
    return {
      id: String(row.id),
      topic: row.topic.trim(),
      createdAt: row.created_at,
      ideasCount: ideas.length,
      stagesCompleted: stagesFromCounts(
        ideas.length,
        stats?.count ?? 0,
        stats?.hasMeta ?? false,
        stats?.hasThumb ?? false,
      ),
    };
  });
}

/** Persist generated content ideas via backend /save-ideas (not direct Supabase insert). */
export async function saveTopicIdeasToDb(
  topic: string,
  ideas: ScriptIdeaBase[],
  opts?: { topicSummary?: string | null; userId?: string | null },
): Promise<boolean> {
  const trimmed = topic.trim();
  if (!trimmed || !ideas.length) return false;

  const userId = await resolveUserId(opts?.userId);
  if (!userId) {
    console.error('[save-ideas] no authenticated user');
    return false;
  }

  try {
    await ApiService.saveIdeas({
      topic: trimmed,
      topic_summary: opts?.topicSummary ?? null,
      userId,
      ideas: ideas.map((i) => ({
        title: i.title,
        description: i.description,
      })),
    });
  } catch (err) {
    console.error('[save-ideas]', err);
    return false;
  }

  try {
    window.dispatchEvent(
      new CustomEvent('studio-storage-updated', {
        detail: { topic: trimmed, ideasCount: ideas.length, userId },
      }),
    );
  } catch { /* ignore */ }

  return true;
}

async function fetchScriptsForTopic(
  topic: string,
  userId: string,
  ideaTitles: string[] = [],
): Promise<Array<ScriptDbRow & { fromAssigned: boolean }>> {
  const trimmed = topic.trim();
  const topicKey = trimmed.toLowerCase();
  const titleKeys = new Set(
    ideaTitles.map((t) => t.trim().toLowerCase()).filter(Boolean),
  );

  // Pull recent scripts for this user, then match client-side by topic OR idea title.
  // (Exact .eq('topic') misses when URL casing/spacing drifts; title match covers locked + unlocked.)
  const [assigned, universal] = await Promise.all([
    supabase
      .from('scripts_assigned')
      .select(SCRIPT_ROW_SELECT)
      .eq('userId', userId)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('scripts_universal')
      .select(SCRIPT_ROW_SELECT)
      .eq('userId', userId)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  if (assigned.error) console.error('[scripts_assigned]', assigned.error.message);
  if (universal.error) console.error('[scripts_universal]', universal.error.message);

  const matchesTopicOrTitle = (row: ScriptDbRow) => {
    const rowTopic = (row.topic || '').trim().toLowerCase();
    const rowTitle = (row.title || '').trim().toLowerCase();
    if (rowTopic && rowTopic === topicKey) return true;
    if (rowTitle && titleKeys.has(rowTitle)) return true;
    return false;
  };

  const byTitle = new Map<string, ScriptDbRow & { fromAssigned: boolean }>();

  for (const row of (universal.data ?? []) as ScriptDbRow[]) {
    if (!matchesTopicOrTitle(row)) continue;
    const t = (row.title || '').trim().toLowerCase();
    if (!t) continue;
    byTitle.set(t, { ...row, fromAssigned: false });
  }
  // Assigned (unlocked) wins on title collision
  for (const row of (assigned.data ?? []) as ScriptDbRow[]) {
    if (!matchesTopicOrTitle(row)) continue;
    const t = (row.title || '').trim().toLowerCase();
    if (!t) continue;
    byTitle.set(t, { ...row, fromAssigned: true });
  }

  return Array.from(byTitle.values());
}

function mergeIdeasWithScripts(
  ideas: ScriptIdeaBase[],
  scripts: Array<ScriptDbRow & { fromAssigned?: boolean }>,
): MergedIdea[] {
  const generatedScripts: Record<string, ScriptDbRow & { fromAssigned?: boolean }> = {};
  for (const script of scripts) {
    const key = (script.title || '').trim().toLowerCase();
    if (key) generatedScripts[key] = script;
  }

  const ideaTitleKeys = new Set(
    ideas.map((i) => i.title.trim().toLowerCase()).filter(Boolean),
  );

  const merged: MergedIdea[] = ideas.map((idea) => {
    const generated = generatedScripts[idea.title.trim().toLowerCase()];
    if (!generated) {
      return { ...idea, generated: false, script: null, scriptRowId: null, fromAssigned: false };
    }
    return {
      ...idea,
      // Prefer idea description; fall back to script row description
      description: idea.description || generated.description || idea.description,
      generated: true,
      script: rowToScriptData(generated),
      scriptRowId: generated.id,
      fromAssigned: !!generated.fromAssigned,
    };
  });

  // Restore orphan scripts that exist for this topic but were dropped from saved_ideas
  // (e.g. older /save-ideas overwrites that omitted the generated idea).
  let nextId = Math.max(0, ...merged.map((i) => i.id), 0) + 1;
  for (const script of scripts) {
    const key = (script.title || '').trim().toLowerCase();
    if (!key || ideaTitleKeys.has(key)) continue;
    merged.push({
      id: nextId++,
      title: script.title || 'Untitled',
      description: script.description?.trim() || 'No description available.',
      category: 'General',
      generated: true,
      script: rowToScriptData(script),
      scriptRowId: script.id,
      fromAssigned: !!script.fromAssigned,
    });
  }

  return merged;
}

/**
 * Load a topic workspace from saved_ideas (for this user) + scripts.
 * Dedupes duplicate topic rows — newest created_at wins.
 */
export async function loadTopicWorkspace(
  topic: string,
  userId: string | null | undefined,
): Promise<TopicWorkspace | null> {
  const trimmed = topic.trim();
  const uid = await resolveUserId(userId);
  if (!trimmed || !uid) return null;

  const { data, error } = await supabase
    .from('saved_ideas')
    .select('id, created_at, topic, ideas, userId')
    .eq('userId', uid)
    .eq('topic', trimmed)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[saved_ideas load]', error.message, error);
    return null;
  }

  const row = (data?.[0] ?? null) as SavedIdeaRow | null;
  if (!row) {
    // Case-insensitive fallback: topic strings may differ in casing
    const { data: allForUser, error: listErr } = await supabase
      .from('saved_ideas')
      .select('id, created_at, topic, ideas, userId')
      .eq('userId', uid)
      .order('created_at', { ascending: false })
      .limit(100);

    if (listErr) {
      console.error('[saved_ideas load fallback]', listErr.message);
      return null;
    }

    const match = ((allForUser ?? []) as SavedIdeaRow[]).find(
      (r) => (r.topic || '').trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (!match) return null;

    const ideas = normalizeIdeasJson(match.ideas);
    const scripts = await fetchScriptsForTopic(
      match.topic.trim(),
      uid,
      ideas.map((i) => i.title),
    );
    const merged = mergeIdeasWithScripts(ideas, scripts);
    // Heal saved_ideas if older overwrites dropped generated ideas
    if (merged.length > ideas.length) {
      void saveTopicIdeasToDb(match.topic.trim(), merged, { userId: uid });
    }
    return {
      topic: match.topic.trim(),
      ideas: merged,
      createdAt: match.created_at ?? null,
    };
  }

  const ideas = normalizeIdeasJson(row.ideas);
  const scripts = await fetchScriptsForTopic(
    trimmed,
    uid,
    ideas.map((i) => i.title),
  );

  const merged = mergeIdeasWithScripts(ideas, scripts);
  if (merged.length > ideas.length) {
    void saveTopicIdeasToDb(trimmed, merged, { userId: uid });
  }

  return {
    topic: trimmed,
    ideas: merged,
    createdAt: row.created_at ?? null,
  };
}

/** Re-merge after a new script is generated in-session */
export function mergeLocalScriptOntoIdeas(
  ideas: MergedIdea[],
  ideaTitle: string,
  script: GeneratedScriptData,
  scriptRowId?: string | null,
): MergedIdea[] {
  const key = ideaTitle.trim().toLowerCase();
  return ideas.map((idea) =>
    idea.title.trim().toLowerCase() === key
      ? {
          ...idea,
          generated: true,
          script,
          scriptRowId: scriptRowId ?? idea.scriptRowId ?? null,
        }
      : idea,
  );
}

export function countCompletedStagesFromMerged(ideas: MergedIdea[]): number {
  const withScript = ideas.filter((i) => i.generated && i.script);
  if (!ideas.length) return 0;
  let n = 1;
  if (withScript.length > 0) n += 1;
  const anyMeta = withScript.some((i) => {
    const m = i.script?.youtube_metadata;
    return !!(m?.titles?.length || m?.descriptions?.length || m?.hashtags?.length);
  });
  if (anyMeta) n += 1;
  const anyThumb = withScript.some((i) => {
    const m = i.script?.youtube_metadata;
    return !!(m?.thumbnail_text?.length || i.script?.thumbnail);
  });
  if (anyThumb) n += 1;
  return n;
}
