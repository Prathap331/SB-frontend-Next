import { getScriptTextFromMap, parseScriptLanguageMap } from '@/lib/script-data';
import { supabase } from '@/lib/supabaseClient';
import type {
  EditVideoBeatAsset,
  EditVideoInfographicListItem,
  EditVideoResponse,
  EditVideoScene,
  EditVideoTextListItem,
  EditVideoTimeline,
  EditVideoTimelineTrack,
} from '@/services/api';
import { addClipToTrack, createSceneTimelinesMap, type LegacySceneLike } from './migrate';
import {
  parseRemotionInfographic,
  remotionDurationSeconds,
  remotionInfographicLabel,
  remotionPayloadFromSpec,
  seededTextFromOverlayItem,
  kenBurnsFromTrack,
  overlayWindowSeconds,
  placementToPreviewOffsets,
  mergeOverlayTrackOntoItem,
  rebaseOverlaySpec,
  rebaseSeededText,
  isOverlayGraphicTrack,
  parseIconList,
} from './infographics';
import { EDITOR_FPS } from './fps';
import { frameWindowSeconds, toSceneLocalSeconds } from './timings';
import { DEFAULT_TRACK_IDS, type TimelineClip, type TimelineState } from './types';
import { normalizeClip, recomputeTimelineDuration, roundTime } from './math';
import { captionWordsFromTrack, findCaptionTrack, findAudioTrack, parseCaptionStyle } from './captions';

export type VideosTableRow = {
  id: string;
  user_id: string;
  script: string | null;
  voice: string | null;
  lang_code: string | null;
  timeline_json: EditVideoTimeline | null;
  timeline_version: number | null;
  raw_scenes: EditVideoScene[] | null;
  created_at: string;
  final_video_url: string | null;
  render_status: string | null;
  scene_timings: unknown;
  infographics_list: EditVideoInfographicListItem[] | null;
  text_list: EditVideoTextListItem[] | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonColumn<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function normalizeScript(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function scriptTextOf(raw: unknown): string {
  return normalizeScript(getScriptTextFromMap(parseScriptLanguageMap(raw)));
}

function scriptsMatch(a: unknown, b: unknown): boolean {
  const na = scriptTextOf(a);
  const nb = scriptTextOf(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length < nb.length ? na : nb;
  const long = na.length < nb.length ? nb : na;
  return short.length >= 80 && long.includes(short.slice(0, 80));
}

async function fetchAssignedScriptText(scriptRowId: string): Promise<string> {
  const { data, error } = await supabase
    .from('scripts_assigned')
    .select('script')
    .eq('id', scriptRowId)
    .maybeSingle();
  if (error) {
    console.error('[scripts_assigned script]', error.message);
    return '';
  }
  return scriptTextOf(data?.script);
}

export function resolveBeatAsset(beat: {
  selected_asset?: EditVideoBeatAsset | null;
  broll_override?: EditVideoBeatAsset | null;
}): EditVideoBeatAsset | null {
  const override = beat.broll_override;
  if (override?.file_url) return override;
  const selected = beat.selected_asset;
  if (selected?.file_url) return selected;
  return null;
}

export function videosRowToEditVideoResponse(row: VideosTableRow): EditVideoResponse {
  const scenes = Array.isArray(row.raw_scenes) ? row.raw_scenes : [];
  const timeline =
    row.timeline_json && typeof row.timeline_json === 'object'
      ? row.timeline_json
      : {
          fps: EDITOR_FPS,
          total_frames: 0,
          resolution: { width: 1080, height: 2320 },
          tracks: [],
        };
  return {
    video_id: row.id,
    timeline,
    scenes,
    text_list: Array.isArray(row.text_list) ? row.text_list : [],
    infographics_list: Array.isArray(row.infographics_list) ? row.infographics_list : [],
  };
}

function trackSceneId(track: EditVideoTimelineTrack): string {
  return typeof track.scene_id === 'string' ? track.scene_id : '';
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function clipsFromBrollTracks(
  sceneId: string,
  tracks: EditVideoTimelineTrack[],
  origin = 0,
): TimelineClip[] {
  return tracks
    .filter((t) => t.type === 'broll' && trackSceneId(t) === sceneId)
    .map((t, i) => {
      const asset = asRecord(t.selected_asset);
      const fileUrl = str(asset?.file_url);
      const source = str(asset?.source) === 'image' ? 'image' : 'video';
      const beatId = str(t.beat_id) || `s_b${i + 1}`;
      const frameWin = frameWindowSeconds(t);
      const absStart = frameWin?.start ?? num(t.beat_start_sec) ?? 0;
      const absEnd = frameWin?.end ?? num(t.beat_end_sec) ?? absStart + 1;
      const start = toSceneLocalSeconds(absStart, origin);
      const end = Math.max(start + 0.1, toSceneLocalSeconds(absEnd, origin));
      const dur = Math.max(0.1, roundTime(end - start));
      return normalizeClip({
        id: `br-${beatId}`,
        trackId: DEFAULT_TRACK_IDS.broll,
        type: 'broll',
        name: beatId,
        sourceUrl: fileUrl || undefined,
        mediaKind: source,
        start: roundTime(Math.max(0, start)),
        duration: dur,
        sourceStart: 0,
        sourceDuration: dur,
        originalSourceDuration: dur,
        sceneId,
        beatId,
      });
    })
    .filter((c) => Boolean(c.sourceUrl));
}

function applyOverlayTracks(
  state: TimelineState,
  scene: LegacySceneLike,
  tracks: EditVideoTimelineTrack[],
  infographicsList: EditVideoInfographicListItem[],
  textList: EditVideoTextListItem[],
  fps: number,
): TimelineState {
  let next = state;
  const sceneId = scene.id;
  const sceneInfographics = infographicsList.filter((item) => item.scene_id === sceneId);
  const sceneTexts = textList.filter((item) => item.scene_id === sceneId);

  for (const item of sceneInfographics) {
    const spec = parseRemotionInfographic(mergeOverlayTrackOntoItem(item, tracks, sceneId));
    if (!spec) continue;
    const rebased = rebaseOverlaySpec(spec, scene.start, scene.duration);
    const already = next.tracks
      .find((t) => t.id === DEFAULT_TRACK_IDS.infographic)
      ?.clips.some((c) => (rebased.overlayId && c.overlayId === rebased.overlayId) || c.remotion?.compositionId === rebased.compositionId);
    if (already) continue;
    const durSec = remotionDurationSeconds(rebased.durationFrames);
    if (durSec <= 0) continue;
    const overlayId = rebased.overlayId ?? (item.id != null ? String(item.id) : undefined);
    const isFull =
      rebased.placement === 'full_frame' ||
      rebased.placement === 'fullscreen' ||
      rebased.placement === 'full_screen';
    const start = rebased.startSeconds ?? overlayWindowSeconds(item)?.start ?? 0;
    next = addClipToTrack(next, DEFAULT_TRACK_IDS.infographic, {
      id: overlayId ? `info-${overlayId}` : `info-remotion-${sceneId}-${rebased.compositionId}`,
      type: 'infographic',
      name: remotionInfographicLabel(rebased),
      text: remotionInfographicLabel(rebased),
      start: Math.max(0, start),
      duration: durSec,
      sourceStart: 0,
      sourceDuration: durSec,
      originalSourceDuration: durSec,
      sceneId,
      overlayId,
      beatId: rebased.beatId ?? item.beat_id,
      placement: rebased.placement,
      mode: isFull ? 'fullscreen' : 'overlay',
      remotion: remotionPayloadFromSpec(rebased),
    });
  }

  for (const item of sceneTexts) {
    const seededRaw = seededTextFromOverlayItem(mergeOverlayTrackOntoItem(item, tracks, sceneId));
    const seeded = seededRaw ? rebaseSeededText(seededRaw, scene.start, scene.duration) : null;
    if (!seeded) continue;
    const already = next.tracks
      .find((t) => t.id === DEFAULT_TRACK_IDS.text)
      ?.clips.some((c) => (seeded.overlayId && c.overlayId === seeded.overlayId) || c.text === seeded.text);
    if (already) continue;
    next = addClipToTrack(next, DEFAULT_TRACK_IDS.text, {
      id: seeded.overlayId ? `txt-${seeded.overlayId}` : `txt-${sceneId}-${Date.now()}`,
      type: 'text',
      name: seeded.text.slice(0, 48) || 'Text',
      text: seeded.text,
      start: seeded.start,
      duration: seeded.duration,
      sourceStart: 0,
      sourceDuration: seeded.duration,
      sceneId,
      overlayId: seeded.overlayId,
      beatId: seeded.beatId,
      placement: seeded.placement,
      textColor: seeded.textColor,
      offsetX: seeded.offsetX,
      offsetY: seeded.offsetY,
      animationStyle: seeded.animationStyle,
      remotion: seeded.remotion ? remotionPayloadFromSpec(seeded.remotion) : undefined,
    });
  }

  for (const track of tracks) {
    if (trackSceneId(track) !== sceneId) continue;
    const kb = kenBurnsFromTrack(track);
    if (kb) {
      next = {
        ...next,
        tracks: next.tracks.map((t) =>
          t.id !== DEFAULT_TRACK_IDS.broll
            ? t
            : {
                ...t,
                clips: t.clips.map((c) =>
                  c.beatId === kb.beatId
                    ? {
                        ...c,
                        kenBurns: {
                          startX: kb.startX,
                          startY: kb.startY,
                          endX: kb.endX,
                          endY: kb.endY,
                          colorHint: kb.colorHint,
                        },
                      }
                    : c,
                ),
              },
        ),
      };
    }

    if (isOverlayGraphicTrack(track)) {
      const parsed = parseRemotionInfographic(track);
      if (parsed) {
        const graphic = rebaseOverlaySpec(parsed, scene.start, scene.duration);
        const alreadyGraphic = next.tracks
          .find((t) => t.id === DEFAULT_TRACK_IDS.infographic)
          ?.clips.find(
            (c) =>
              (graphic.overlayId && c.overlayId === graphic.overlayId) ||
              (graphic.beatId && c.beatId === graphic.beatId),
          );
        if (alreadyGraphic?.remotion) {
          const have = parseIconList(
            alreadyGraphic.remotion.props.icon_name ?? alreadyGraphic.remotion.props.icons,
          );
          const incoming = parseIconList(graphic.props.icon_name ?? graphic.props.icons);
          if (!have.length && incoming.length) {
            next = {
              ...next,
              tracks: next.tracks.map((t) =>
                t.id !== DEFAULT_TRACK_IDS.infographic
                  ? t
                  : {
                      ...t,
                      clips: t.clips.map((c) =>
                        c.id === alreadyGraphic.id && c.remotion
                          ? {
                              ...c,
                              remotion: {
                                ...c.remotion,
                                props: { ...c.remotion.props, ...graphic.props },
                              },
                            }
                          : c,
                      ),
                    },
              ),
            };
          }
        }
        if (!alreadyGraphic) {
          const durSec = remotionDurationSeconds(graphic.durationFrames);
          if (durSec > 0) {
            const overlayId = graphic.overlayId;
            const isFull =
              graphic.placement === 'full_frame' ||
              graphic.placement === 'fullscreen' ||
              graphic.placement === 'full_screen';
            next = addClipToTrack(next, DEFAULT_TRACK_IDS.infographic, {
              id: overlayId ? `info-${overlayId}` : `info-remotion-${sceneId}-${graphic.beatId || graphic.compositionId}`,
              type: 'infographic',
              name: remotionInfographicLabel(graphic),
              text: remotionInfographicLabel(graphic),
              start: Math.max(0, graphic.startSeconds ?? 0),
              duration: durSec,
              sourceStart: 0,
              sourceDuration: durSec,
              originalSourceDuration: durSec,
              sceneId,
              overlayId,
              beatId: graphic.beatId,
              placement: graphic.placement,
              mode: isFull ? 'fullscreen' : 'overlay',
              remotion: remotionPayloadFromSpec(graphic),
            });
          }
        }
      }
      continue;
    }

    const animationType = str(track.animation_type);
    const category = str(track.category);
    const isTextAnim =
      (track.type === 'animation' || track.type === 'overlay' || track.type === 'text') &&
      (category === 'overlay_text' || Boolean(str(track.display_text)));
    if (!isTextAnim) continue;

    const seededRaw = seededTextFromOverlayItem({
      ...track,
      display_text: track.display_text ?? track.text,
    });
    const seeded = seededRaw ? rebaseSeededText(seededRaw, scene.start, scene.duration) : null;
    if (!seeded) continue;
    const already = next.tracks
      .find((t) => t.id === DEFAULT_TRACK_IDS.text)
      ?.clips.some(
        (c) =>
          (seeded.overlayId && c.overlayId === seeded.overlayId) ||
          (seeded.beatId && c.beatId === seeded.beatId) ||
          c.text === seeded.text,
      );
    if (already) continue;
    next = addClipToTrack(next, DEFAULT_TRACK_IDS.text, {
      id: seeded.overlayId ? `txt-${seeded.overlayId}` : `txt-${sceneId}-${seeded.beatId || Date.now()}`,
      type: 'text',
      name: seeded.text.slice(0, 48) || 'Text',
      text: seeded.text,
      start: seeded.start,
      duration: seeded.duration,
      sourceStart: 0,
      sourceDuration: seeded.duration,
      sceneId,
      overlayId: seeded.overlayId,
      beatId: seeded.beatId,
      placement: seeded.placement || str(track.placement) || undefined,
      textColor: seeded.textColor || str(track.color_hint) || undefined,
      offsetX: seeded.offsetX || placementToPreviewOffsets(str(track.placement)).offsetX,
      offsetY: seeded.offsetY || placementToPreviewOffsets(str(track.placement)).offsetY,
      animationStyle: seeded.animationStyle || animationType,
      remotion: seeded.remotion ? remotionPayloadFromSpec(seeded.remotion) : undefined,
    });
  }

  const captionTrack = findCaptionTrack(tracks, sceneId);
  if (captionTrack) {
    const audioTrack = findAudioTrack(tracks, sceneId);
    const words = captionWordsFromTrack(captionTrack, fps, audioTrack, state.duration);
    const style = captionTrack.style ? parseCaptionStyle(captionTrack.style) : (scene.captionStyle ?? parseCaptionStyle(null));
    if (words.length || style) {
      next = {
        ...next,
        tracks: next.tracks.map((t) =>
          t.id !== DEFAULT_TRACK_IDS.voiceover
            ? t
            : {
                ...t,
                clips: t.clips.map((c) =>
                  c.type === 'voiceover'
                    ? {
                        ...c,
                        wordSegments: words.length ? words : c.wordSegments,
                        captionStyle: style ?? c.captionStyle,
                      }
                    : c,
                ),
              },
        ),
      };
    }
  }

  return { ...next, duration: recomputeTimelineDuration(next.tracks, next.duration) };
}

/** Rebuild per-scene editor timelines from scenes, then overlay persisted tracks from `timeline_json`. */
export function hydrateSceneTimelinesFromVideosRow(
  scenes: LegacySceneLike[],
  row: VideosTableRow,
): Record<string, TimelineState> {
  const maps = createSceneTimelinesMap(scenes);
  const tracks = row.timeline_json?.tracks ?? [];
  if (!tracks.length) return maps;

  const infographicsList = Array.isArray(row.infographics_list) ? row.infographics_list : [];
  const textList = Array.isArray(row.text_list) ? row.text_list : [];
  const fps = row.timeline_json?.fps || EDITOR_FPS;

  for (const scene of scenes) {
    const current = maps[scene.id];
    if (!current) continue;
    const brollClips = clipsFromBrollTracks(scene.id, tracks, scene.start);
    const withBroll: TimelineState = brollClips.length
      ? {
          ...current,
          tracks: current.tracks.map((t) =>
            t.id === DEFAULT_TRACK_IDS.broll ? { ...t, clips: brollClips } : t,
          ),
        }
      : current;
    maps[scene.id] = applyOverlayTracks(withBroll, scene, tracks, infographicsList, textList, fps);
  }
  return maps;
}

function coerceRow(raw: Record<string, unknown>): VideosTableRow | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const userId = typeof raw.user_id === 'string' ? raw.user_id : '';
  if (!id || !userId) return null;
  return {
    id,
    user_id: userId,
    script: typeof raw.script === 'string' ? raw.script : null,
    voice: typeof raw.voice === 'string' ? raw.voice : null,
    lang_code: typeof raw.lang_code === 'string' ? raw.lang_code : null,
    timeline_json: parseJsonColumn<EditVideoTimeline>(raw.timeline_json),
    timeline_version: num(raw.timeline_version),
    raw_scenes: parseJsonColumn<EditVideoScene[]>(raw.raw_scenes),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
    final_video_url: typeof raw.final_video_url === 'string' ? raw.final_video_url : null,
    render_status: typeof raw.render_status === 'string' ? raw.render_status : null,
    scene_timings: raw.scene_timings ?? null,
    infographics_list: parseJsonColumn<EditVideoInfographicListItem[]>(raw.infographics_list),
    text_list: parseJsonColumn<EditVideoTextListItem[]>(raw.text_list),
  };
}

/**
 * Load the saved /edit-video project for this user + script from the `videos` table.
 * A row is returned only when `videos.script` matches `scripts_assigned.script`
 * (or the in-memory script text if no assigned row id is available).
 */
export async function fetchVideosProject(
  userId: string,
  opts?: {
    script?: string | null;
    scriptRowId?: string | number | null;
  },
): Promise<VideosTableRow | null> {
  const assignedId =
    opts?.scriptRowId != null && String(opts.scriptRowId).trim()
      ? String(opts.scriptRowId).trim()
      : '';
  const assignedScript = assignedId ? await fetchAssignedScriptText(assignedId) : '';
  const wanted = assignedScript || scriptTextOf(opts?.script);
  if (!wanted) return null;

  const { data, error } = await supabase
    .from('videos')
    .select(
      'id, user_id, script, voice, lang_code, timeline_json, timeline_version, raw_scenes, created_at, final_video_url, render_status, scene_timings, infographics_list, text_list',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[videos table]', error.message);
    return null;
  }
  const rows = (data ?? [])
    .map((row) => coerceRow(row as Record<string, unknown>))
    .filter((row): row is VideosTableRow => Boolean(row?.raw_scenes?.length));
  if (!rows.length) return null;

  return rows.find((row) => scriptsMatch(row.script, wanted)) ?? null;
}
