// API service for StoryBit AI backend integration
import { supabase } from '@/lib/supabaseClient';

export interface ProcessTopicRequest {
  topic: string;
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

export interface ProcessTopicResponse {
  ideas: string[];
  descriptions: string[];
  topic_summary?: string;
  similar_past_ideas?: SimilarPastIdea[];
}

export interface UnusedIdea {
  title: string;
  description: string;
}

export interface UnusedIdeasPayload {
  topic: string;
  topic_summary?: string | null;
  ideas: UnusedIdea[];
  userId: string;
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
  /** Video length in minutes */
  time: number;
  /** true = script/thumbnails use the user's photos, false = faceless channel */
  isFace: boolean;
}

/** SEO block returned by /generate-script as `youtube_metadata` */
export interface YoutubeMetadata {
  titles?: string[];
  descriptions?: string[];
  /** Each entry is one set of hashtags (matching a title/description option) */
  hashtags?: string[][];
  thumbnail_text?: string[];
}

export interface BookReference {
  title: string;
  author: string;
}

export type GeneratedScriptData = {
  script: string;
  estimated_word_count?: number;
  /** Legacy field — new responses return `sources` instead */
  source_urls?: string[];
  analysis?: {
    examples_count: number;
    research_facts_count: number;
    proverbs_count: number;
    emotional_depth: string;
    history: number;
  };
  title?: string;
  metrics?: {
    totalWords?: number;
    videoLength?: number;
    emotionalDepth?: number;
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
    const buildHeaders = (token: string | null): Record<string, string> => ({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });

    const token = await this.getAuthToken();
    const response = await fetch(url, {
      ...init,
      headers: buildHeaders(token),
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
          headers: buildHeaders(data.session.access_token),
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
    };
  }

  static async processTopic(topic: string, retryCount = 0): Promise<ProcessTopicResponse> {
    const maxRetries = 2;

    try {
      const apiUrl = `${this.BASE_URL}/generate-ideas`;
      const safeTopic = this.sanitizeTopic(topic);

      // No timeout — let the server respond however long it takes
      const response = await this.authorizedFetch(
        apiUrl,
        { method: 'POST', body: JSON.stringify({ topic: safeTopic }) },
      );

      // Immediate retry on 502 — no delay
      if (response.status === 502 && retryCount < maxRetries) {
        return this.processTopic(topic, retryCount + 1);
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
      console.log('[generate-ideas] response:', data);
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
   * { topic, topic_summary, ideas: [{ title, description }], userId }.
   */
  static sendUnusedIdeasKeepalive(
    payload: UnusedIdeasPayload,
    token?: string | null,
  ): void {
    if (!payload?.ideas?.length || !payload.userId) return;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      fetch(`${this.BASE_URL}/save-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
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

    const response = await fetch(`${this.BASE_URL}/save-ideas`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `save-ideas failed: ${response.status} ${response.statusText}${errorText ? ` — ${errorText}` : ''}`,
      );
    }
  }

  static async generateScript(params: GenerationParams, retryCount = 0): Promise<GeneratedScriptData> {
    const maxRetries = 2;

    try {
      const apiUrl = `${this.BASE_URL}/generate-script`;
      const body = {
        userId: params.userId,
        title: params.title,
        description: params.description,
        time: params.time,
        isFace: params.isFace,
      };
      console.log('Making API request to:', apiUrl);
      console.log('Request payload:', body);

      // No timeout — generation can take as long as needed
      const response = await this.authorizedFetch(
        apiUrl,
        { method: 'POST', body: JSON.stringify(body) },
      );
      console.log('API Response status:', response.status);

      // Immediate retry on 502 — no delay
      if (response.status === 502 && retryCount < maxRetries) {
        return this.generateScript(params, retryCount + 1);
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
      console.log('[generate-script] response:', data);
      return data;
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
      console.log('[pipeline-metrics] ✓', data);
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
      console.log('[eci] ✓', data);
      return data;
    } catch (err) {
      console.error('[eci] error:', err);
      throw err;
    }
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
          },
        },
      });
  
      if (error) throw error;
  
      const user = data.user;
  
      if (!user) {
        throw new Error('User creation failed');
      }
  
      // STEP 2: Insert into profiles table
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
}
