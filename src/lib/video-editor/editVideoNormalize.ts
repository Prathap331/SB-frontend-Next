import { EDITOR_FPS } from '@/lib/video-editor/fps';
import { isStorybitAnimationType, resolveAnimationType } from '@/remotion/animationTypes';
import type {
  BrollVideo,
  EditVideoBeat,
  EditVideoBeatAsset,
  EditVideoImage,
  EditVideoInfographicListItem,
  EditVideoResponse,
  EditVideoScene,
  EditVideoTimeline,
  EditVideoWordSegment,
} from '@/services/api';

/** Display name from each Storybit SPEC → exact `animation_type`. */
const TEMPLATE_NAME_TO_TYPE: Record<string, string> = {
  'Document Highlight': 'dc_document_highlight',
  'Investigation Board': 'dc_investigation_board',
  'Case File': 'dc_case_file',
  'Archive Photo': 'dc_archive_photo',
  'Sticky Notes Board': 'dc_sticky_notes',
  'Linear Process': 'dg_linear_process',
  'A → B Relationship': 'dg_relationship',
  'Decision Tree': 'dg_decision_tree',
  Funnel: 'dg_funnel',
  'Hierarchy / Tree': 'dg_hierarchy',
  'Architecture Diagram': 'dg_architecture',
  'Pros & Cons': 'dg_pros_cons',
  'VS Face-Off': 'dg_vs_faceoff',
  'Myth vs Fact': 'dg_myth_fact',
  'Bar Chart': 'dv_bar_chart',
  'Line Chart': 'dv_line_chart',
  'Pie / Donut Chart': 'dv_pie_donut',
  'Gauge / Meter': 'dv_gauge',
  Leaderboard: 'dv_leaderboard',
  'Icon Array': 'dv_icon_array',
  'Scribble Annotation': 'em_scribble',
  'Title Card': 'fs_title_card',
  'Title + Metadata': 'fs_title_metadata',
  'Big Number': 'fs_big_number',
  'Number Comparison': 'fs_number_comparison',
  'Quote Card': 'fs_quote_card',
  'Key Statement': 'fs_key_statement',
  'Structured List': 'fs_structured_list',
  'Comparison Columns': 'fs_comparison_columns',
  'Media + Floating Card': 'hc_floating_card',
  'Punch Word': 'kt_punch_word',
  'Stacked Kinetic Text': 'kt_stacked_text',
  'Question Hook': 'kt_question_hook',
  'Word-Synced Captions': 'kt_captions',
  'Globe Zoom to Location': 'mp_globe_zoom',
  'Radius / Range': 'mp_radius_range',
  'Travel Route Map': 'mp_travel_route',
  'Chapter Card': 'nv_chapter_card',
  'Countdown Rank Reveal': 'nv_rank_reveal',
  'Subscribe Reminder': 'nv_subscribe',
  'End Screen': 'nv_end_screen',
  'Person Intro Card': 'pe_person_intro',
  'Profile Card': 'pe_profile_card',
  Timeline: 'tl_timeline',
  'Roadmap / Gantt': 'tl_roadmap',
  'Social Post': 'ui_social_post',
  'Chat Conversation': 'ui_chat',
  'News Headline Card': 'ui_news_headline',
  'Newspaper Clipping': 'ui_newspaper_clipping',
  'Search Bar Typing': 'ui_search_bar',
  'Notification Pop': 'ui_notification',
  'Image + Label / Caption': 'vo_image_caption',
  'Image Grid': 'vo_image_grid',
  'Image Montage': 'vo_image_montage',
  'Before / After': 'vo_before_after',
  'Location Tag': 'vo_location_tag',
  'Lower Third': 'vo_lower_third',
  'Statistic Overlay': 'vo_stat_overlay',
  'Callout / Annotation': 'vo_callout',
  'Source Citation': 'vo_source_citation',
};

const EMPTY_TIMELINE: EditVideoTimeline = {
  fps: EDITOR_FPS,
  total_frames: 0,
  resolution: { width: 1920, height: 1080 },
  tracks: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sceneIdOf(raw: Record<string, unknown>, index: number): string {
  if (typeof raw.scene_id === 'string' && raw.scene_id.trim()) return raw.scene_id.trim();
  if (typeof raw.id === 'string' && raw.id.trim()) return raw.id.trim();
  if (typeof raw.id === 'number' && Number.isFinite(raw.id)) return String(raw.id);
  return `scene-${index + 1}`;
}

export function isDirectionScene(value: unknown): boolean {
  const rec = asRecord(value);
  return Boolean(rec && Array.isArray(rec.directions));
}

export function isLegacyTimeline(value: unknown): value is EditVideoTimeline {
  const rec = asRecord(value);
  return Boolean(rec && Array.isArray(rec.tracks));
}

export function animationTypeFromTemplateName(name: string | undefined | null): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  const exact = TEMPLATE_NAME_TO_TYPE[trimmed];
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  for (const [label, type] of Object.entries(TEMPLATE_NAME_TO_TYPE)) {
    if (label.toLowerCase() === lower) return type;
  }
  const resolved = resolveAnimationType(trimmed.replace(/→/g, 'to').replace(/\+/g, ' '));
  if (isStorybitAnimationType(resolved)) return resolved;
  const slug = resolved.replace(/_+/g, '_').replace(/^_|_$/g, '');
  for (const type of Object.values(TEMPLATE_NAME_TO_TYPE)) {
    const suffix = type.includes('_') ? type.slice(type.indexOf('_') + 1) : type;
    if (suffix === slug || type === slug) return type;
  }
  return resolved;
}

function wordSegmentsOf(raw: Record<string, unknown>): EditVideoWordSegment[] {
  const list = raw.word_timestamps ?? raw.word_segments;
  if (!Array.isArray(list)) return [];
  const words: EditVideoWordSegment[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const word = asString(rec.word);
    if (!word) continue;
    const start = asFiniteNumber(rec.start);
    const end = asFiniteNumber(rec.end);
    words.push({
      word,
      ...(start != null ? { start } : {}),
      ...(end != null ? { end } : {}),
    });
  }
  return words;
}

function directionList(raw: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(raw.directions)
    ? raw.directions.filter((d): d is Record<string, unknown> => Boolean(asRecord(d))).map((d) => asRecord(d)!)
    : [];
}

function photoToImage(raw: Record<string, unknown>): EditVideoImage | null {
  const id = asFiniteNumber(raw.id);
  const imageUrl =
    asString(raw.image_url) ||
    asString(raw.url) ||
    asString(asRecord(raw.src)?.original) ||
    asString(asRecord(raw.src)?.large);
  if (id == null || !imageUrl) return null;
  const photographerRaw = raw.photographer;
  const photographerName =
    typeof photographerRaw === 'string'
      ? photographerRaw
      : asString(asRecord(photographerRaw)?.name);
  return {
    type: asString(raw.type) || 'photo',
    id,
    url: asString(raw.url) || imageUrl,
    width: asFiniteNumber(raw.width) ?? 0,
    height: asFiniteNumber(raw.height) ?? 0,
    photographer: photographerName ? { name: photographerName, url: asString(asRecord(photographerRaw)?.url) } : undefined,
    alt: asString(raw.alt) || asString(raw.query) || null,
    src: {
      original: imageUrl,
      large2x: imageUrl,
      large: imageUrl,
      medium: imageUrl,
      small: imageUrl,
      portrait: imageUrl,
      landscape: imageUrl,
      tiny: imageUrl,
    },
  };
}

function videoToBroll(raw: Record<string, unknown>): BrollVideo | null {
  const id = asFiniteNumber(raw.id);
  const fileUrl = asString(raw.video_url) || asString(raw.file_url) || asString(raw.url);
  if (id == null || !fileUrl) return null;
  const width = asFiniteNumber(raw.width) ?? 0;
  const height = asFiniteNumber(raw.height) ?? 0;
  return {
    id,
    url: asString(raw.url) || fileUrl,
    width,
    height,
    duration: asFiniteNumber(raw.duration) ?? 0,
    thumbnail: asString(raw.thumbnail) || asString(raw.image) || '',
    user: { name: asString(raw.query), url: '' },
    video_files: [
      {
        quality: null,
        width,
        height,
        file_type: 'video/mp4',
        link: fileUrl,
      },
    ],
  };
}

function assetsFromAsserts(raw: Record<string, unknown>): {
  photos: EditVideoImage[];
  videos: BrollVideo[];
} {
  const asserts = asRecord(raw.asserts) ?? asRecord(raw.assets) ?? {};
  const photos = Array.isArray(asserts.photos)
    ? asserts.photos.map((p) => asRecord(p)).filter(Boolean).map((p) => photoToImage(p!)).filter((p): p is EditVideoImage => Boolean(p))
    : [];
  const videos = Array.isArray(asserts.videos)
    ? asserts.videos.map((v) => asRecord(v)).filter(Boolean).map((v) => videoToBroll(v!)).filter((v): v is BrollVideo => Boolean(v))
    : [];
  return { photos, videos };
}

function pickBeatAsset(photos: EditVideoImage[], videos: BrollVideo[]): EditVideoBeatAsset | null {
  const video = videos[0];
  if (video?.video_files[0]?.link) {
    return {
      asset_id: video.id,
      file_url: video.video_files[0].link,
      source: 'video',
      width: video.width,
      height: video.height,
    };
  }
  const photo = photos[0];
  const fileUrl = photo?.src.large2x || photo?.src.original || photo?.url;
  if (photo && fileUrl) {
    return {
      asset_id: photo.id,
      file_url: fileUrl,
      source: 'image',
      width: photo.width,
      height: photo.height,
    };
  }
  return null;
}

function convertDirectionScene(raw: Record<string, unknown>, index: number): {
  scene: EditVideoScene;
  infographics: EditVideoInfographicListItem[];
} {
  const sceneId = sceneIdOf(raw, index);
  const words = wordSegmentsOf(raw);
  const directions = directionList(raw);
  const ends = [
    ...words.map((w) => w.end).filter((n): n is number => n != null),
    ...directions.map((d) => asFiniteNumber(d.end)).filter((n): n is number => n != null),
  ];
  const end = ends.length ? Math.max(...ends) : 0;
  const duration = Math.max(0.5, end);

  const beats: EditVideoBeat[] = [];
  const infographics: EditVideoInfographicListItem[] = [];

  directions.forEach((dir, di) => {
    const beatId = asString(dir.beat_id) || `${sceneId}-d${di + 1}`;
    const dirStart = asFiniteNumber(dir.start) ?? 0;
    const dirEnd = Math.max(dirStart + 0.1, asFiniteNumber(dir.end) ?? dirStart + 1);
    const kind = asString(dir.type).toLowerCase();
    const { photos, videos } = assetsFromAsserts(dir);
    const asset = pickBeatAsset(photos, videos);
    const wantsBroll = kind.includes('b-roll') || kind.includes('broll') || Boolean(asset);
    if (wantsBroll && asset) {
      beats.push({
        beat_id: beatId,
        start: dirStart,
        end: dirEnd,
        keywords: Array.isArray(dir.keywords) ? dir.keywords.filter((k): k is string => typeof k === 'string') : [],
        preferred_media_type: asset.source,
        selected_asset: asset,
        media: {
          keywords: Array.isArray(dir.keywords) ? dir.keywords.filter((k): k is string => typeof k === 'string') : [],
          videos: { total_results: videos.length, results: videos },
          images: { total_results: photos.length, results: photos },
        },
      });
    }

    const animationType = animationTypeFromTemplateName(asString(dir.template_name) || asString(dir.animation_type));
    const wantsOverlay =
      Boolean(animationType) &&
      (kind.includes('overlay') || kind.includes('full_screen') || kind.includes('fullscreen') || Boolean(asString(dir.template_name)));
    if (!wantsOverlay || !animationType) return;

    const durationFrames = Math.max(1, Math.round((dirEnd - dirStart) * EDITOR_FPS));
    const props = asRecord(dir.template_props) ?? {};
    const fullscreen = kind.includes('full_screen') || kind.includes('fullscreen');
    infographics.push({
      id: `${sceneId}-overlay-${di + 1}`,
      scene_id: sceneId,
      beat_id: beatId,
      composition_id: animationType,
      animation_type: animationType,
      category: fullscreen ? 'full_frame' : 'overlay',
      props,
      duration_frames: durationFrames,
      trigger: 'beat',
      placement: fullscreen ? 'full_frame' : 'overlay',
      start: dirStart,
      end: dirEnd,
      start_sec: dirStart,
      end_sec: dirEnd,
      render_engine_hint: 'remotion',
    });
  });

  const audioUrl = asString(raw.audio_url) || asString(raw.voice_url) || asString(raw.file_url);
  const script = asString(raw.script) || asString(raw.vo_text);
  const scene: EditVideoScene = {
    scene_id: sceneId,
    vo_text: script,
    voice_url: audioUrl || undefined,
    file_url: audioUrl || undefined,
    duration_seconds: duration,
    start: 0,
    end: duration,
    word_segments: words,
    beats,
    infographics: infographics[0] ?? null,
    error: audioUrl ? null : 'Missing voiceover audio',
  };
  return { scene, infographics };
}

function extractDirectionScenes(raw: Record<string, unknown>): Record<string, unknown>[] | null {
  const timeline = asRecord(raw.timeline);
  const fromTimeline = Array.isArray(timeline?.scenes) ? timeline!.scenes : null;
  const fromTop = Array.isArray(raw.scenes) ? raw.scenes : null;
  const list = fromTimeline ?? fromTop;
  if (!list?.length) return null;
  const first = list.find((item) => asRecord(item));
  if (!isDirectionScene(first)) return null;
  return list.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item));
}

function legacyTimelineOf(raw: Record<string, unknown>, totalSeconds: number): EditVideoTimeline {
  const timeline = raw.timeline;
  if (isLegacyTimeline(timeline)) return timeline;
  return {
    ...EMPTY_TIMELINE,
    total_frames: Math.max(1, Math.round(totalSeconds * EDITOR_FPS)),
  };
}

/**
 * Accepts the current /edit-video + `videos.timeline` shape (`scenes[].directions`)
 * and the previous `{ scenes, timeline.tracks, infographics_list }` shape.
 */
export function normalizeEditVideoPayload(raw: unknown): EditVideoResponse {
  const rec = asRecord(raw) ?? {};
  const videoId = asString(rec.video_id) || asString(rec.id);
  const directionScenes = extractDirectionScenes(rec);
  if (!directionScenes) {
    const scenes = Array.isArray(rec.scenes) ? (rec.scenes as EditVideoScene[]) : [];
    const total = scenes.reduce((sum, s) => {
      const d = typeof s.duration_seconds === 'number' ? s.duration_seconds : Math.max(0, Number(s.end) - Number(s.start) || 0);
      return sum + (Number.isFinite(d) ? d : 0);
    }, 0);
    return {
      video_id: videoId,
      timeline: legacyTimelineOf(rec, total),
      scenes,
      failed_scene_ids: Array.isArray(rec.failed_scene_ids) ? (rec.failed_scene_ids as string[]) : undefined,
      text_list: Array.isArray(rec.text_list) ? rec.text_list : [],
      infographics_list: Array.isArray(rec.infographics_list) ? rec.infographics_list : [],
      timeline_version: asFiniteNumber(rec.timeline_version) ?? undefined,
    };
  }

  const converted = directionScenes.map((scene, i) => convertDirectionScene(scene, i));
  const scenes = converted.map((c) => c.scene);
  const infographics_list = converted.flatMap((c) => c.infographics);
  const total = scenes.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  return {
    video_id: videoId,
    timeline: legacyTimelineOf(rec, total),
    scenes,
    failed_scene_ids: scenes.filter((s) => s.error).map((s) => s.scene_id),
    text_list: Array.isArray(rec.text_list) ? rec.text_list : [],
    infographics_list,
    timeline_version: asFiniteNumber(rec.timeline_version) ?? undefined,
  };
}
