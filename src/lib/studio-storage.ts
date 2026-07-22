import type { GeneratedScriptData, SimilarPastIdea } from '@/services/api';

export type StudioStage = 'ideas' | 'script' | 'metadata' | 'thumbnails' | 'broll';

export interface StudioIdea {
  id: number;
  title: string;
  description: string;
  category: string;
  /** Idea has a generated script (card highlight) */
  hasScript?: boolean;
  videoLength?: string;
}

export interface StudioTopicRecord {
  topic: string;
  updatedAt: number;
  createdAt: number;
  topicSummary: string | null;
  ideas: StudioIdea[];
  similarPastIdeas: SimilarPastIdea[];
  /** Idea id currently selected for script/metadata/thumbnails */
  selectedIdeaId: number | null;
  /** Generated script payloads keyed by idea id */
  scripts: Record<string, {
    data: GeneratedScriptData;
    ideaTitle: string;
    generatedAt: number;
  }>;
}

const RECENT_KEY = 'studio_recent_topics';
const TOPIC_PREFIX = 'studio_topic_';
const MAX_RECENT = 30;

function topicKey(topic: string) {
  return `${TOPIC_PREFIX}${topic.trim().toLowerCase()}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getRecentTopics(): StudioTopicRecord[] {
  if (typeof window === 'undefined') return [];
  const list = safeParse<string[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  const records: StudioTopicRecord[] = [];
  for (const t of list) {
    const rec = getTopicRecord(t);
    if (rec) records.push(rec);
  }
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getTopicRecord(topic: string): StudioTopicRecord | null {
  if (typeof window === 'undefined' || !topic) return null;
  return safeParse<StudioTopicRecord>(localStorage.getItem(topicKey(topic)));
}

export function saveTopicRecord(record: StudioTopicRecord): void {
  if (typeof window === 'undefined') return;
  const normalized = {
    ...record,
    topic: record.topic.trim(),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(topicKey(normalized.topic), JSON.stringify(normalized));
  } catch {
    // prune oldest recent and retry
    pruneOldestTopic();
    try {
      localStorage.setItem(topicKey(normalized.topic), JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }
  touchRecent(normalized.topic);
}

function touchRecent(topic: string) {
  const key = topic.trim().toLowerCase();
  const list = safeParse<string[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  const next = [key, ...list.filter((t) => t !== key)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function pruneOldestTopic() {
  const list = safeParse<string[]>(localStorage.getItem(RECENT_KEY)) ?? [];
  if (list.length === 0) return;
  const oldest = list[list.length - 1];
  localStorage.removeItem(topicKey(oldest));
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, -1)));
}

export function upsertTopicIdeas(opts: {
  topic: string;
  ideas: StudioIdea[];
  topicSummary?: string | null;
  similarPastIdeas?: SimilarPastIdea[];
}): StudioTopicRecord {
  const existing = getTopicRecord(opts.topic);
  const now = Date.now();

  // Preserve hasScript / scripts from existing record when titles match
  const prevByTitle = new Map(
    (existing?.ideas ?? []).map((i) => [i.title.toLowerCase(), i]),
  );

  const ideas = opts.ideas.map((idea) => {
    const prev = prevByTitle.get(idea.title.toLowerCase());
    return {
      ...idea,
      hasScript: prev?.hasScript ?? idea.hasScript ?? false,
      videoLength: idea.videoLength ?? prev?.videoLength,
    };
  });

  const record: StudioTopicRecord = {
    topic: opts.topic.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    topicSummary: opts.topicSummary ?? existing?.topicSummary ?? null,
    ideas,
    similarPastIdeas: opts.similarPastIdeas ?? existing?.similarPastIdeas ?? [],
    selectedIdeaId: existing?.selectedIdeaId ?? null,
    scripts: existing?.scripts ?? {},
  };

  // Re-mark ideas that already have saved scripts
  for (const idea of record.ideas) {
    if (record.scripts[String(idea.id)] || Object.values(record.scripts).some(
      (s) => s.ideaTitle.toLowerCase() === idea.title.toLowerCase(),
    )) {
      idea.hasScript = true;
    }
  }

  saveTopicRecord(record);
  return record;
}

export function markIdeaScriptGenerated(
  topic: string,
  idea: StudioIdea,
  scriptData: GeneratedScriptData,
): StudioTopicRecord | null {
  const existing = getTopicRecord(topic) ?? {
    topic: topic.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    topicSummary: null,
    ideas: [idea],
    similarPastIdeas: [],
    selectedIdeaId: idea.id,
    scripts: {},
  };

  const ideas = existing.ideas.some((i) => i.id === idea.id)
    ? existing.ideas.map((i) =>
        i.id === idea.id ? { ...i, hasScript: true, title: idea.title, description: idea.description } : i,
      )
    : [...existing.ideas, { ...idea, hasScript: true }];

  const record: StudioTopicRecord = {
    ...existing,
    ideas,
    selectedIdeaId: idea.id,
    scripts: {
      ...existing.scripts,
      [String(idea.id)]: {
        data: scriptData,
        ideaTitle: idea.title,
        generatedAt: Date.now(),
      },
    },
  };

  saveTopicRecord(record);
  return record;
}

export function markIdeaPendingScript(topic: string, idea: StudioIdea, length?: string): void {
  const existing = getTopicRecord(topic);
  if (!existing) {
    saveTopicRecord({
      topic: topic.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      topicSummary: null,
      ideas: [{ ...idea, hasScript: true, videoLength: length }],
      similarPastIdeas: [],
      selectedIdeaId: idea.id,
      scripts: {},
    });
    return;
  }

  saveTopicRecord({
    ...existing,
    selectedIdeaId: idea.id,
    ideas: existing.ideas.map((i) =>
      i.id === idea.id
        ? { ...i, hasScript: true, videoLength: length ?? i.videoLength }
        : i,
    ),
  });
}

/** Count completed stages for sidebar progress (ideas / script / metadata / thumbnails / broll) */
export function countCompletedStages(record: StudioTopicRecord): number {
  let n = 0;
  if (record.ideas.length > 0) n += 1;
  const selected =
    (record.selectedIdeaId != null && record.scripts[String(record.selectedIdeaId)]) ||
    Object.values(record.scripts)[0];
  if (selected?.data?.script) n += 1;
  const meta = selected?.data?.youtube_metadata ?? selected?.data?.seo?.youtube_metadata;
  if (meta && (meta.titles?.length || meta.descriptions?.length || meta.hashtags?.length)) n += 1;
  if (meta?.thumbnail_text?.length || selected?.data?.seo?.seo?.thumbnail_brief?.length) n += 1;
  // B-roll not available yet — never counts
  return n;
}

export const TOTAL_STAGES = 5;

/** Load a script_* localStorage entry by idea title (shared with script page) */
export function loadLegacyScriptCache(ideaTitle: string): GeneratedScriptData | null {
  if (typeof window === 'undefined' || !ideaTitle) return null;
  try {
    const safeKey = ideaTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const raw = localStorage.getItem(`script_${safeKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: GeneratedScriptData; timestamp?: number };
    if (!parsed?.data) return null;
    if (parsed.timestamp && Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function syncScriptsFromLegacyCache(topic: string): StudioTopicRecord | null {
  const record = getTopicRecord(topic);
  if (!record) return null;
  let changed = false;
  const scripts = { ...record.scripts };
  const ideas = record.ideas.map((idea) => {
    if (scripts[String(idea.id)]?.data) return idea;
    const legacy = loadLegacyScriptCache(idea.title);
    if (legacy) {
      scripts[String(idea.id)] = {
        data: legacy,
        ideaTitle: idea.title,
        generatedAt: Date.now(),
      };
      changed = true;
      return { ...idea, hasScript: true };
    }
    return idea;
  });
  if (!changed) return record;
  const next = { ...record, ideas, scripts };
  saveTopicRecord(next);
  return next;
}
