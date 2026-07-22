import { supabase } from '@/lib/supabaseClient';
import type { BookReference, GeneratedScriptData, YoutubeMetadata } from '@/services/api';

/** Row shape shared by scripts_universal and scripts_assigned */
export type ScriptTableRow = {
  userId: string;
  title: string;
  topic: string;
  script: string;
  youtube_metadata: YoutubeMetadata | null;
  thumbnail: unknown;
  metrics: GeneratedScriptData['metrics'] | null;
  sources: string[];
  books: BookReference[];
  structure: Array<{ name: string; percentage: number }>;
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
  opts: { title?: string; topic?: string; userId: string },
): ScriptTableRow {
  const sources = data.sources ?? data.source_urls ?? [];
  const books = data.books ?? data.seo?.books ?? [];
  const youtube_metadata =
    data.youtube_metadata ?? data.seo?.youtube_metadata ?? null;

  return {
    userId: opts.userId,
    title: opts.title || data.title || opts.topic || 'Untitled',
    topic: opts.topic || data.title || opts.title || 'Untitled',
    script: data.script || '',
    youtube_metadata,
    thumbnail: resolveThumbnail(data),
    metrics: data.metrics ?? null,
    sources,
    books,
    structure: Array.isArray(data.structure) ? data.structure : [],
  };
}

/** Insert a freshly generated script into scripts_universal. Returns the new row id. */
export async function saveScriptToUniversal(
  data: GeneratedScriptData,
  opts: { title?: string; topic?: string; userId: string },
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
  universalScriptId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const row = buildScriptTableRow(opts.data, {
    title: opts.title,
    topic: opts.topic,
    userId: opts.userId,
  });

  const { error: insertError } = await supabase.from('scripts_assigned').insert(row);

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
      return { ok: false, error: deleteError.message };
    }
    return { ok: true };
  }

  // Fallback: delete matching universal row by script text when id is unknown
  if (row.script) {
    const { error: deleteError } = await supabase
      .from('scripts_universal')
      .delete()
      .eq('script', row.script);
    if (deleteError) console.error('[scripts_universal delete by script]', deleteError.message);
  }

  return { ok: true };
}
