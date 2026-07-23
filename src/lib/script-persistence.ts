import { supabase } from '@/lib/supabaseClient';
import type { BookReference, GeneratedScriptData, YoutubeMetadata } from '@/services/api';

function normalizeScriptForMatch(raw: string | null | undefined): string {
  const text = (raw || '').trim();
  if (!text) return '';
  if (!text.startsWith('{')) return text;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.script === 'string') return parsed.script.trim();
  } catch { /* ignore */ }
  return text;
}

/** Column on scripts_universal / scripts_assigned for AI thumbnail output (jsonb) */
export const THUMBNAIL_GENERATED_COLUMN = 'thumbnail-generated';

/** Select list for script rows — hyphenated column must be quoted for PostgREST */
export const SCRIPT_ROW_SELECT =
  `id, title, topic, description, script, youtube_metadata, thumbnail, metrics, sources, books, structure, category, sub_category, "${THUMBNAIL_GENERATED_COLUMN}"`;

/** Normalize API/DB category (string | jsonb) → display string */
export function normalizeScriptCategory(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t || null;
  }
  if (Array.isArray(raw)) {
    const first = raw.find((v) => typeof v === 'string' && v.trim());
    return first ? String(first).trim() : null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const name = obj.name ?? obj.label ?? obj.category;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return null;
}

/** Normalize API/DB subcategories → string[] */
export function normalizeScriptSubcategories(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      return normalizeScriptSubcategories(parsed);
    } catch {
      return [t];
    }
  }
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }
  return [];
}

/** Shape stored in scripts_*.category (jsonb) */
export function toCategoryJson(raw: unknown): string | null {
  return normalizeScriptCategory(raw);
}

/** Shape stored in scripts_*.sub_category (jsonb array) */
export function toSubCategoryJson(raw: unknown): string[] | null {
  const list = normalizeScriptSubcategories(raw);
  return list.length ? list : null;
}

/** Shape stored in thumbnail-generated (single item or list from /generate-thumbnail) */
export type GeneratedThumbnailItem = {
  prompt: string | null;
  public_url: string | null;
  error: string | null;
};

export type GeneratedThumbnailPayload = GeneratedThumbnailItem | GeneratedThumbnailItem[];

/** Read thumbnail-generated from a Supabase row (hyphenated key). */
export function readThumbnailGeneratedColumn(
  row: Record<string, unknown> | null | undefined,
): unknown {
  if (!row) return null;
  return row[THUMBNAIL_GENERATED_COLUMN] ?? row.thumbnail_generated ?? null;
}

/** Normalize DB / API thumbnail-generated jsonb into a displayable item */
export function normalizeGeneratedThumbnail(
  raw: unknown,
): GeneratedThumbnailItem | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http')) {
      return { prompt: null, public_url: trimmed, error: null };
    }
    try {
      return normalizeGeneratedThumbnail(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    const first =
      raw.find((t) => t && typeof t === 'object' && (t as any).public_url) ?? raw[0];
    return normalizeGeneratedThumbnail(first);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.thumbnail != null && typeof obj.thumbnail === 'object') {
      return normalizeGeneratedThumbnail(obj.thumbnail);
    }
    return {
      prompt: (obj.prompt as string | null) ?? null,
      public_url: (obj.public_url as string | null) ?? null,
      error: (obj.error as string | null) ?? null,
    };
  }
  return null;
}

/**
 * Persist shape for jsonb: keep arrays as-is; wrap a single object in an array
 * so the column consistently holds a thumbnail array.
 */
export function toThumbnailGeneratedJson(
  thumbnail: GeneratedThumbnailPayload | null | undefined,
): GeneratedThumbnailItem[] | null {
  if (thumbnail == null) return null;
  if (Array.isArray(thumbnail)) return thumbnail;
  return [thumbnail];
}

/** Row shape shared by scripts_universal and scripts_assigned */
export type ScriptTableRow = {
  userId: string;
  title: string;
  topic: string;
  description: string;
  script: string;
  youtube_metadata: YoutubeMetadata | null;
  thumbnail: unknown;
  metrics: GeneratedScriptData['metrics'] | null;
  sources: string[];
  books: BookReference[];
  structure: Array<{ name: string; percentage: number }>;
  /** jsonb — primary category label */
  category: string | null;
  /** jsonb — subcategory tags */
  sub_category: string[] | null;
};

function resolveThumbnail(data: GeneratedScriptData | Record<string, unknown>): unknown {
  const raw = data as Record<string, unknown>;
  if (raw.thumbnail != null) return raw.thumbnail;
  const yt = (raw.youtube_metadata ?? (raw.seo as any)?.youtube_metadata) as YoutubeMetadata | undefined;
  if (yt?.thumbnail_text?.length) return yt.thumbnail_text;
  return null;
}

export function buildScriptTableRow(
  data: GeneratedScriptData,
  opts: { title?: string; topic?: string; description?: string; userId: string },
): ScriptTableRow {
  const sources = data.sources ?? data.source_urls ?? [];
  const books = data.books ?? data.seo?.books ?? [];
  const youtube_metadata =
    data.youtube_metadata ?? data.seo?.youtube_metadata ?? null;

  return {
    userId: opts.userId,
    title: opts.title || data.title || opts.topic || 'Untitled',
    topic: opts.topic || data.title || opts.title || 'Untitled',
    description: opts.description?.trim() || data.synopsis?.trim() || '',
    script: data.script || '',
    youtube_metadata,
    thumbnail: resolveThumbnail(data),
    metrics: data.metrics ?? null,
    sources,
    books,
    structure: Array.isArray(data.structure) ? data.structure : [],
    category: toCategoryJson(data.category),
    sub_category: toSubCategoryJson(data.subcategories ?? (data as any).sub_category),
  };
}

/** Insert a freshly generated script into scripts_universal. Returns the new row id. */
export async function saveScriptToUniversal(
  data: GeneratedScriptData,
  opts: { title?: string; topic?: string; description?: string; userId: string },
): Promise<string | null> {
  const row = buildScriptTableRow(data, opts);
  const { data: inserted, error } = await supabase
    .from('scripts_universal')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[scripts_universal insert]', error.message);
    return null;
  }
  return inserted?.id ?? null;
}

/**
 * On unlock: copy into scripts_assigned (same content shape + userId),
 * then remove from scripts_universal.
 */
export async function moveScriptToAssigned(opts: {
  userId: string;
  data: GeneratedScriptData;
  title?: string;
  topic?: string;
  description?: string;
  universalScriptId?: string | null;
}): Promise<{ ok: boolean; error?: string; assignedId?: string | null }> {
  const row = buildScriptTableRow(opts.data, {
    title: opts.title,
    topic: opts.topic,
    description: opts.description,
    userId: opts.userId,
  });

  let thumbnailGenerated: unknown = null;
  if (opts.universalScriptId) {
    const { data: uni } = await supabase
      .from('scripts_universal')
      .select(`"${THUMBNAIL_GENERATED_COLUMN}"`)
      .eq('id', opts.universalScriptId)
      .maybeSingle();
    thumbnailGenerated = readThumbnailGeneratedColumn(
      uni as Record<string, unknown> | null,
    );
  } else if (opts.data.thumbnail_generated != null) {
    thumbnailGenerated = toThumbnailGeneratedJson(
      opts.data.thumbnail_generated as GeneratedThumbnailPayload,
    );
  }

  const insertPayload = thumbnailGenerated
    ? { ...row, [THUMBNAIL_GENERATED_COLUMN]: thumbnailGenerated }
    : row;

  const { data: inserted, error: insertError } = await supabase
    .from('scripts_assigned')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    console.error('[scripts_assigned insert]', insertError.message);
    return { ok: false, error: insertError.message };
  }

  if (opts.universalScriptId) {
    const { error: deleteError } = await supabase
      .from('scripts_universal')
      .delete()
      .eq('id', opts.universalScriptId);
    if (deleteError) {
      console.error('[scripts_universal delete]', deleteError.message);
      return { ok: false, error: deleteError.message, assignedId: inserted?.id ?? null };
    }
    return { ok: true, assignedId: inserted?.id ?? null };
  }

  // Fallback: delete matching universal row by script text when id is unknown
  if (row.script) {
    const { error: deleteError } = await supabase
      .from('scripts_universal')
      .delete()
      .eq('script', row.script);
    if (deleteError) console.error('[scripts_universal delete by script]', deleteError.message);
  }

  return { ok: true, assignedId: inserted?.id ?? null };
}

/** Persist /generate-thumbnail payload onto scripts_assigned.thumbnail-generated (jsonb). */
export async function saveGeneratedThumbnailToScript(opts: {
  /** Prefer the scripts_assigned row id after unlock */
  scriptRowId?: string | null;
  fromAssigned?: boolean;
  userId?: string | null;
  title?: string | null;
  topic?: string | null;
  description?: string | null;
  script?: string | null;
  /** Full thumbnail object or array from the API response */
  thumbnail: GeneratedThumbnailPayload;
}): Promise<{ ok: boolean; error?: string; assignedId?: string | null }> {
  const payload = toThumbnailGeneratedJson(opts.thumbnail);
  if (!payload?.length) {
    return { ok: false, error: 'Missing thumbnail payload' };
  }
  const hasUrl = payload.some((t) => !!t?.public_url);
  if (!hasUrl) {
    return { ok: false, error: 'Missing public_url in thumbnail payload' };
  }

  const userId = (opts.userId || '').trim();
  if (!userId) {
    return { ok: false, error: 'Missing userId — sign in again and retry.' };
  }

  const norm = (v: string | null | undefined) => (v || '').trim();
  const normKey = (v: string | null | undefined) => norm(v).toLowerCase();
  const normScript = (v: string | null | undefined) =>
    normalizeScriptForMatch(v);

  const title = norm(opts.title);
  const topic = norm(opts.topic);
  const description = norm(opts.description);
  const script = normScript(opts.script);

  if (!title || !topic || !script) {
    return {
      ok: false,
      error: 'Missing title, topic, or script needed to locate the unlocked row.',
    };
  }

  // 1) Load this user's assigned scripts
  const { data: rows, error: lookupError } = await supabase
    .from('scripts_assigned')
    .select('id, title, topic, description, script, userId')
    .eq('userId', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (lookupError) {
    console.error('[scripts_assigned lookup]', lookupError.message);
    return { ok: false, error: lookupError.message };
  }

  const candidates = rows ?? [];
  if (!candidates.length) {
    return {
      ok: false,
      error: 'No scripts_assigned row found for this user. Unlock the script first.',
    };
  }

  // 2) Match: userId (already filtered) → title + topic + description + script
  const titleKey = normKey(title);
  const topicKey = normKey(topic);
  const descKey = normKey(description);
  const scriptKey = script;

  const exact = candidates.find((r) => {
    if (normKey(r.title) !== titleKey) return false;
    if (normKey(r.topic) !== topicKey) return false;
    if (normKey(r.description) !== descKey) return false;
    if (normScript(r.script) !== scriptKey) return false;
    return true;
  });

  // Fallbacks when older rows have empty description or title/topic swapped
  const matched =
    exact ??
    candidates.find((r) => {
      if (normKey(r.title) !== titleKey) return false;
      if (normKey(r.topic) !== topicKey) return false;
      if (normScript(r.script) !== scriptKey) return false;
      return true;
    }) ??
    candidates.find((r) => {
      const rowTitle = normKey(r.title);
      const rowTopic = normKey(r.topic);
      const titleOrTopic =
        rowTitle === titleKey ||
        rowTitle === topicKey ||
        rowTopic === titleKey ||
        rowTopic === topicKey;
      if (!titleOrTopic) return false;
      if (descKey && normKey(r.description) && normKey(r.description) !== descKey) {
        return false;
      }
      return normScript(r.script) === scriptKey;
    }) ??
    (opts.scriptRowId
      ? candidates.find((r) => r.id === opts.scriptRowId) ?? null
      : null);

  if (!matched) {
    console.error('[thumbnail save] no content match', {
      userId,
      title,
      topic,
      descriptionLen: description.length,
      scriptLen: script.length,
      candidateCount: candidates.length,
      candidateTitles: candidates.slice(0, 5).map((r) => ({
        id: r.id,
        title: r.title,
        topic: r.topic,
      })),
    });
    return {
      ok: false,
      error:
        'Could not match an unlocked script (userId + title/topic/description/script). Unlock this script, then try again.',
    };
  }

  const assignedId = matched.id as string;

  // 3) Update the matched row (scoped to this userId)
  const updateBody = { [THUMBNAIL_GENERATED_COLUMN]: payload };

  const { data: updated, error } = await supabase
    .from('scripts_assigned')
    .update(updateBody)
    .eq('id', assignedId)
    .eq('userId', userId)
    .select(`id, "${THUMBNAIL_GENERATED_COLUMN}"`)
    .maybeSingle();

  if (error) {
    console.error(`[scripts_assigned ${THUMBNAIL_GENERATED_COLUMN}]`, error.message, error);
    return { ok: false, error: error.message, assignedId };
  }

  const expectedUrl = payload.find((t) => t.public_url)?.public_url ?? null;

  const isSavedPayload = (row: Record<string, unknown> | null | undefined) => {
    const saved = readThumbnailGeneratedColumn(row);
    const savedUrl = normalizeGeneratedThumbnail(saved)?.public_url;
    return !!(savedUrl && expectedUrl && savedUrl === expectedUrl);
  };

  if (updated?.id && isSavedPayload(updated as Record<string, unknown>)) {
    return { ok: true, assignedId };
  }

  // 4) Verify / retry: RLS sometimes hides UPDATE…RETURNING; confirm with a fresh select
  const { data: verify, error: verifyError } = await supabase
    .from('scripts_assigned')
    .select(`id, "${THUMBNAIL_GENERATED_COLUMN}"`)
    .eq('id', assignedId)
    .eq('userId', userId)
    .maybeSingle();

  if (verifyError) {
    console.error('[thumbnail verify]', verifyError.message);
    return { ok: false, error: verifyError.message, assignedId };
  }

  if (isSavedPayload(verify as Record<string, unknown> | null)) {
    return { ok: true, assignedId };
  }

  // 5) Last resort: authenticated REST PATCH (hyphenated column name)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (session?.access_token && supabaseUrl) {
      const url =
        `${supabaseUrl}/rest/v1/scripts_assigned?id=eq.${encodeURIComponent(assignedId)}` +
        `&userId=eq.${encodeURIComponent(userId)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Authorization: `Bearer ${session.access_token}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updateBody),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('[thumbnail REST PATCH]', res.status, text);
        return {
          ok: false,
          error: `Failed to save thumbnail (${res.status}). Check RLS update policy on scripts_assigned.`,
          assignedId,
        };
      }
      let patched: unknown = null;
      try {
        patched = text ? JSON.parse(text) : null;
      } catch { /* ignore */ }
      const row = Array.isArray(patched) ? patched[0] : patched;
      if (isSavedPayload(row as Record<string, unknown> | null)) {
        return { ok: true, assignedId };
      }
    }
  } catch (restErr) {
    console.error('[thumbnail REST PATCH]', restErr);
  }

  return {
    ok: false,
    error:
      'Thumbnail update matched no scripts_assigned row (check RLS update policy for thumbnail-generated).',
    assignedId,
  };
}
