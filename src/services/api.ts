// API service for StoryBit AI backend integration
import { supabase } from '@/lib/supabaseClient';

export interface ProcessTopicRequest {
  topic: string;
  userId?: string;
}

// ── B-Roll (Pexels proxy) ─────────────────────────────────────────────────────

export type BrollOrientation = 'landscape' | 'portrait' | 'square';
/** Pexels size: large = 4K, medium = Full HD (1080p), small = HD */
export type BrollSize = 'large' | 'medium' | 'small';

export interface BrollSearchPayload {
  query: string;
  per_page?: number;
  page?: number;
  orientation?: BrollOrientation | '';
  size?: BrollSize | '';
  userId?: string;
}

export interface BrollVideoFile {
  quality: string | null;
  width: number;
  height: number;
  file_type: string;
  link: string;
}

export interface BrollVideo {
  id: number;
  url: string;
  width: number;
  height: number;
  duration: number;
  thumbnail: string;
  user: { name: string; url: string };
  video_files: BrollVideoFile[];
}

export interface BrollSearchResponse {
  query: string;
  page: number;
  per_page: number;
  total_results: number;
  videos: BrollVideo[];
}

// ── Pipeline Metrics ──────────────────────────────────────────────────────────

export interface PlatformWeight {
  platform: string;
  percentage: string;
}

export interface PlatformSignal {
  platform: string;
  score: number;
  barW: number;
  tag: string;
  note: string;
}

export interface ConfidenceSource {
  name: string;
  detail: string;
}

export interface CsiDimension {
  name: string;
  score: number;
  effect: string;
  status: string;
}

export interface TopAngle {
  rank: number;
  title: string;
  who: string;
  what: string;
  when: string;
  frame: string;
  coverage: string;
}

export interface GapOpportunity {
  rank: number;
  score: number;
  title: string;
  angle: string;
  demand_score: number;
}

export interface PipelineMetricsResponse {
  topic: string;
  timestamp: string;
  trend_strength_score: {
    score: number;
    max: number;
    status: string;
    verdict: string;
    description: string;
    phase: string;
    composition: { base: number; psych_boost: number; reliability: number };
    why_trending: {
      primary_driver: string;
      headline: string;
      summary: string;
      platform_weights: PlatformWeight[];
    };
    platform_signals: PlatformSignal[];
    confidence: { reliability_score: number; sources: ConfidenceSource[] };
  };
  content_saturation_index: {
    score: number;
    status: string;
    verdict: string;
    description: string;
    dimensions: CsiDimension[];
    breakout: { score: number; out_of: number; label: string; signals: string[] };
    incumbent_health: {
      engagement_gap: number;
      creator_density: number;
      vpd_decay: number;
      verdict: string;
    };
  };
  content_angle_gap_score: {
    total_angles: number;
    distribution: { label: string; count: number }[];
    top_angles: TopAngle[];
    gap_opportunities: GapOpportunity[];
  };
  final_verdict: { action: string; summary: string };
}

export interface SimilarPastIdeaItem {
  title: string;
  description: string;
}

export interface SimilarPastIdea {
  id: number;
  topic: string;
  ideas: SimilarPastIdeaItem[];
  similarity: number;
}

export interface BookReference {
  title: string;
  author: string;
}

export interface ProcessTopicResponse {
  ideas: string[];
  descriptions: string[];
  topic_summary?: string | null;
  similar_past_ideas?: SimilarPastIdea[];
  sources?: string[];
  books?: BookReference[];
}

export interface UnusedIdea {
  title: string;
  description: string;
}

/** /save-ideas expects sources as objects, not bare URL strings */
export interface IdeaSourceReference {
  url: string;
}

export interface UnusedIdeasPayload {
  topic: string;
  /** Required by /save-ideas — use "" when no summary is available */
  topic_summary: string;
  sources: IdeaSourceReference[];
  books: BookReference[];
  ideas: UnusedIdea[];
  userId: string;
}

/** Normalize generate-ideas string URLs (or mixed) into /save-ideas dicts */
export function normalizeSourcesForSave(
  sources: unknown,
): IdeaSourceReference[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((item): IdeaSourceReference | null => {
      if (typeof item === 'string') {
        const url = item.trim();
        return url ? { url } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const url = String(obj.url ?? obj.link ?? obj.href ?? '').trim();
        return url ? { url } : null;
      }
      return null;
    })
    .filter((s): s is IdeaSourceReference => !!s);
}

export interface SignUpRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  youtube_link?: string;
  instagram_link?: string;
  facebook_link?: string;
  twitter_link?: string;
  billing_address?: string;
  primary_language?: string;
  categories?: string[];
}

export interface SignUpResponse {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: {
    provider: string;
    providers: string[];
  };
  user_metadata: {
    full_name: string;
  };
  identities: {
    identity_id: string;
    id: string;
    user_id: string;
    identity_data: {
      email: string;
      email_verified: boolean;
      phone_verified: boolean;
      sub: string;
    };
    provider: string;
    last_sign_in_at: string;
    created_at: string;
    updated_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface GenerationParams {
  userId: string;
  title: string;
  description: string;
  /** Search / idea topic the script belongs to */
  topic: string;
  /** Video length in minutes */
  time: number;
}

/** Payload for POST /generate-thumbnail */
export interface GenerateThumbnailPayload {
  userId: string;
  title: string;
  description: string;
  isFace: boolean;
  script: string;
  /** Thumbnail overlay text for this generation (single option) */
  thumbnail_text: string;
}

export interface GenerateThumbnailResult {
  /** Single object or array — stored as-is into thumbnail-generated jsonb */
  thumbnail: {
    prompt: string | null;
    public_url: string | null;
    error: string | null;
  } | Array<{
    prompt: string | null;
    public_url: string | null;
    error: string | null;
  }>;
  token_usage?: {
    calls?: Array<{
      label: string;
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    }>;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_tokens?: number;
  };
  remaining_credits?: number;
  message?: string;
}

/** SEO block returned by /generate-script as `youtube_metadata` */
export interface YoutubeMetadata {
  titles?: string[];
  descriptions?: string[];
  /** Each entry is one set of hashtags (matching a title/description option) */
  hashtags?: string[][];
  thumbnail_text?: string[];
}

export type GeneratedScriptData = {
  script: string;
  /** True when payload is a locked preview (full body withheld until unlock) */
  locked?: boolean;
  /** scripts_universal id while locked */
  scriptRowId?: string | null;
  /** Multilingual versions keyed by language (english, telugu, …) */
  scriptsByLanguage?: Record<string, string>;
  estimated_word_count?: number;
  /** Legacy field — new responses return `sources` instead */
  source_urls?: string[];
  analysis?: {
    examples_count: number;
    research_facts_count: number;
    proverbs_count: number;
    history: number;
  };
  title?: string;
  metrics?: {
    totalWords?: number;
    videoLength?: number;
    generalExamples?: number;
    proverbs_count?: number;
    historical_facts?: number;
    historicalExamples?: number;
    history?: number;
    researchFacts?: number;
    lawsIncluded?: number;
    keywords?: string[];
  };
  /** New SEO section from /generate-script */
  youtube_metadata?: YoutubeMetadata;
  /** New: research source domains */
  sources?: string[];
  /** New: books referenced during research */
  books?: BookReference[];
  /** Thumbnail payload from /generate-script (text overlays or image data) */
  thumbnail?: unknown;
  /**
   * Generated speech URLs from scripts_assigned.script_audio (jsonb string[]).
   * Example: ["https://.../generated-audio/.../file.mp3"]
   */
  script_audio?: string[];
  /**
   * AI image from /generate-thumbnail, persisted on scripts_assigned
   * as jsonb column `thumbnail-generated` (object or array).
   */
  thumbnail_generated?: {
    prompt: string | null;
    public_url: string | null;
    error: string | null;
  } | Array<{
    prompt: string | null;
    public_url: string | null;
    error: string | null;
  }> | null;
  structure?: Array<{
      name: string;
      percentage: number;
  }>;
  synopsis?: string;
  seo?: {
    /** New-format SEO data persisted to Supabase under the seo column */
    youtube_metadata?: YoutubeMetadata;
    books?: BookReference[];
    /** Backend sometimes double-nests the rich SEO data under seo.seo */
    seo?: {
      recommended_titles?: Array<{
        type: string;
        title: string;
        desc: string;
        selected?: boolean;
      }>;
      keyword_clusters?: {
        primary: string[];
        secondary: string[];
        longtail: string[];
        question_based: string[];
      };
      description_template?: {
        hook: string;
        body_bullets: string[];
        outro: string;
      };
      thumbnail_brief?: Array<{
        type: string;
        style: string;
        headline: string;
        text_overlay: string;
        face_recommended: boolean;
        description: string;
        preview_image_url?: string;
      }>;
      hashtags?: string[];
    };
    recommended_titles?: Array<{
      type: string;
      title: string;
      desc: string;
      selected?: boolean;
    }>;
    hashtags?: Array<{ hashtag: string; strategy: string }>;
    chapter_structure?: Array<{
      index: number;
      title: string;
      covers: string;
      section_pct: number;
    }>;
    key_questions_to_answer?: string[];
    angle?: string;
    ctr_potential?: string;
    ctr_score?: number;
    search_intent_type?: string;
  };
  category?: string;
  subcategories?: string[];
};

// ── TSS response from /pipeline-metrics ──────────────────────────────────────
export interface TSSResponse {
  topic: string;

  trends: {
    score: number;
    band: string;
    status: string;
    updated_at: string
    searches_per_week: string;
    vs_avg_week: string;
    vs_normal_week: string;
    week_on_week: string;
    trend_direction: string;
  };

  youtube: {
    score: number;
    band: string;
    status: string;
    updated_at: string;

    low_volume: boolean;

    views_this_week: number;
    views_last_week: number;

    view_growth: string;   // ✅ "4.0×"
    wow_ratio: number;

    new_videos_7d: number;
    videos_tracked: number;

    distinct_channels: number;
    creator_competition: string;

    likes_total: number;
    comments_total: number;

    engagement_rate: string; // ✅ "1.8%"

    all_new_videos: boolean;
  };

  social: {
    score: number;
    band: string;
    status: string;
    updated_at: string;
    source: string;

    posts_48h: number;
    daily_avg: number;

    communities: number;
    avg_comments: number;

    sentiment: string;
    upvote_pct: number;
  };

  news_result: {
    score: number;
    band: string;
    status: string;
    updated_at: string;
    source: string;

    low_volume: boolean;

    articles_7d: number;
    avg_weekly_baseline: number | null;

    publishers: number;

    vs_normal_week: string;

    coverage_tone: string;
    tone_shift: number;

    gdelt_available: boolean;
  };
}

// ── ECI response from /eci ────────────────────────────────────────────────────
export interface ECIResponse {
  google_data?: {
    demand_score?: number;
    trend_direction?: string;
    volatility?: number;
    seasonality?: boolean;
    breakout_signal?: boolean;

    // ✅ ADD THESE (missing in your type)
    index_now?: number;
    avg_index_24m?: number;
    stability?: number;
    lifecycle?: string;
    best_month?: string;

    search_intent?: {
      learning_pct?: number;
      buying_pct?: number;
      research_pct?: number;
    };

    top_geographies?: string[];
  };

  youtube_data?: {
    avg_views?: number;
    engagement_rate?: number;
    competition_score?: number;
    upload_frequency?: number;
    authority_score?: number;
    youtube_score?: number;

    version_sensitivity?: number;
    version_sensitivity_label?: string;
    old_to_new_ratio?: number;
    foundational_stability?: boolean;
    incumbent_decay_pct?: number;

    revenue_potential?: {
      revenue_score?: number;
      est_rpm?: number;
      rpm_low?: number;
      rpm_high?: number;
      rpm_range?: string;
      like_rate_pct?: number;
      engagement_adj?: string;
      eng_multiplier?: number;
      ad_revenue_mo?: number;
      brand_deal_est_mo?: number;
      total_est_mo?: number;
      views_basis?: string;
      rpm_source?: string;
    };

    // ✅ ADD THIS
    content_longevity?: {
      longevity_score?: number;
      shelf_life_label?: string;
      version_sensitivity?: number;
      version_sensitivity_label?: string;
      old_to_new_ratio?: number;
      foundational_stability?: boolean;
      incumbent_decay_pct?: number;
    };

    // ✅ ADD THIS (ERROR 1)
    audience_depth?: {
      score?: number;
      like_rate_pct?: number;
      comment_rate_pct?: number;
      avg_length_min?: number;
      oldest_top_months?: number;
      question_pct?: number;
      complaint_pct?: number;
      engagement_score?: number;
      videos_analyzed?: number;
    };

    // ✅ ADD THIS (ERROR 2)
    competition_density?: {
      score?: number;
      label?: string;
      avg_channel_subs?: number;
      view_gini?: number;
      small_creator_share?: number;
      total_videos_est?: number;
      channels_analyzed?: number;
    };

    // ✅ ADD THIS (ERROR 3)
    audience_profile?: {
      score?: number;
      primary_audience?: string;
      dominant_emotion?: string;
      experience_level?: string;
      purchase_intent?: string;
      shareability?: number;
      data_sources?: string;
    };
  };
}

// ── Trending topics (/trending-data) ─────────────────────────────────────────

// v2 key: the response structure changed (category-based), invalidate old caches
const TOPICS_CACHE_KEY = "trending_topics_cache_v2";
const CACHE_DURATION = 1000 * 60 * 10;
const TOPICS_PER_TAB = 20;

export interface TrendingTopic {
  id: number;
  created_at: string;
  tittle: string;
  category: 'national' | 'international' | string;
  regular_tittle: string;
}

import { getBackendUrl } from '@/lib/backend';

export class ApiService {
  // Backend base URL from NEXT_PUBLIC_API_URL
  private static get BASE_URL() {
    return getBackendUrl();
  }

  private static sanitizeTopic(input: string): string {
    return input
      .replace(/'/g, '')        // remove apostrophes
      .replace(/[^\w\s]/g, '')  // remove special chars
      .trim();
  }

  /**
   * Sign out and redirect to /auth.
   * Uses supabase.auth.signOut() so the refresh token is also invalidated server-side.
   */
  private static async handleUnauthorized(): Promise<void> {
    if (typeof window !== 'undefined') {
      await supabase.auth.signOut();
      window.location.href = '/auth';
    }
  }

  /**
   * Returns a valid access token, refreshing the session automatically if needed.
   * Supabase's getSession() will use the stored refresh token to obtain a new
   * access token whenever the current one has expired — so we never send a stale JWT.
   */
  private static async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[getAuthToken] getSession error:', error.message);
        return null;
      }
      return session?.access_token ?? null;
    } catch (err) {
      console.warn('[getAuthToken] unexpected error:', err);
      return null;
    }
  }

  /**
   * A thin fetch wrapper that:
   *  1. Attaches the current (possibly just-refreshed) Bearer token.
   *  2. On a 401, tries supabase.auth.refreshSession() once and retries.
   *  3. If the retry also fails with 401, signs the user out and redirects.
   */
  private static async authorizedFetch(
    url: string,
    init: Omit<RequestInit, 'headers'>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const buildHeaders = (
      token: string | null,
      body: BodyInit | null | undefined,
    ): Record<string, string> => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      // Browser must set multipart boundary for FormData — do not force JSON.
      if (!(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }
      return headers;
    };

    const token = await this.getAuthToken();
    const response = await fetch(url, {
      ...init,
      headers: buildHeaders(token, init.body),
      signal,
      mode: 'cors',
    });

    // If unauthorized, attempt a token refresh and retry exactly once
    if (response.status === 401) {
      console.warn('[authorizedFetch] 401 received — attempting token refresh');
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        console.info('[authorizedFetch] Token refreshed, retrying request');
        return fetch(url, {
          ...init,
          headers: buildHeaders(data.session.access_token, init.body),
          signal,
          mode: 'cors',
        });
      }
      // Refresh failed — session is truly expired
      console.error('[authorizedFetch] Refresh failed, signing out');
      await this.handleUnauthorized();
      throw new Error('Session expired. Please sign in again.');
    }

    return response;
  }

  /**
   * Normalizes the /generate-ideas backend response into the shape the UI expects
   * ({ ideas: string[], descriptions: string[], summary? }).
   *
   * Supports the latest backend structure where `ideas` is an array of
   * `{ title, description }` objects, while remaining backward compatible with
   * the legacy structure (`ideas: string[]` + `descriptions: string[]`).
   */
  private static normalizeProcessTopicResponse(data: any): ProcessTopicResponse {
    const rawIdeas = Array.isArray(data?.ideas) ? data.ideas : [];

    // Latest structure: ideas = [{ title, description }, ...]
    const isObjectIdeas =
      rawIdeas.length > 0 &&
      typeof rawIdeas[0] === 'object' &&
      rawIdeas[0] !== null;

    if (isObjectIdeas) {
      const ideas = rawIdeas.map(
        (idea: any) => idea?.title ?? idea?.idea ?? '',
      );
      const descriptions = rawIdeas.map(
        (idea: any) => idea?.description ?? '',
      );
      return {
        ideas,
        descriptions,
        topic_summary: data?.topic_summary ?? null,
        similar_past_ideas: Array.isArray(data?.similar_past_ideas)
          ? data.similar_past_ideas
          : [],
        sources: Array.isArray(data?.sources) ? data.sources : [],
        books: Array.isArray(data?.books) ? data.books : [],
      };
    }

    // Legacy structure: ideas = string[], descriptions = string[]
    return {
      ideas: rawIdeas,
      descriptions: Array.isArray(data?.descriptions) ? data.descriptions : [],
      topic_summary: data?.topic_summary ?? null,
      similar_past_ideas: Array.isArray(data?.similar_past_ideas)
        ? data.similar_past_ideas
        : [],
      sources: Array.isArray(data?.sources) ? data.sources : [],
      books: Array.isArray(data?.books) ? data.books : [],
    };
  }

  static async processTopic(
    topic: string,
    userId?: string | null,
    retryCount = 0,
  ): Promise<ProcessTopicResponse> {
    const maxRetries = 2;

    try {
      const apiUrl = `${this.BASE_URL}/generate-ideas`;
      const safeTopic = this.sanitizeTopic(topic);

      // Resolve userId from the active session when the caller did not pass one
      let resolvedUserId = userId?.trim() || null;
      if (!resolvedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        resolvedUserId = session?.user?.id ?? null;
      }

      const payload: { topic: string; userId?: string } = { topic: safeTopic };
      if (resolvedUserId) payload.userId = resolvedUserId;

      // No timeout — let the server respond however long it takes
      const response = await this.authorizedFetch(
        apiUrl,
        { method: 'POST', body: JSON.stringify(payload) },
      );

      // Immediate retry on 502 — no delay
      if (response.status === 502 && retryCount < maxRetries) {
        return this.processTopic(topic, resolvedUserId, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        if (response.status === 405) throw new Error('Method Not Allowed (405).');
        if (response.status === 502) throw new Error('Server temporarily unavailable (502 Bad Gateway).');
        if (response.status === 404) throw new Error('API endpoint not found (404).');
        if (response.status === 500) throw new Error('Internal server error (500).');
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      return this.normalizeProcessTopicResponse(data);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to the API server.');
      }
      if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error('CORS error: The API server needs to allow requests from this domain.');
      }
      throw error;
    }
  }

  /**
   * Fire-and-forget keepalive POST of unused ideas to /save-ideas.
   * Synchronous so it survives page unload (tab close / SPA navigation).
   * The payload mirrors the /generate-ideas response shape plus userId:
   * { topic, topic_summary, sources, books, ideas: [{ title, description }], userId }.
   */
  static sendUnusedIdeasKeepalive(
    payload: UnusedIdeasPayload,
    token?: string | null,
  ): void {
    if (!payload?.ideas?.length || !payload.userId) return;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: UnusedIdeasPayload = {
      ...payload,
      topic_summary:
        typeof payload.topic_summary === 'string' ? payload.topic_summary : '',
      sources: normalizeSourcesForSave(payload.sources),
      books: Array.isArray(payload.books) ? payload.books : [],
    };

    try {
      fetch(`${this.BASE_URL}/save-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // fire-and-forget — never block the UI
    }
  }

  /**
   * Async wrapper that resolves the auth token first, then sends unused ideas.
   * Safe to call from normal user interactions (e.g. selecting an idea).
   */
  static async sendUnusedIdeas(payload: UnusedIdeasPayload): Promise<void> {
    if (!payload?.ideas?.length || !payload.userId) return;
    try {
      const token = await this.getAuthToken();
      this.sendUnusedIdeasKeepalive(payload, token);
    } catch {
      // fire-and-forget
    }
  }

  /**
   * Persist a full generate-ideas response via /save-ideas (awaits completion).
   */
  static async saveIdeas(payload: UnusedIdeasPayload): Promise<void> {
    if (!payload?.ideas?.length || !payload.userId) {
      throw new Error('saveIdeas requires userId and at least one idea');
    }

    const token = await this.getAuthToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const body: UnusedIdeasPayload = {
      topic: payload.topic,
      topic_summary:
        typeof payload.topic_summary === 'string' ? payload.topic_summary : '',
      sources: normalizeSourcesForSave(payload.sources),
      books: Array.isArray(payload.books) ? payload.books : [],
      ideas: payload.ideas,
      userId: payload.userId,
    };

    const response = await fetch(`${this.BASE_URL}/save-ideas`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `save-ideas failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`,
      );
    }
  }

  /**
   * Generate via same-origin BFF (`/api/generate-script`).
   * The browser only receives a redacted preview — full script is persisted server-side
   * and released after `/api/unlock-script`.
   */
  static async generateScript(params: GenerationParams, retryCount = 0): Promise<GeneratedScriptData> {
    const maxRetries = 2;

    try {
      const apiUrl = '/api/generate-script';
      const body = {
        userId: params.userId,
        title: params.title,
        description: params.description,
        topic: params.topic,
        time: params.time,
      };

      const response = await this.authorizedFetch(
        apiUrl,
        { method: 'POST', body: JSON.stringify(body) },
      );

      if (response.status === 502 && retryCount < maxRetries) {
        return this.generateScript(params, retryCount + 1);
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 405) throw new Error('Method Not Allowed (405).');
        if (response.status === 502) throw new Error('Server temporarily unavailable (502 Bad Gateway).');
        if (response.status === 404) throw new Error('API endpoint not found (404).');
        if (response.status === 500) throw new Error('Internal server error (500).');
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to the API server.');
      }
      if (error instanceof Error && error.message.includes('CORS')) {
        throw new Error('CORS error: The API server needs to allow requests from this domain.');
      }
      throw error;
    }
  }

  /** Locked-script teaser for blur UI — full body never leaves the server. */
  static async fetchScriptPreview(params: {
    id: string;
    userId: string;
  }): Promise<string> {
    const response = await this.authorizedFetch('/api/script-preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error('Failed to load script preview');
    }
    const json = await response.json().catch(() => ({}));
    return typeof json?.script === 'string' ? json.script : '';
  }

  /**
   * Debit credits and return the full script body (only after successful unlock).
   */
  static async unlockScript(params: {
    userId: string;
    duration: number;
    universalScriptId: string;
    title?: string;
    topic?: string;
    description?: string;
  }): Promise<{
    message: string;
    remaining_credits?: number;
    assignedId?: string | null;
    script: GeneratedScriptData;
  }> {
    const response = await this.authorizedFetch('/api/unlock-script', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.message !== 'success' || !json?.script) {
      const msg =
        json?.error ||
        json?.detail ||
        json?.message ||
        `Unlock failed (${response.status})`;
      throw new Error(typeof msg === 'string' ? msg : 'Unlock failed');
    }
    return json;
  }

  /**
   * Translate an unlocked script via POST /translate-script.
   * `language` must be Title Case English name, e.g. "English", "Telugu".
   */
  static async translateScript(params: {
    userId: string;
    script: string;
    language: string;
  }): Promise<string> {
    const url = `${this.BASE_URL}/translate-script`;
    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        script: params.script,
        language: params.language || 'English',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        errorText || `Translation failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json().catch(() => ({}));
    if (typeof data === 'string' && data.trim()) return data;
    const translated =
      data?.translated ??
      data?.script ??
      data?.translated_script ??
      data?.translation ??
      data?.result ??
      data?.data?.script ??
      data?.data?.translated;
    if (typeof translated === 'string' && translated.trim()) return translated;
    // Some backends return { telugu: "..." } / language-keyed map
    if (data && typeof data === 'object') {
      const langKey = (params.language || 'English').trim().toLowerCase();
      const byLang = (data as Record<string, unknown>)[langKey];
      if (typeof byLang === 'string' && byLang.trim()) return byLang;
    }
    throw new Error('Translation response did not include script text.');
  }

  /**
   * Prepare a script for TTS via POST /add-script-tags.
   * Payload: { userId, script }
   * Returns the tagged_script used by /generate-speech.
   */
  static async addScriptTags(params: {
    userId: string;
    script: string;
  }): Promise<{ tagged_script: string; raw: unknown }> {
    const url = `${this.BASE_URL}/add-script-tags`;
    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        script: params.script,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = `Add script tags failed: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.message || parsed?.error || message;
      } catch {
        if (errorText) message = errorText;
      }
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    let data: unknown = {};
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => '');
      data = text || {};
    }

    const tagged =
      typeof data === 'string'
        ? data
        : (data as Record<string, unknown>)?.tagged_script ??
          (data as Record<string, unknown>)?.taggedScript ??
          (data as Record<string, unknown>)?.script ??
          (data as { data?: Record<string, unknown> })?.data?.tagged_script ??
          (data as { data?: Record<string, unknown> })?.data?.script;

    if (typeof tagged !== 'string' || !tagged.trim()) {
      throw new Error('Add script tags response did not include tagged_script.');
    }

    return { tagged_script: tagged.trim(), raw: data };
  }

  /**
   * Generate speech audio via POST /generate-speech.
   * Payload: { userId, script, voice }
   * `script` should be the tagged_script from /add-script-tags.
   * `voice` is a preset id/name, or "user" for the cloned voice.
   */
  static async generateSpeech(params: {
    userId: string;
    script: string;
    voice: string;
  }): Promise<{ audioUrl: string | null; raw: unknown }> {
    const url = `${this.BASE_URL}/generate-speech`;
    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: JSON.stringify({
        userId: params.userId,
        script: params.script,
        voice: params.voice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = `Generate speech failed: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.message || parsed?.error || message;
      } catch {
        if (errorText) message = errorText;
      }
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio/')) {
      const blob = await response.blob();
      return { audioUrl: URL.createObjectURL(blob), raw: null };
    }

    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => '');

    if (typeof data === 'string' && /^https?:\/\//i.test(data.trim())) {
      return { audioUrl: data.trim(), raw: data };
    }

    const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const nested = (obj.data && typeof obj.data === 'object' ? obj.data : {}) as Record<string, unknown>;
    const audioUrlCandidate =
      obj.audio_url ??
      obj.audioUrl ??
      obj.url ??
      obj.speech_url ??
      obj.speechUrl ??
      nested.audio_url ??
      nested.audioUrl ??
      nested.url;

    return {
      audioUrl:
        typeof audioUrlCandidate === 'string' && audioUrlCandidate.trim()
          ? audioUrlCandidate.trim()
          : null,
      raw: data,
    };
  }

  /**
   * Save a voice-clone sample via POST /save-audio (multipart/form-data).
   * Fields: userId (string), audio (file)
   */
  static async saveAudio(params: {
    userId: string;
    audio: Blob | File;
  }): Promise<unknown> {
    const url = `${this.BASE_URL}/save-audio`;
    const form = new FormData();
    form.append('userId', params.userId);
    // Backend rejects webm/opus — callers should pass WAV; normalize type/name here too.
    const isWav =
      (params.audio.type || '').includes('wav') ||
      (params.audio instanceof File && params.audio.name.toLowerCase().endsWith('.wav'));
    const file =
      params.audio instanceof File && isWav
        ? params.audio
        : new File([params.audio], 'voice-clone.wav', { type: 'audio/wav' });
    form.append('audio', file);

    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = `Save audio failed: ${response.status} ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.message || parsed?.error || message;
      } catch {
        if (errorText) message = errorText;
      }
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json().catch(() => ({}));
    }
    return {};
  }

  /** Generate a YouTube thumbnail image via /generate-thumbnail (20 credits). */
  static async generateThumbnail(
    payload: GenerateThumbnailPayload,
  ): Promise<GenerateThumbnailResult> {
    const url = `${this.BASE_URL}/generate-thumbnail`;
    const body: GenerateThumbnailPayload = {
      userId: payload.userId,
      title: payload.title,
      description: payload.description,
      isFace: payload.isFace,
      script: payload.script,
      thumbnail_text: payload.thumbnail_text,
    };

    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = `Thumbnail generation failed: ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        message = parsed?.message || parsed?.error || message;
      } catch {
        if (errorText) message = errorText;
      }
      const err = new Error(message) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    return (await response.json()) as GenerateThumbnailResult;
  }

  static async pipelineMetrics(topic: string): Promise<TSSResponse> {
    const url = `${this.BASE_URL}/pipeline-metrics`;
    try {
      const response = await this.authorizedFetch(
        url,
        { method: 'POST', body: JSON.stringify({ topic }) },
      );
      if (!response.ok) {
        const body = await response.text().catch(() => '(no body)');
        throw new Error(`pipeline-metrics failed: ${response.status} — ${body}`);
      }
      const data = await response.json() as TSSResponse;
      return data;
    } catch (err) {
      console.error('[pipeline-metrics] error:', err);
      throw err;
    }
  }

  static async eci(topic: string): Promise<ECIResponse> {
    const url = `${this.BASE_URL}/eci`;
    try {
      const response = await this.authorizedFetch(
        url,
        { method: 'POST', body: JSON.stringify({ topic }) },
      );
      if (!response.ok) {
        const body = await response.text().catch(() => '(no body)');
        throw new Error(`eci failed: ${response.status} — ${body}`);
      }
      const data = await response.json() as ECIResponse;
      return data;
    } catch (err) {
      console.error('[eci] error:', err);
      throw err;
    }
  }

  /** Search stock B-roll videos (Pexels-backed). */
  static async searchBroll(payload: BrollSearchPayload): Promise<BrollSearchResponse> {
    const url = `${this.BASE_URL}/search-pexels-videos`;

    let userId = payload.userId?.trim() || null;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
    }

    const body: BrollSearchPayload = {
      query: payload.query.trim(),
      per_page: payload.per_page ?? 15,
      page: payload.page ?? 1,
      ...(payload.orientation ? { orientation: payload.orientation } : {}),
      ...(payload.size ? { size: payload.size } : {}),
      ...(userId ? { userId } : {}),
    };

    const response = await this.authorizedFetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `broll search failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`,
      );
    }

    return (await response.json()) as BrollSearchResponse;
  }

 // ── Trending topics (/trending-data) — category based ───────────────────────

  /** Fetch all raw topics from /trending-data (with a 10-minute cache). */
  private static async fetchAllTopics(): Promise<TrendingTopic[]> {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(TOPICS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_DURATION && Array.isArray(parsed.data)) {
            return parsed.data;
          }
        }
      } catch {
        // corrupt cache — refetch
      }
    }

    const url = `${this.BASE_URL}/trending-data`;
    const response = await this.authorizedFetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('Failed to fetch trending topics');

    const result = await response.json();
    const topics: TrendingTopic[] = Array.isArray(result.message) ? result.message : [];

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          TOPICS_CACHE_KEY,
          JSON.stringify({ data: topics, timestamp: Date.now() })
        );
      } catch {
        // localStorage full — skip caching
      }
    }
    return topics;
  }

  /** Topics for one tab, filtered by category, deduped, up to 20. */
  private static async getTopicsByCategory(category: 'national' | 'international'): Promise<TrendingTopic[]> {
    try {
      const topics = await this.fetchAllTopics();
      const unique = Array.from(new Map(topics.map(t => [t.id, t])).values());
      return unique
        .filter(t => t.category?.toLowerCase() === category)
        .slice(0, TOPICS_PER_TAB);
    } catch {
      return [];
    }
  }

  /** Tab 1 — "National": up to 20 topics with category "national". */
  static async getNationalTopics(): Promise<TrendingTopic[]> {
    return this.getTopicsByCategory('national');
  }

  /** Tab 2 — "International": up to 20 topics with category "international". */
  static async getInternationalTopics(): Promise<TrendingTopic[]> {
    return this.getTopicsByCategory('international');
  }

  static async signUp(request: SignUpRequest) {
    try {
      // STEP 1: Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: request.email,
        password: request.password,
        options: {
          data: {
            full_name: request.full_name,
            credits_remaining: 150,
          },
        },
      });
  
      if (error) throw error;
  
      const user = data.user;
  
      if (!user) {
        throw new Error('User creation failed');
      }
  
      // STEP 2: Insert into profiles table (150 starter credits for new accounts)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: request.email,
          full_name: request.full_name,
          phone: request.phone,
          youtube_link: request.youtube_link,
          instagram_link: request.instagram_link,
          facebook_link: request.facebook_link,
          twitter_link: request.twitter_link,
          billing_address: request.billing_address,
          primary_language: request.primary_language,
          categories: request.categories,
        });
  
      if (profileError) {
        throw profileError;
      }
  
      return data;
    } catch (error) {
      console.error('Sign-up error:', error);
      throw error;
    }
  }

  /**
   * Expire stale credit purchases for the logged-in user.
   * POST /check-credits { userId }
   */
  static async checkCredits(userId: string): Promise<void> {
    const uid = userId?.trim();
    if (!uid) return;

    const response = await this.authorizedFetch(`${this.BASE_URL}/check-credits`, {
      method: 'POST',
      body: JSON.stringify({ userId: uid }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        errorText || `check-credits failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}
