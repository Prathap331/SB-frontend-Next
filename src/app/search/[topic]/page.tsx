'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Loader2, Search, Globe, Sparkles, Link2,
  Check, FileText, AlertCircle, BookOpen, ExternalLink, X,
} from 'lucide-react';
import {
  Youtube,
  User2,
  Newspaper,
} from 'lucide-react';
import { ApiService, TSSResponse, ECIResponse, SimilarPastIdea, GeneratedScriptData, type BookReference } from '@/services/api';
import GenerationProgressOverlay from '@/components/GenerationProgressOverlay';
import { ApiFailCard } from '@/components/ApiFailCard';
import { NewTopicPrompt } from '@/components/NewTopicPrompt';
import { supabase as sbClient } from '@/lib/supabaseClient';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import StudioShell from '@/components/studio/StudioShell';
import {
  StudioStageNav,
  StudioScriptPanel,
  StudioMetadataPanel,
  StudioThumbnailsPanel,
  StudioBRollPanel,
  StudioAudioPanel,
  type StudioTab,
} from '@/components/studio/StudioPanels';
import { StudioVideoEditingPanel } from '@/components/studio/StudioVideoEditingPanel';
import { StudioChromeProvider, useStudioChrome } from '@/components/studio/StudioChromeContext';
import { getScriptTextFromMap } from '@/lib/script-data';
import { DEFAULT_SCRIPT_LANGUAGE } from '@/lib/script-languages';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  saveTopicIdeasToDb,
  loadTopicWorkspace,
  type MergedIdea,
} from '@/lib/recent-topics';
import { normalizeScriptData } from '@/lib/script-data';
import {
  normalizeGeneratedThumbnail,
  normalizeGeneratedThumbnailList,
  SCRIPT_ROW_SELECT,
} from '@/lib/script-persistence';
import {
  lockedScriptPlaceholder,
  SCRIPT_ROW_SELECT_LOCKED,
} from '@/lib/script-security';
import {
  buildStudioHomePath,
  buildStudioTabPath,
  isStudioComposeTopic,
  setStudioTopicCookie,
  studioPathSegmentFromPathname,
  studioTabFromPathname,
} from '@/lib/keyword-routes';
import { maxScriptMinutesForPlan } from '@/lib/credits';
import { toast } from 'sonner';

const SCRIPT_GENERATION_STEPS = [
  'Understanding your topic',
  'Web searching for factual information',
  'Analysing the data',
  'Generating your script for YouTube',
  'Finishing',
];

interface VideoItem {
  url: string;
  title: string;
  thumbnail: string;
}

interface ScriptIdea {
  id: number;
  title: string;
  description: string;
  category: string;
}

const formatNumber = (n?: number) => {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

const videoLinks: string[] = [
  "https://www.youtube.com/watch?v=_Yhyp-_hX2s",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=_Yhyp-_hX2s",
  "https://www.youtube.com/watch?v=K4TOrB7at0Y",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
] as const;


// Cache both in memory and localStorage to persist between visits
const resultsCache = new Map<string, {
  scriptIdeas: ScriptIdea[];
  similarPastIdeas: SimilarPastIdea[];
  topicSummary: string | null;
  sources: string[];
  books: BookReference[];
  error: string | null;
  timestamp: number;
}>();
const pipelineCache = new Map<string, { data: TSSResponse; timestamp: number }>();
const eciCache     = new Map<string, { data: ECIResponse;  timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Shared-promise deduplicator: both Strict-Mode mounts share one fetch promise.
// The second mount awaits the same promise, then reads from cache.
const inFlightIdeas    = new Map<string, Promise<void>>();
const inFlightPipeline = new Set<string>();

interface CacheItem {
  scriptIdeas: ScriptIdea[];
  similarPastIdeas: SimilarPastIdea[];
  topicSummary: string | null;
  sources: string[];
  books: BookReference[];
  error: string | null;
  timestamp: number;
}

interface PipelineCacheItem {
  data: TSSResponse;
  timestamp: number;
}

const getFromLocalStorage = (_topic: string): CacheItem | null => null;

const getPipelineFromLocalStorage = (topic: string): PipelineCacheItem | null => {
  try {
    const item = localStorage.getItem(`topic_pipeline_${topic}`);
    if (!item) return null;
    const parsed = JSON.parse(item) as PipelineCacheItem;
    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`topic_pipeline_${topic}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

interface ECICacheItem {
  data: ECIResponse;
  timestamp: number;
}

const getECIFromLocalStorage = (topic: string): ECICacheItem | null => {
  try {
    const item = localStorage.getItem(`topic_eci_${topic}`);
    if (!item) return null;

    const parsed = JSON.parse(item) as ECICacheItem;

    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`topic_eci_${topic}`);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const saveECIToCache = (topic: string, data: ECIResponse) => {
  const item: ECICacheItem = {
    data,
    timestamp: Date.now(),
  };

  eciCache.set(topic, item);

  try {
    localStorage.setItem(`topic_eci_${topic}`, JSON.stringify(item));
  } catch {
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('topic_eci_')
    );

    if (keys.length > 0) {
      localStorage.removeItem(keys[0]);
      try {
        localStorage.setItem(`topic_eci_${topic}`, JSON.stringify(item));
      } catch {}
    }
  }
};


const fetchVideoMeta = async (url: string) => {
  const response = await fetch(`/api/youtube-meta?url=${encodeURIComponent(url)}`);

  const data = await response.json();

  return {
    title: data.title,
    thumbnail: data.thumbnail_url,
  };
};




const saveToCache = (topic: string, data: CacheItem) => {
  resultsCache.set(topic, data);
};

const savePipelineToCache = (topic: string, data: TSSResponse) => {
  const item: PipelineCacheItem = { data, timestamp: Date.now() };
  pipelineCache.set(topic, item);
  try {
    localStorage.setItem(`topic_pipeline_${topic}`, JSON.stringify(item));
  } catch {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('topic_pipeline_'));
    if (keys.length > 0) {
      localStorage.removeItem(keys[0]);
      try { localStorage.setItem(`topic_pipeline_${topic}`, JSON.stringify(item)); } catch { /* ignore */ }
    }
  }
};

const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of resultsCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) resultsCache.delete(key);
  }
  for (const [key, value] of pipelineCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) pipelineCache.delete(key);
  }
  try {
    const keys = Object.keys(localStorage);
    const topicKeys = keys.filter(k =>
      k.startsWith('topic_pipeline_') ||
      k.startsWith('topic_eci_') ||
      k.startsWith('topic_ideas_') // prune legacy idea cache
    );
    topicKeys.forEach(key => {
      if (key.startsWith('topic_ideas_')) {
        localStorage.removeItem(key);
        return;
      }
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item) as { timestamp: number };
        if (now - parsed.timestamp > CACHE_DURATION) {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Ignore localStorage errors
  }
};


const mapTssToCards = (tssData: TSSResponse) => {
  if (!tssData) return [];

  const tr = tssData.trends ?? {};
  const yt = tssData.youtube ?? {};
  const nw = tssData.news_result ?? {};
  const sc = tssData.social ?? {};

  const fmt = (n?: number) => {
    if (!n) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  return [
    {
      title: "Search",
      color: "#4F46E5",
      bg: "#EEF2FF",
      band: tr.band ?? "—",
      score: Math.round(tr.score ?? 0),
      status: tr.status,
      update: tr.updated_at,
      icon: <Search className="w-3 h-3 text-indigo-600" />,
      metrics: [
        {
          label: "Searches / week",
          value: tr.searches_per_week ?? "—",
          sub: `↑ vs ${tr.vs_avg_week ?? "—"} avg`,
        },
        {
          label: "vs normal week",
          value: tr.vs_normal_week ?? "—",
          sub: "52-week baseline",
        },
        {
          label: "Week-on-week",
          value: tr.week_on_week ?? "—",
          sub: "vs last week",
        },
        {
          label: "Trend direction",
          value: tr.trend_direction ?? "—",
          sub: "4 weeks trend",
        },
      ],
    },

    {
      title: "YouTube",
      color: "#DC2626",
      bg: "#FEF2F2",
      band: yt.band ?? "—",
      score: Math.round(yt.score ?? 0),
      status: yt.status,
      update: yt.updated_at,
      icon: <Youtube className="w-3 h-3 text-red-600" />,
      highlight: yt.creator_competition, // ⚡ bottom warning
    
      metrics: [
        {
          label: "Views this week",
          value: fmt(yt.views_this_week),
          sub: `↑ vs ${fmt(yt.views_last_week)} last week`,
        },
        {
          label: "View growth",
          value: yt.view_growth ?? "—",
          sub: "week-on-week",
        },
        {
          label: "New videos (7d)",
          value: yt.new_videos_7d ?? "—",
          sub: `↑ vs ${yt.videos_tracked ?? "—"} last week`,
        },
        {
          label: "Engagement rate",
          value: yt.engagement_rate ?? "—",
          sub: "↑ active audience",
        },
      ],
    },

    {
      title: "News",
      color: "#525252",
      bg: "#F5F5F5",
      band: nw.band ?? "—",
      score: Math.round(nw.score ?? 0),
      status: nw.status,
      source:nw.source,
      update: nw.updated_at,
      icon: <Newspaper className="w-3 h-3 text-gray-600" />,
    
      metrics: [
        {
          label: "Articles (7d)",
          value: formatNumber(nw.articles_7d),
          sub: `↑ vs ${formatNumber(nw.avg_weekly_baseline || 0)} avg`,
        },
        {
          label: "Publishers",
          value: nw.publishers ?? "—",
          sub: "↑ broad coverage",
        },
        {
          label: "vs normal week",
          value: nw.vs_normal_week ?? "—",
          sub: "above 90-day avg",
        },
        {
          label: "Coverage tone",
          value: nw.coverage_tone ?? "—",
          sub: `tone shift ${nw.tone_shift ?? 0}`,
        },
      ],
    },

    {
      title: "Social",
      color: "#6D28D9",
      bg: "#F5F3FF",
      band: sc.band ?? "—",
      score: Math.round(sc.score ?? 0),
      status: sc.status,
      source: sc.source,
      update: sc.updated_at,
      icon: <User2 className="w-3 h-3 text-purple-600" />,
    
      metrics: [
        {
          label: "Posts (48h)",
          value: formatNumber(sc.posts_48h),
          sub: `↑ vs ${formatNumber(sc.daily_avg)} avg`,
        },
        {
          label: "Communities",
          value: sc.communities ?? "—",
          sub: "Reddit + X clusters",
        },
        {
          label: "Avg comments",
          value: sc.avg_comments ?? "—",
          sub: "per post — growing",
        },
        {
          label: "Sentiment",
          value: sc.sentiment ?? "—",
          sub: `${sc.upvote_pct ?? 0}% upvote ratio`,
        },
      ],
    },
  ];
};

interface TSSMetric {
  label: string;
  value: string | number;
  sub?: string;
}

interface TSSCardProps {
  title: string;
  color: string;
  bg: string;
  band: string;
  score: number;
  source?: string;
  status?: string;
  icon: React.ReactNode;
  metrics: TSSMetric[];
  highlight?: string;
  update: string
}

const TSSCard: React.FC<TSSCardProps> = ({
  title,
  color,
  bg,
  band,
  score,
  source,
  status,
  update,
  icon,
  metrics,
  highlight,
}) => {
  return (
    <div className="bg-white border  rounded-2xl overflow-hidden" style={{ border: `1px solid ${color}` }}>

      {/* TOP BORDER */}
      {/* <div className="h-[2px]" style={{ background: color }} /> */}

      {/* HEADER */}
      <div className="px-5 py-4 flex justify-between items-start border-b border-[#EEECE7]">

        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: bg }}>
            {icon}
          </div>

          <div>
            <p className="text-lg font-semibold text-[#1C1A17]">{title}</p>

            <p className="text-[11px] text-[#A8A49D]">
              {title === "Search" && "Google Trends web · 52wk"}
              {title === "YouTube" && "YouTube Data API · top recent videos"}
              {title === "News" && source}
              {title === "Social" && source}
            </p>

            <p className="text-[11px] text-green-600 mt-0.5">
              ● {status || ""} {update}
            </p>
          </div>
        </div>

        {/* BADGE */}
        <span
          className="text-[11px] px-2 py-[2px] rounded-full"
          style={{ background: bg, color }}
        >
          ● {band}
        </span>
      </div>

      {/* SCORE */}
      <div className="px-5 py-4">
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-semibold" style={{ color }}>
            {score}
          </span>
          <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
        </div>

        <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
          <div
            className="h-full"
            style={{ width: `${score}%`, background: color }}
          />
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 text-sm border-t border-[#EEECE7]">
        {metrics.map((m: TSSMetric, i: number) => (
          <div
            key={i}
            className={`p-4 ${i !== 3 ? "border-r border-[#EEECE7]" : ""}`}
          >
            <p className="text-[10px] text-[#A8A49D] uppercase">
              {m.label}
            </p>

            <p className="font-semibold text-[#1C1A17]">
              {m.value}
            </p>

            <p className="text-[11px] text-green-600">
              {m.sub}
            </p>
          </div>
        ))}
      </div>

      {/* ⚡ YOUTUBE WARNING STRIP */}
      {highlight && title === "YouTube" && (
        <div className="px-4 py-2 bg-yellow-50 text-[11px] text-yellow-700 border-t border-yellow-200">
          ⚠ {highlight} creator competition — {metrics[2]?.value} new videos this week. Window is narrowing.
        </div>
      )}
    </div>
  );
};

export default function SearchTopicPage() {
  return (
    <StudioChromeProvider>
      <SearchTopicPageInner />
    </StudioChromeProvider>
  );
}

function SearchTopicPageInner() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchPath } = useKeywordNavigation();
  const { setSidebarCollapsed } = useStudioChrome();
  // Read raw param and decode safely so UI shows spaces (not "%20")
  const rawTopic = Array.isArray(params?.topic) ? params.topic[0] : params?.topic ?? '';
  const topicFromRewrite = (() => {
    try {
      return decodeURIComponent(rawTopic);
    } catch {
      return rawTopic;
    }
  })();
  // Prefer topic from /app/content-ideas/{topic}; else middleware rewrite / cookie topic
  const pathSegment = studioPathSegmentFromPathname(pathname);
  const tabFromPath = studioTabFromPathname(pathname);
  const topicFromContentIdeasPath =
    tabFromPath === 'ideas' && pathSegment ? pathSegment : '';
  const topic = topicFromContentIdeasPath || topicFromRewrite;
  const ideaFromPath =
    tabFromPath &&
    tabFromPath !== 'ideas' &&
    tabFromPath !== 'broll' &&
    tabFromPath !== 'audio' &&
    tabFromPath !== 'video-editing'
      ? pathSegment
      : null;
  const scriptIdParam = searchParams.get('scriptId');
  const isScriptViewerMode = !!scriptIdParam;
  const isComposePlaceholder = isStudioComposeTopic(topic) && !isScriptViewerMode;

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composeOnTopicRef = useRef<string | null>(null);
  const loadedScriptIdRef = useRef<string | null>(null);
  const [isComposingNew, setIsComposingNew] = useState(
    () => !scriptIdParam && (searchParams.get('new') === '1' || isStudioComposeTopic(topic)),
  );

  const formatNumber = (n?: number) => {
    if (!n) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };
  
  const pct = (n?: number) => (n ? `${n.toFixed(1)}%` : "—");

  const [scriptIdeas, setScriptIdeas] = useState<ScriptIdea[]>([]);
  const [similarPastIdeas, setSimilarPastIdeas] = useState<SimilarPastIdea[]>([]);
  const [topicSummary, setTopicSummary] = useState<string | null>(null);
  const [ideaSources, setIdeaSources] = useState<string[]>([]);
  const [ideaBooks, setIdeaBooks] = useState<BookReference[]>([]);
  const [ideasRefPanel, setIdeasRefPanel] = useState<'sources' | 'books' | null>(null);
  const [ideasPanelTopPx, setIdeasPanelTopPx] = useState(208);
  // Vault/my-scripts opens must not spin the ideas-generation overlay
  const [isLoading, setIsLoading] = useState(() => !scriptIdParam);
  const [fetchReady, setFetchReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptViewerLoading, setScriptViewerLoading] = useState(() => !!scriptIdParam);

  const [videoLengths, setVideoLengths] = useState<Record<number, string>>({});
  const initialTab = studioTabFromPathname(pathname) ?? (scriptIdParam ? 'script' : 'ideas');
  const [studioTab, setStudioTabState] = useState<StudioTab>(initialTab);
  /** Ideas tab stays enabled for vault / my-scripts opens (loaded from script topic) */
  const [ideasTabDisabled, setIdeasTabDisabled] = useState(false);
  const [generatedIdeaIds, setGeneratedIdeaIds] = useState<Set<number>>(new Set());
  const [ideaScripts, setIdeaScripts] = useState<Record<number, {
    data: GeneratedScriptData;
    ideaTitle: string;
    ideaDescription?: string;
    scriptRowId?: string | null;
    universalScriptId?: string | null;
    fromAssigned?: boolean;
  }>>({});
  const [activeScriptData, setActiveScriptData] = useState<GeneratedScriptData | null>(null);
  const [activeScriptIdeaTitle, setActiveScriptIdeaTitle] = useState<string>(
    () => (ideaFromPath && ideaFromPath !== 'script' ? ideaFromPath : ''),
  );
  const [activeScriptIdeaDescription, setActiveScriptIdeaDescription] = useState<string>('');
  const [activeScriptTopic, setActiveScriptTopic] = useState<string>('');
  const [activeScriptDuration, setActiveScriptDuration] = useState<number>(10);
  const [activeUniversalScriptId, setActiveUniversalScriptId] = useState<string | null>(null);
  const [activeScriptRowId, setActiveScriptRowId] = useState<string | null>(null);
  const [activeScriptFromAssigned, setActiveScriptFromAssigned] = useState(false);
  const [activeScriptLanguage, setActiveScriptLanguage] = useState(DEFAULT_SCRIPT_LANGUAGE);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenReady, setScriptGenReady] = useState(false);
  const [scriptGenError, setScriptGenError] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [userTier, setUserTier] = useState<string>('Free');
  const maxScriptMinutes = maxScriptMinutesForPlan(userTier);

  // Load plan tier for script length limits
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session?.user?.id || cancelled) return;
      const { data: profile } = await sbClient
        .from('user_profiles')
        .select('user_tier')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setUserTier((profile?.user_tier || 'Free').trim() || 'Free');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Prefer the script's topic when opened from vault / my-scripts */
  const effectiveTopic = (
    activeScriptTopic && !isStudioComposeTopic(activeScriptTopic)
      ? activeScriptTopic
      : topic
  ).trim();

  // Keep topic cookie so /app/script/{idea} rewrites onto the right /search/{topic}.
  // Clear it on compose home so tab clicks cannot jump to a previous/recent topic.
  useEffect(() => {
    if (isScriptViewerMode) {
      if (effectiveTopic && !isStudioComposeTopic(effectiveTopic)) {
        setStudioTopicCookie(effectiveTopic);
        try {
          sessionStorage.setItem('studio_search_topic', effectiveTopic);
        } catch { /* ignore */ }
      }
      return;
    }
    if (isStudioComposeTopic(topic)) {
      setStudioTopicCookie('');
      return;
    }
    setStudioTopicCookie(topic);
    try {
      sessionStorage.setItem('studio_search_topic', topic);
    } catch { /* ignore */ }
  }, [topic, isScriptViewerMode, effectiveTopic]);

  const navigateStudioTab = useCallback(
    (
      tab: StudioTab,
      replace = false,
      overrides?: { ideaTitle?: string | null },
    ) => {
      setStudioTabState(tab);
      if (tab === 'video-editing') {
        setSidebarCollapsed(true);
      }

      // On /app/content-ideas (no topic yet): switch tabs locally — do not push
      // /app/script|metadata|… URLs that middleware rewrites via the topic cookie.
      if (!scriptIdParam && isStudioComposeTopic(topic)) {
        const home = buildStudioHomePath();
        if (pathname !== home) {
          if (replace) router.replace(home, { scroll: false });
          else router.push(home, { scroll: false });
        }
        return;
      }

      const ideaTitle =
        overrides?.ideaTitle ?? (activeScriptIdeaTitle || ideaFromPath);
      const href = buildStudioTabPath(tab, {
        topic: isStudioComposeTopic(effectiveTopic) ? null : effectiveTopic,
        ideaTitle,
        scriptId: scriptIdParam,
      });
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [
      router,
      topic,
      effectiveTopic,
      scriptIdParam,
      activeScriptIdeaTitle,
      ideaFromPath,
      pathname,
      setSidebarCollapsed,
    ],
  );

  const setStudioTab = useCallback(
    (tab: StudioTab, overrides?: { ideaTitle?: string | null }) => {
      if (ideasTabDisabled && tab === 'ideas') return;
      navigateStudioTab(tab, false, overrides);
    },
    [ideasTabDisabled, navigateStudioTab],
  );

  // Keep tab state in sync when the URL changes (back/forward, deep links).
  // On compose home, tabs stay local (URL remains /app/content-ideas).
  useEffect(() => {
    if (!scriptIdParam && isStudioComposeTopic(topic)) return;
    const fromUrl = studioTabFromPathname(pathname);
    if (fromUrl && fromUrl !== studioTab) {
      if (ideasTabDisabled && fromUrl === 'ideas') {
        navigateStudioTab('script', true);
        return;
      }
      setStudioTabState(fromUrl);
      if (fromUrl === 'video-editing') {
        setSidebarCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, ideasTabDisabled, topic, scriptIdParam]);

  // Open vault / my-scripts cards inside the studio — load script + enable Content Ideas
  useEffect(() => {
    if (!scriptIdParam) {
      loadedScriptIdRef.current = null;
      setIdeasTabDisabled(false);
      setScriptViewerLoading(false);
      return;
    }

    setIdeasTabDisabled(false);
    setIsComposingNew(false);
    setIsLoading(false);

    // Already loaded this script — show immediately (no spinner loop)
    if (loadedScriptIdRef.current === scriptIdParam && activeScriptData) {
      setScriptViewerLoading(false);
      return;
    }

    let cancelled = false;
    setFetchReady(false);
    setError(null);
    setScriptViewerLoading(true);
    setStudioTabState(studioTabFromPathname(pathname) ?? 'script');

    const load = async () => {
      const applyRow = async (
        row: Record<string, any>,
        fromAssigned: boolean,
      ) => {
        if (cancelled) return;
        const title = row.title || row.topic || 'Script';
        const rowTopic = String(row.topic || '').trim();
        const base = normalizeScriptData(row);
        let scriptText = base.script || '';
        if (!fromAssigned) {
          try {
            const { data: { session } } = await sbClient.auth.getSession();
            if (session?.user?.id && row.id) {
              scriptText = await ApiService.fetchScriptPreview({
                id: String(row.id),
                userId: session.user.id,
              });
            }
          } catch { /* keep fallback */ }
          if (!scriptText.trim()) {
            scriptText = lockedScriptPlaceholder(base.structure);
          }
        }
        const normalized = fromAssigned
          ? { ...base, title, locked: false }
          : {
              ...base,
              title,
              script: scriptText,
              locked: true,
              scriptsByLanguage: undefined,
              scriptRowId: row.id != null ? String(row.id) : null,
            };
        setActiveScriptData(normalized);
        setActiveScriptIdeaTitle(title);
        setActiveScriptIdeaDescription(row.description ?? '');
        setActiveScriptTopic(rowTopic);
        setActiveScriptDuration(Number(row.metrics?.videoLength || 10) || 10);
        setActiveScriptRowId(row.id != null ? String(row.id) : null);
        setActiveUniversalScriptId(fromAssigned ? null : (row.id != null ? String(row.id) : null));
        setActiveScriptFromAssigned(fromAssigned);
        setActiveScriptLanguage(DEFAULT_SCRIPT_LANGUAGE);
        setIsLoading(false);
        setScriptViewerLoading(false);
        loadedScriptIdRef.current = scriptIdParam;

        if (rowTopic && !isStudioComposeTopic(rowTopic)) {
          setStudioTopicCookie(rowTopic);
          try {
            sessionStorage.setItem('studio_search_topic', rowTopic);
          } catch { /* ignore */ }
        }

        // Only normalize placeholder /app/script/script?... → real title (no remount loop).
        // Do not rewrite when opened on audio (or other non-script tabs) via ?scriptId=
        const tabFromPath = studioTabFromPathname(pathname);
        if (tabFromPath === 'script' || tabFromPath === null) {
          const currentIdea = studioPathSegmentFromPathname(pathname);
          if (!currentIdea || currentIdea === 'script' || currentIdea === 'idea') {
            router.replace(
              buildStudioTabPath('script', {
                topic: rowTopic || null,
                ideaTitle: title,
                scriptId: scriptIdParam,
              }),
              { scroll: false },
            );
          }
        }
      };

      try {
        const { data: assigned } = await sbClient
          .from('scripts_assigned')
          .select(SCRIPT_ROW_SELECT)
          .eq('id', scriptIdParam)
          .maybeSingle();

        if (cancelled) return;

        if (assigned) {
          await applyRow(assigned, true);
          return;
        }

        const { data: universal, error: uErr } = await sbClient
          .from('scripts_universal')
          .select(SCRIPT_ROW_SELECT_LOCKED)
          .eq('id', scriptIdParam)
          .maybeSingle();

        if (cancelled) return;

        if (uErr || !universal) {
          setError('Script not found.');
          setScriptViewerLoading(false);
          setIsLoading(false);
          return;
        }

        await applyRow(universal, false);
      } catch (err) {
        console.error('[script viewer]', err);
        if (!cancelled) {
          setError('Failed to load script.');
          setScriptViewerLoading(false);
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // intentionally omit activeScriptData — only re-run when scriptId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptIdParam]);

  // Mobile suggested scripts from Content Vault
  type MobileScriptRow = {
    id: string;
    title: string | null;
    script: string | null;
    topic: string | null;
    metrics?: { videoLength?: number; totalWords?: number } | null;
  };
  const [mobileSuggested, setMobileSuggested] = useState<MobileScriptRow[]>([]);
  useEffect(() => {
    sbClient
      .from('scripts_universal')
      .select('id, title, script, topic, metrics')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setMobileSuggested(data as MobileScriptRow[]); });
  }, []);
  const [searchQuery, setSearchQuery] = useState(topic);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tss' | 'eci'>('tss');
  const [tssData, setTssData] = useState<TSSResponse | null>(null);
  const [eciData, setEciData] = useState<ECIResponse | null>(null);
  const [isTssLoading, setIsTssLoading] = useState(false);
  const [isEciLoading, setIsEciLoading] = useState(false);
  const initialLoadStartRef = useRef<number | null>(null);
  type FilterButton = "category" | "status";
const [activeButton, setActiveButton] = useState<FilterButton | null>("category");
const [videos, setVideos] = useState<VideoItem[]>([]);

const handleClick = (buttonName: FilterButton) => {
  setActiveButton(buttonName);
};

useEffect(() => {
  const load = async () => {
    const result: VideoItem[] = [];

    for (const url of videoLinks) {
      const meta = await fetchVideoMeta(url);
      result.push({
        url,
        title: meta.title,
        thumbnail: meta.thumbnail,
      });
    }

    setVideos(result);
  };

  load();
}, []);




  useEffect(() => {
    cleanupCache();
  }, []);

  // // Fetch TSS — cached per topic
  // useEffect(() => {
  //   if (!topic) return;
  //   const mem = pipelineCache.get(topic);
  //   if (mem && Date.now() - mem.timestamp < CACHE_DURATION) { setTssData(mem.data); return; }
  //   const ls = getPipelineFromLocalStorage(topic);
  //   if (ls) { pipelineCache.set(topic, ls); setTssData(ls.data); return; }
  //   if (inFlightPipeline.has(topic)) return;
  //   inFlightPipeline.add(topic);
  //   setIsTssLoading(true);
  //   setTssData(null);
  //   ApiService.pipelineMetrics(topic)
  //   .then(data => {
  //     console.log("🔥 TSS API RESPONSE:", data); // ✅ HERE
  //     savePipelineToCache(topic, data);
  //     setTssData(data);
  //   })
  //     .catch(err => console.error('[tss]', err))
  //     .finally(() => { setIsTssLoading(false); inFlightPipeline.delete(topic); });
  // }, [topic]);

  // // Fetch ECI — lazy: only when ECI tab is first activated
  // useEffect(() => {
  //   if (!topic || activeTab !== 'eci') return;
  
  //   // ✅ 1. Memory cache
  //   const mem = eciCache.get(topic);
  //   if (mem && Date.now() - mem.timestamp < CACHE_DURATION) {
  //     console.log("⚡ ECI memory cache hit");
  //     setEciData(mem.data);
  //     return;
  //   }
  
  //   // ✅ 2. localStorage cache
  //   const ls = getECIFromLocalStorage(topic);
  //   if (ls) {
  //     console.log("💾 ECI localStorage cache hit");
  //     eciCache.set(topic, ls);
  //     setEciData(ls.data);
  //     return;
  //   }
  
  //   // ❌ No cache → fetch
  //   setIsEciLoading(true);
  //   setEciData(null);
  
  //   ApiService.eci(topic)
  //     .then((data) => {
  //       console.log("🔥 ECI API RESPONSE:", data);
  
  //       // ✅ SAVE HERE
  //       saveECIToCache(topic, data);
  
  //       setEciData(data);
  //     })
  //     .catch((err) => console.error('[eci]', err))
  //     .finally(() => setIsEciLoading(false));
  // }, [topic, activeTab]);

  const applyMergedIdeas = useCallback((
    ideas: MergedIdea[],
    opts?: {
      /** Keep the currently opened vault/my-scripts script selected */
      preserveActive?: boolean;
      active?: {
        data: GeneratedScriptData;
        ideaTitle: string;
        ideaDescription?: string;
        scriptRowId?: string | null;
        universalScriptId?: string | null;
        fromAssigned?: boolean;
        topic?: string;
      } | null;
    },
  ) => {
    setScriptIdeas(ideas.map(({ id, title, description, category }) => ({
      id, title, description, category,
    })));

    const generated = new Set<number>();
    const scripts: Record<number, {
      data: GeneratedScriptData;
      ideaTitle: string;
      ideaDescription?: string;
      scriptRowId?: string | null;
      universalScriptId?: string | null;
      fromAssigned?: boolean;
    }> = {};

    for (const idea of ideas) {
      if (idea.generated && idea.script) {
        generated.add(idea.id);
        scripts[idea.id] = {
          data: idea.script,
          ideaTitle: idea.title,
          ideaDescription: idea.description,
          scriptRowId: idea.scriptRowId ?? null,
          universalScriptId: idea.fromAssigned ? null : (idea.scriptRowId ?? null),
          fromAssigned: !!idea.fromAssigned,
        };
      }
    }

    const preserved = opts?.preserveActive ? opts.active : null;
    if (preserved?.data) {
      const titleKey = (preserved.ideaTitle || '').trim().toLowerCase();
      const rowId = preserved.scriptRowId != null ? String(preserved.scriptRowId) : '';
      const match = ideas.find((idea) => {
        if (rowId && idea.scriptRowId != null && String(idea.scriptRowId) === rowId) {
          return true;
        }
        return titleKey && idea.title.trim().toLowerCase() === titleKey;
      });
      if (match) {
        generated.add(match.id);
        scripts[match.id] = {
          data: preserved.data,
          ideaTitle: preserved.ideaTitle || match.title,
          ideaDescription: preserved.ideaDescription || match.description,
          scriptRowId: preserved.scriptRowId ?? match.scriptRowId ?? null,
          universalScriptId: preserved.universalScriptId ?? null,
          fromAssigned: !!preserved.fromAssigned,
        };
      }
      setGeneratedIdeaIds(generated);
      setIdeaScripts(scripts);
      return;
    }

    setGeneratedIdeaIds(generated);
    setIdeaScripts(scripts);

    const first = ideas.find((i) => i.generated && i.script);
    if (first?.script) {
      setActiveScriptData(first.script);
      setActiveScriptIdeaTitle(first.title);
      setActiveScriptIdeaDescription(first.description || '');
      setActiveScriptTopic(topic);
      setActiveScriptRowId(first.scriptRowId ?? null);
      setActiveUniversalScriptId(first.fromAssigned ? null : (first.scriptRowId ?? null));
      setActiveScriptFromAssigned(!!first.fromAssigned);
      const mins = Number(first.script.metrics?.videoLength || 10);
      setActiveScriptDuration(Number.isFinite(mins) && mins > 0 ? mins : 10);
    } else {
      setActiveScriptData(null);
      setActiveScriptIdeaTitle('');
      setActiveScriptIdeaDescription('');
      setActiveScriptTopic('');
      setActiveScriptDuration(10);
      setActiveScriptRowId(null);
      setActiveUniversalScriptId(null);
      setActiveScriptFromAssigned(false);
    }
  }, [topic]);

  const persistNewIdeas = useCallback(async (
    ideas: ScriptIdea[],
    summary: string | null = null,
    sources: string[] = [],
    books: BookReference[] = [],
    topicOverride?: string | null,
  ) => {
    const saveTopic = (topicOverride || effectiveTopic || topic).trim();
    if (!saveTopic || isStudioComposeTopic(saveTopic) || !ideas.length) return;
    const { data: { session } } = await sbClient.auth.getSession();
    await saveTopicIdeasToDb(saveTopic, ideas, {
      // /save-ideas requires a string — never send null
      topicSummary: summary ?? '',
      sources,
      books,
      userId: session?.user?.id ?? null,
    });
    // Keep idea cards; scripts will merge on next load from DB
    setSidebarRefresh((n) => n + 1);
  }, [topic, effectiveTopic]);

  const newTopicParam = searchParams.get('new');

  // Enter compose mode from ?new=1 or the studio home topic (/app/content-ideas)
  useEffect(() => {
    if (isScriptViewerMode) return;
    if (newTopicParam !== '1' && !isComposePlaceholder) return;

    composeOnTopicRef.current = topic;
    setIsComposingNew(true);
    setSearchQuery('');
    setIsLoading(false);
    setFetchReady(false);
    setError(null);

    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 80);

    // Strip ?new=1 once so this effect does not re-fire in a loop
    if (newTopicParam === '1') {
      router.replace(searchPath(topic), { scroll: false });
    }

    return () => window.clearTimeout(focusTimer);
    // intentionally omit router/searchPath — new function refs every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newTopicParam, isComposePlaceholder, topic, isScriptViewerMode]);

  // Sync search box / compose flag when URL topic changes — do NOT wipe script state here
  // (async load below restores ideas + locked/unlocked scripts from Supabase)
  useEffect(() => {
    if (isScriptViewerMode) return;
    if (isComposePlaceholder) return;
    if (composeOnTopicRef.current === topic) return;

    composeOnTopicRef.current = null;
    setIsComposingNew(false);
    setSearchQuery(topic);
    setStudioTabState('ideas');
  }, [topic, isComposePlaceholder, isScriptViewerMode]);

  const handleSearchSubmit = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      searchInputRef.current?.focus();
      return;
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    if (wordCount < 4) {
      setSearchWarning(
        'For better AI responses, please describe your search using at least 4 words.',
      );
      return;
    }
    setSearchWarning(null);

    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      try {
        localStorage.setItem(
          'post_auth_redirect',
          `${window.location.origin}${searchPath(trimmed)}`,
        );
      } catch { /* ignore */ }
      router.push('/auth');
      return;
    }

    composeOnTopicRef.current = null;
    setIsComposingNew(false);
    router.push(searchPath(trimmed));
  };

  const handleProgressFinished = useCallback(() => {
    setIsLoading(false);
    setFetchReady(false);
  }, []);

  const handleScriptProgressFinished = useCallback(() => {
    setIsGeneratingScript(false);
    setScriptGenReady(false);
  }, []);

  const finishLoading = useCallback(() => {
    setFetchReady(true);
    // Show ideas immediately; overlay closes itself via ready=true
    setIsLoading(false);
  }, []);

  // Snapshot for vault/my-scripts preserve — avoid putting these in the ideas effect deps
  // (that caused an infinite load loop when applyMergedIdeas updated activeScriptData).
  const activeScriptSnapshotRef = useRef<{
    data: GeneratedScriptData | null;
    ideaTitle: string;
    ideaDescription: string;
    scriptRowId: string | null;
    universalScriptId: string | null;
    fromAssigned: boolean;
  }>({
    data: null,
    ideaTitle: '',
    ideaDescription: '',
    scriptRowId: null,
    universalScriptId: null,
    fromAssigned: false,
  });
  activeScriptSnapshotRef.current = {
    data: activeScriptData,
    ideaTitle: activeScriptIdeaTitle,
    ideaDescription: activeScriptIdeaDescription,
    scriptRowId: activeScriptRowId,
    universalScriptId: activeUniversalScriptId,
    fromAssigned: activeScriptFromAssigned,
  };

  /** Topic key that should drive Content Ideas loading */
  const ideasTopicKey = (
    isScriptViewerMode ? activeScriptTopic : topic
  ).trim();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (ideasTabDisabled) return;

      const ideasTopic = ideasTopicKey;

      if (isScriptViewerMode) {
        if (!ideasTopic || isStudioComposeTopic(ideasTopic)) return;
      } else if (!ideasTopic || isComposingNew || isComposePlaceholder) {
        if (isComposingNew || isComposePlaceholder) {
          setIsLoading(false);
          setFetchReady(false);
        }
        return;
      }

      const applyCached = (cached: {
        scriptIdeas: ScriptIdea[];
        similarPastIdeas?: SimilarPastIdea[];
        topicSummary?: string | null;
        sources?: string[];
        books?: BookReference[];
        error: string | null;
      }) => {
        setScriptIdeas(cached.scriptIdeas);
        setSimilarPastIdeas(cached.similarPastIdeas ?? []);
        setTopicSummary(cached.topicSummary ?? null);
        setIdeaSources(cached.sources ?? []);
        setIdeaBooks(cached.books ?? []);
        setError(cached.error);
      };

      // Instant paint from in-memory cache (recent topics feel instant)
      const memHit = resultsCache.get(ideasTopic);
      if (memHit?.scriptIdeas?.length) {
        applyCached(memHit);
        finishLoading();
      } else if (!isScriptViewerMode) {
        setFetchReady(false);
        setIsLoading(true);
      } else {
        setFetchReady(false);
      }

      const { data: { session } } = await sbClient.auth.getSession();
      if (cancelled) return;
      const userId = session?.user?.id ?? null;

      const snap = activeScriptSnapshotRef.current;
      const preserveOpts = isScriptViewerMode
        ? {
            preserveActive: true as const,
            active: snap.data
              ? {
                  data: snap.data,
                  ideaTitle: snap.ideaTitle,
                  ideaDescription: snap.ideaDescription,
                  scriptRowId: snap.scriptRowId,
                  universalScriptId: snap.universalScriptId,
                  fromAssigned: snap.fromAssigned,
                  topic: ideasTopic,
                }
              : null,
          }
        : undefined;

      // Always prefer Supabase: saved_ideas + scripts_universal/assigned (locked or unlocked)
      const workspace = await loadTopicWorkspace(ideasTopic, userId);
      if (cancelled) return;

      if (workspace && workspace.ideas.length > 0) {
        applyMergedIdeas(workspace.ideas, preserveOpts);
        const mem = resultsCache.get(ideasTopic);
        setSimilarPastIdeas(mem?.similarPastIdeas ?? []);
        setTopicSummary(workspace.topicSummary ?? mem?.topicSummary ?? null);
        setIdeaSources(
          (workspace.sources?.length ? workspace.sources : null) ?? mem?.sources ?? [],
        );
        setIdeaBooks(
          (workspace.books?.length ? workspace.books : null) ?? mem?.books ?? [],
        );
        setError(null);
        saveToCache(ideasTopic, {
          scriptIdeas: workspace.ideas.map(({ id, title, description, category }) => ({
            id, title, description, category,
          })),
          similarPastIdeas: mem?.similarPastIdeas ?? [],
          topicSummary: workspace.topicSummary ?? mem?.topicSummary ?? null,
          sources: (workspace.sources?.length ? workspace.sources : null) ?? mem?.sources ?? [],
          books: (workspace.books?.length ? workspace.books : null) ?? mem?.books ?? [],
          error: null,
          timestamp: Date.now(),
        });
        finishLoading();
        return;
      }

      // 2. Another mount is already fetching — await then re-check DB / memory
      if (inFlightIdeas.has(ideasTopic)) {
        await inFlightIdeas.get(ideasTopic);
        if (cancelled) return;
        const again = await loadTopicWorkspace(ideasTopic, userId);
        if (cancelled) return;
        if (again?.ideas.length) {
          applyMergedIdeas(again.ideas, preserveOpts);
          const mem = resultsCache.get(ideasTopic);
          setSimilarPastIdeas(mem?.similarPastIdeas ?? []);
          setTopicSummary(again.topicSummary ?? mem?.topicSummary ?? null);
          setIdeaSources(
            (again.sources?.length ? again.sources : null) ?? mem?.sources ?? [],
          );
          setIdeaBooks(
            (again.books?.length ? again.books : null) ?? mem?.books ?? [],
          );
          setError(null);
          finishLoading();
          return;
        }
        const result = resultsCache.get(ideasTopic);
        if (result) {
          applyCached(result);
          finishLoading();
          return;
        }
        finishLoading();
        return;
      }

      // Already painted from cache and DB has nothing new — stop
      if (memHit?.scriptIdeas?.length) {
        finishLoading();
        return;
      }

      // 3. Generate ideas via API and persist to saved_ideas
      let settleFetch!: () => void;
      inFlightIdeas.set(ideasTopic, new Promise<void>(res => { settleFetch = res; }));

      initialLoadStartRef.current = Date.now();
      setError(null);
      setScriptIdeas([]);
      setSimilarPastIdeas([]);
      setTopicSummary(null);
      setIdeaSources([]);
      setIdeaBooks([]);
      setIdeasRefPanel(null);
      if (!isScriptViewerMode) {
        setGeneratedIdeaIds(new Set());
        setIdeaScripts({});
        setActiveScriptData(null);
        setActiveScriptFromAssigned(false);
      }

      const maxWaitMs = 300000;
      const retryDelayMs = 5000;

      const applyResult = (
        ideas: ScriptIdea[],
        err: string | null,
        summary: string | null = null,
        relatedIdeas: SimilarPastIdea[] = [],
        sources: string[] = [],
        books: BookReference[] = [],
      ) => {
        // Surface /generate-ideas results immediately — never block the UI on /save-ideas
        if (!err) {
          saveToCache(ideasTopic, {
            scriptIdeas: ideas,
            similarPastIdeas: relatedIdeas,
            topicSummary: summary,
            sources,
            books,
            error: err,
            timestamp: Date.now(),
          });
        }

        inFlightIdeas.delete(ideasTopic);
        settleFetch();

        if (cancelled) return;

        if (isScriptViewerMode && !err && ideas.length) {
          applyMergedIdeas(
            ideas.map((idea) => ({ ...idea, generated: false, script: null })),
            preserveOpts,
          );
        } else {
          setScriptIdeas(ideas);
        }
        setSimilarPastIdeas(relatedIdeas);
        setError(err);
        setTopicSummary(summary);
        setIdeaSources(sources);
        setIdeaBooks(books);
        finishLoading();

        if (!err && ideas.length) {
          void persistNewIdeas(ideas, summary, sources, books, ideasTopic).catch((persistErr) => {
            console.error('[script-ideas] persist after generate failed:', persistErr);
          });
        }
      };

      while (true) {
        try {
          const response = await ApiService.processTopic(ideasTopic, userId);

          const ideas: ScriptIdea[] = (response.ideas ?? []).map((idea, idx) => ({
            id: idx + 1,
            title: idea,
            description:
              (response.descriptions ?? [])[idx] ||
              "No description available.",
            category: getCategoryFromIndex(idx),
          }));

          applyResult(
            ideas,
            null,
            response.topic_summary ?? null,
            response.similar_past_ideas ?? [],
            response.sources ?? [],
            response.books ?? [],
          );

          return;
        } catch (err) {
          const elapsed = Date.now() - (initialLoadStartRef.current ?? Date.now());
          const message = err instanceof Error ? err.message : String(err);

          const isRetryable = message.includes('502') || message.toLowerCase().includes('temporarily unavailable');
          if (isRetryable && elapsed + retryDelayMs < maxWaitMs) {
            await new Promise(r => setTimeout(r, retryDelayMs));
            continue;
          }

          const errorMessage = message.includes('timeout')
            ? 'API request timed out. Please try again.'
            : message.includes('502')
            ? 'Server temporarily unavailable. Please try again.'
            : message || 'API temporarily unavailable. Please try again.';

          applyResult([], errorMessage);
          return;
        }
      }
    };

    void run();
    return () => { cancelled = true; };
    // Only re-run when the topic (or viewer script topic) changes — not when active script state updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ideasTopicKey,
    isScriptViewerMode,
    isComposingNew,
    isComposePlaceholder,
    ideasTabDisabled,
  ]);

  const getCategoryFromIndex = (index: number) => {
    const categoryMap = ['Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'];
    return categoryMap[index % categoryMap.length];
  };


  // ── Script generation ─────────────────────────────────────────────────────
  const startScriptGeneration = async (idea: ScriptIdea) => {
    if (!videoLengths[idea.id]) {
      console.warn('No length specified for this script');
      return;
    }

    const requested = Number(videoLengths[idea.id] || 0);
    if (!Number.isFinite(requested) || requested < 1) {
      toast.error('Enter a valid script length in minutes');
      return;
    }
    if (requested > maxScriptMinutes) {
      toast.error(
        `Your ${userTier} plan allows up to ${maxScriptMinutes} min scripts. Upgrade for longer scripts.`,
        {
          action: {
            label: 'Upgrade',
            onClick: () => router.push('/pricing'),
          },
        },
      );
      return;
    }

    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }

    const payload = {
      userId: session.user.id,
      title: idea.title,
      description: idea.description,
      topic,
      time: Math.min(requested, maxScriptMinutes),
    };

    // Keep the full idea list in saved_ideas intact — never overwrite with a
    // partial "unused ideas" payload (that was dropping the generated idea).

    setGeneratedIdeaIds((prev) => new Set(prev).add(idea.id));
    setSidebarRefresh((n) => n + 1);
    try {
      window.dispatchEvent(new Event('studio-storage-updated'));
    } catch { /* ignore */ }

    setScriptGenError(null);
    setScriptGenReady(false);
    setIsGeneratingScript(true);

    try {
      // BFF returns redacted preview only; full script stays server-side until unlock
      const raw = await ApiService.generateScript(payload);
      const normalized = normalizeScriptData(raw);
      const universalId =
        raw.scriptRowId != null && String(raw.scriptRowId).trim()
          ? String(raw.scriptRowId)
          : null;
      if (!universalId) {
        throw new Error('Script was generated but could not be secured. Please try again.');
      }

      // Re-persist the full idea list so saved_ideas never loses the generated idea
      await persistNewIdeas(scriptIdeas, topicSummary, ideaSources, ideaBooks);

      setIdeaScripts((prev) => ({
        ...prev,
        [idea.id]: {
          data: { ...normalized, locked: true, scriptRowId: universalId },
          ideaTitle: idea.title,
          ideaDescription: idea.description,
          scriptRowId: universalId,
          universalScriptId: universalId,
        },
      }));
      setGeneratedIdeaIds((prev) => new Set(prev).add(idea.id));

      setActiveScriptData({ ...normalized, locked: true, scriptRowId: universalId });
      setActiveScriptIdeaTitle(idea.title);
      setActiveScriptIdeaDescription(idea.description || '');
      setActiveScriptTopic(topic);
      {
        const mins = Number(
          normalized.metrics?.videoLength ?? videoLengths[idea.id] ?? payload.time ?? 10,
        );
        setActiveScriptDuration(Number.isFinite(mins) && mins > 0 ? mins : 10);
      }
      setActiveScriptRowId(universalId);
      setActiveUniversalScriptId(universalId);
      setActiveScriptFromAssigned(false);
      setStudioTab('script', { ideaTitle: idea.title });
      setSidebarRefresh((n) => n + 1);
      try {
        window.dispatchEvent(new Event('studio-storage-updated'));
      } catch { /* ignore */ }
      setScriptGenReady(true);
    } catch (e: any) {
      console.error(e);
      setScriptGenError(e?.message || 'Failed to generate script. Please try again.');
      setScriptGenReady(true);
      setIsGeneratingScript(false);
      setGeneratedIdeaIds((prev) => {
        const next = new Set(prev);
        next.delete(idea.id);
        return next;
      });
    }
  };

  const handleVideoLengthChange = (id: number, value: string) => {
    // Allow empty while typing; clamp numeric values to plan max
    if (value.trim() === '') {
      setVideoLengths((prev) => ({ ...prev, [id]: '' }));
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      setVideoLengths((prev) => ({ ...prev, [id]: value }));
      return;
    }
    const clamped = Math.min(Math.max(1, n), maxScriptMinutes);
    setVideoLengths((prev) => ({ ...prev, [id]: String(clamped) }));
  };

  const stageCompleted = {
    ideas: scriptIdeas.length > 0,
    script: !!activeScriptData?.script,
    metadata: !!(activeScriptData?.youtube_metadata?.titles?.length || activeScriptData?.youtube_metadata?.descriptions?.length || activeScriptData?.youtube_metadata?.hashtags?.length),
    thumbnails: !!(
      activeScriptData?.youtube_metadata?.thumbnail_text?.length ||
      normalizeGeneratedThumbnailList(activeScriptData?.thumbnail_generated).length > 0
    ),
    broll: false,
    audio: false,
    'video-editing': false,
  };

  const selectIdeaScript = async (idea: ScriptIdea) => {
    const fromMap = ideaScripts[idea.id];
    const durationFromInput = Number(videoLengths[idea.id]);
    const resolveDuration = (metricsVideoLength?: number | null, fallback?: number) => {
      const fromMetrics = Number(metricsVideoLength);
      if (Number.isFinite(fromMetrics) && fromMetrics > 0) return fromMetrics;
      if (Number.isFinite(durationFromInput) && durationFromInput > 0) return durationFromInput;
      const fromFallback = Number(fallback);
      if (Number.isFinite(fromFallback) && fromFallback > 0) return fromFallback;
      return 10;
    };
    if (fromMap?.data) {
      const unlocked = !!fromMap.fromAssigned;
      const rowId = fromMap.scriptRowId ?? fromMap.universalScriptId ?? null;
      let scriptText = fromMap.data.script || '';
      const looksLikePlaceholder =
        !scriptText.trim() ||
        scriptText.includes('Unlock to view') ||
        scriptText.includes('continues here after unlock');

      if (!unlocked && looksLikePlaceholder && rowId) {
        try {
          const { data: { session } } = await sbClient.auth.getSession();
          if (session?.user?.id) {
            scriptText = await ApiService.fetchScriptPreview({
              id: String(rowId),
              userId: session.user.id,
            });
          }
        } catch { /* keep existing */ }
        if (!scriptText.trim()) {
          scriptText = lockedScriptPlaceholder(fromMap.data.structure);
        }
      }

      const data = unlocked
        ? fromMap.data
        : {
            ...fromMap.data,
            script: scriptText,
            locked: true,
            scriptsByLanguage: undefined,
            scriptRowId: rowId,
          };
      setActiveScriptData(data);
      setActiveScriptIdeaTitle(fromMap.ideaTitle);
      setActiveScriptIdeaDescription(fromMap.ideaDescription || idea.description || '');
      setActiveScriptTopic(topic);
      setActiveScriptRowId(rowId);
      setActiveUniversalScriptId(fromMap.universalScriptId ?? null);
      setActiveScriptFromAssigned(unlocked);
      setActiveScriptDuration(resolveDuration(fromMap.data.metrics?.videoLength));
      setStudioTab('script', { ideaTitle: fromMap.ideaTitle || idea.title });
    }
  };

  // Keep Sources/Books panel below the Content Ideas stage tabs
  useEffect(() => {
    if (!ideasRefPanel) return;
    const measure = () => {
      const el = document.getElementById('studio-stage-header');
      if (!el) {
        setIdeasPanelTopPx(208);
        return;
      }
      const bottom = Math.ceil(el.getBoundingClientRect().bottom);
      setIdeasPanelTopPx(Math.max(bottom, 120));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ideasRefPanel, studioTab]);

  return (
    <StudioShell
      activeTopic={
        isComposingNew || isComposePlaceholder || isScriptViewerMode
          ? undefined
          : topic
      }
      refreshKey={sidebarRefresh}
      padded={false}
      contentScroll={false}
      requireAuth={!isComposePlaceholder && !isComposingNew}
      topBar={
        studioTab === 'video-editing' ? (
          <div className="flex-1" />
        ) : (
          <div className="flex flex-col gap-1 flex-1 min-w-0 relative">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Describe your topic using at least 4 words for the best AI results."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (searchWarning) setSearchWarning(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleSearchSubmit();
                    }
                  }}
                  className="pl-10 pr-4 py-5 rounded-full border-gray-200 bg-white text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => { void handleSearchSubmit(); }}
                className="flex items-center gap-2 rounded-full bg-[#3d3d3a] hover:bg-[#1d1d1f] text-white text-sm font-semibold px-4 py-2.5 transition-colors flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Generate ideas</span>
                <span className="sm:hidden">Go</span>
              </button>
            </div>
            {searchWarning && (
              <div
                className="absolute left-0 right-0 top-full mt-2 z-50 sm:left-0 sm:right-auto sm:max-w-sm"
                role="alert"
              >
                <div className="relative bg-[#1d1d1f] text-white text-[12px] sm:text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
                  <div className="absolute -top-1.5 left-8 w-3 h-3 bg-[#1d1d1f] rotate-45" />
                  {searchWarning}
                </div>
              </div>
            )}
          </div>
        )
      }
    >
      <div className="flex flex-col h-full min-h-0">
        {isComposingNew || isComposePlaceholder ? (
          <>
            <div id="studio-stage-header" className="flex-shrink-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
              <div className={`max-w-8xl mx-auto px-4 sm:px-6 ${studioTab === 'video-editing' ? 'py-3' : 'pt-5 pb-4'}`}>
                {studioTab !== 'video-editing' && (
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-[0.14em] text-amber-600 uppercase mb-1">
                        {studioTab === 'audio' ? 'Audio' : ''}
                      </p>
                      <h1
                        className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-[#1d1d1f] leading-tight break-words tracking-tight"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                      >
                        {studioTab === 'broll'
                          ? 'B-ROLL VIDEOS'
                          : studioTab === 'audio'
                            ? 'TURN TEXT INTO SPEECH'
                            : 'START A NEW TOPIC'}
                      </h1>
                    </div>
                  </div>
                )}
                <StudioStageNav
                  active={studioTab}
                  onChange={setStudioTab}
                  disabled={{ ideas: ideasTabDisabled }}
                  completed={{
                    ideas: false,
                    script: false,
                    metadata: false,
                    thumbnails: false,
                    broll: false,
                    audio: false,
                    'video-editing': false,
                  }}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                {studioTab === 'ideas' ? (
                  <NewTopicPrompt onFocusSearch={() => searchInputRef.current?.focus()} />
                ) : studioTab === 'broll' ? (
                  <StudioBRollPanel />
                ) : studioTab === 'audio' ? (
                  <StudioAudioPanel
                    scriptText=""
                    isUnlocked={false}
                    freeform
                    scriptAudio={[]}
                    scriptRowId={null}
                    onSelectScript={() => {
                      router.push('/app/my-scripts?returnTab=audio');
                    }}
                    onGoToScript={() => {
                      setStudioTab('ideas');
                      searchInputRef.current?.focus();
                    }}
                  />
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl text-center py-14 px-6">
                    <p className="text-sm text-gray-500">
                      Search a topic first to get the content of this tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStudioTab('ideas');
                        searchInputRef.current?.focus();
                      }}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black"
                    >
                      <Search className="w-3.5 h-3.5" />
                      Search a topic
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        {/* Fixed topic + stage tabs */}
        <div id="studio-stage-header" className="flex-shrink-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
          <div className={`max-w-8xl mx-auto px-4 sm:px-6 ${studioTab === 'video-editing' ? 'py-3' : 'pt-5 pb-4'}`}>
            {studioTab !== 'video-editing' && (
              <div className="flex items-end gap-3 mb-4">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-[0.14em] text-amber-600 uppercase mb-1">
                    {isScriptViewerMode && !effectiveTopic ? 'Script' : 'Current topic'}
                  </p>
                  <h1
                    className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-[#1d1d1f] leading-tight break-words tracking-tight"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                  >
                    {isScriptViewerMode
                      ? (effectiveTopic || activeScriptIdeaTitle || 'Script')
                      : topic}
                  </h1>
                </div>
              </div>
            )}
            <StudioStageNav
              active={studioTab}
              onChange={setStudioTab}
              disabled={{ ideas: ideasTabDisabled }}
              completed={stageCompleted}
            />
          </div>
        </div>

        {/* Scrollable panel content only */}
        <div className={`flex-1 min-h-0 ${studioTab === 'video-editing' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {studioTab === 'video-editing' ? (
            <div className="h-full px-3 sm:px-4 py-2">
              <StudioVideoEditingPanel
                scriptText={
                  activeScriptFromAssigned
                    ? getScriptTextFromMap(
                        activeScriptData?.scriptsByLanguage ?? {},
                        activeScriptLanguage,
                      ) || activeScriptData?.script || ''
                    : ''
                }
                isUnlocked={activeScriptFromAssigned}
                ideaTitle={activeScriptIdeaTitle}
              />
            </div>
          ) : (
          <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {studioTab === 'ideas' && (
              <>
                {isLoading ? null : error && (
                  <ApiFailCard onRetry={() => window.location.reload()} />
                )}

                {!isLoading && !error && (
                  <>
                    {(topicSummary || ideaSources.length > 0 || ideaBooks.length > 0) && (
                      <div className="mb-5 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                        {topicSummary && (
                          <div className="mb-3">
                            <p className="text-[10px] font-bold tracking-[0.14em] text-amber-600 uppercase mb-1.5">
                              Topic summary
                            </p>
                            <p className="text-sm text-[#3d3d3a] leading-relaxed">
                              {topicSummary}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIdeasRefPanel('sources')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-[#f5f5f7] hover:bg-gray-200 px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            Sources
                            {ideaSources.length > 0 && (
                              <span className="text-[10px] text-[#6e6e73] font-medium">
                                ({ideaSources.length})
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIdeasRefPanel('books')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-[#f5f5f7] hover:bg-gray-200 px-3 py-1.5 text-xs font-semibold text-[#1d1d1f] transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Books
                            {ideaBooks.length > 0 && (
                              <span className="text-[10px] text-[#6e6e73] font-medium">
                                ({ideaBooks.length})
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                    {scriptIdeas.map((statement) => {
                      const generated = generatedIdeaIds.has(statement.id);
                      return (
                        <div
                          key={statement.id}
                          className={`relative flex flex-col h-full rounded-2xl border p-5 transition-all ${
                            generated
                              ? 'bg-[#eef4ff] border-[#1a3a6b] border-2 shadow-sm'
                              : 'bg-white border-gray-200 hover:shadow-md'
                          }`}
                        >
                          {generated && (
                            <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
                          <h3 className="text-base font-bold text-[#1d1d1f] leading-snug pr-8 mb-2">
                            {statement.title}
                          </h3>
                          <p className="text-sm text-[#6e6e73] leading-relaxed flex-1 min-h-0">
                            {statement.description}
                          </p>

                          <div className="mt-auto pt-5 flex flex-wrap items-end justify-between gap-3">
                            <div className="flex items-end">
                              {generated ? (
                                <button
                                  type="button"
                                  onClick={() => selectIdeaScript(statement)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-[#1d1d1f] hover:bg-gray-50"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View Script
                                </button>
                              ) : (
                                <span className="w-[1px]" aria-hidden />
                              )}
                            </div>
                            <div className="flex flex-wrap items-end gap-3 ml-auto">
                              <div>
                                <label className="block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">
                                  Length (min)
                                </label>
                                <Input
                                  type="number"
                                  placeholder={userTier.toLowerCase().includes('free') ? `1-${maxScriptMinutes}` : `1-${maxScriptMinutes}`}
                                  value={videoLengths[statement.id] || ''}
                                  onChange={(e) => handleVideoLengthChange(statement.id, e.target.value)}
                                  className="w-20 h-9 text-sm rounded-lg border-gray-200 bg-white text-center"
                                  min={1}
                                  max={maxScriptMinutes}
                                  title={`${userTier} plan: max ${maxScriptMinutes} min`}
                                />
                               
                              </div>
                              <button
                                type="button"
                                onClick={() => startScriptGeneration(statement)}
                                disabled={!videoLengths[statement.id]?.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Generate script
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </>
                )}

                {!isLoading && scriptIdeas.length === 0 && !error && (
                  <div className="bg-white border border-gray-200 rounded-2xl text-center py-14">
                    <p className="text-sm text-gray-500">No ideas yet for this topic.</p>
                  </div>
                )}

                {!isLoading && similarPastIdeas.length > 0 && (
                  <div className="mt-10">
                    <div className="flex items-center gap-2 mb-4">
                      <Link2 className="w-4 h-4 text-indigo-500" />
                      <h2 className="text-lg font-bold text-[#1d1d1f]">Related topic ideas</h2>
                    </div>
                    <div className="space-y-6">
                      {similarPastIdeas.map((pastTopic, groupIdx) => (
                        <div key={pastTopic.id}>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100">
                              <Globe className="w-3 h-3" />
                              {pastTopic.topic}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {Math.round(pastTopic.similarity * 100)}% match
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                            {pastTopic.ideas.map((idea, idx) => {
                              const ideaId = 10000 + groupIdx * 100 + idx;
                              const relatedIdea: ScriptIdea = {
                                id: ideaId,
                                title: idea.title,
                                description: idea.description,
                                category: pastTopic.topic,
                              };
                              const generated = generatedIdeaIds.has(ideaId);
                              return (
                                <div
                                  key={`${pastTopic.id}-${idx}`}
                                  className={`relative flex flex-col h-full rounded-2xl border p-5 ${
                                    generated
                                      ? 'bg-[#eef4ff] border-[#1a3a6b] border-2'
                                      : 'bg-white border-gray-200'
                                  }`}
                                >
                                  {generated && (
                                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  )}
                                  <h3 className="text-base font-bold text-[#1d1d1f] mb-2 pr-8">{idea.title}</h3>
                                  <p className="text-sm text-[#6e6e73] flex-1 min-h-0">{idea.description}</p>
                                  <div className="mt-auto pt-5 flex flex-wrap items-end justify-between gap-3">
                                    <div className="flex items-end">
                                      {generated ? (
                                        <button
                                          type="button"
                                          onClick={() => selectIdeaScript(relatedIdea)}
                                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-[#1d1d1f] hover:bg-gray-50"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          View
                                        </button>
                                      ) : (
                                        <span className="w-[1px]" aria-hidden />
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-end gap-3 ml-auto">
                                      <div>
                                        <label className="block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">
                                          Length (min)
                                        </label>
                                        <Input
                                          type="number"
                                          placeholder={`1-${maxScriptMinutes}`}
                                          value={videoLengths[ideaId] || ''}
                                          onChange={(e) => handleVideoLengthChange(ideaId, e.target.value)}
                                          className="w-20 h-9 text-sm rounded-lg border-gray-200 bg-white text-center"
                                          min={1}
                                          max={maxScriptMinutes}
                                          title={`${userTier} plan: max ${maxScriptMinutes} min`}
                                        />
                                        <p className="text-[9px] text-gray-400 mt-0.5 text-center">
                                          max {maxScriptMinutes}m
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => startScriptGeneration(relatedIdea)}
                                        disabled={!videoLengths[ideaId]?.trim()}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        Generate script
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {studioTab === 'script' && (
              scriptViewerLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <StudioScriptPanel
                  data={activeScriptData}
                  ideaTitle={activeScriptIdeaTitle}
                  ideaDescription={activeScriptIdeaDescription}
                  topic={activeScriptTopic || topic}
                  durationMinutes={activeScriptDuration}
                  universalScriptId={activeUniversalScriptId}
                  scriptRowId={activeScriptRowId}
                  initiallyUnlocked={activeScriptFromAssigned}
                  onUnlocked={({ assignedId, script } = {}) => {
                    setActiveScriptFromAssigned(true);
                    setActiveUniversalScriptId(null);
                    if (assignedId) setActiveScriptRowId(assignedId);
                    if (script) {
                      setActiveScriptData({ ...script, locked: false });
                    }
                  }}
                  onScriptDataChange={({ script, scriptsByLanguage, activeLanguage }) => {
                    setActiveScriptLanguage(activeLanguage || DEFAULT_SCRIPT_LANGUAGE);
                    setActiveScriptData((prev) =>
                      prev
                        ? { ...prev, script, scriptsByLanguage, locked: false }
                        : prev,
                    );
                  }}
                />
              )
            )}

            {studioTab === 'metadata' && (
              <StudioMetadataPanel data={activeScriptData} />
            )}

            {studioTab === 'thumbnails' && (
              <StudioThumbnailsPanel
                data={activeScriptData}
                ideaTitle={activeScriptIdeaTitle}
                ideaDescription={activeScriptIdeaDescription}
                topic={activeScriptTopic || topic}
                scriptRowId={activeScriptRowId}
                isUnlocked={activeScriptFromAssigned}
                fromAssigned={activeScriptFromAssigned}
                initialGeneratedThumbnail={
                  normalizeGeneratedThumbnail(activeScriptData?.thumbnail_generated)
                }
                onGoToScript={() => setStudioTab('script')}
              />
            )}

            {studioTab === 'broll' && <StudioBRollPanel />}

            {studioTab === 'audio' && (
              <StudioAudioPanel
                scriptText={
                  activeScriptFromAssigned
                    ? getScriptTextFromMap(
                        activeScriptData?.scriptsByLanguage ?? {},
                        activeScriptLanguage,
                      ) || activeScriptData?.script || ''
                    : ''
                }
                scriptsByLanguage={
                  activeScriptFromAssigned
                    ? activeScriptData?.scriptsByLanguage ?? null
                    : null
                }
                initialLanguage={activeScriptLanguage}
                isUnlocked={activeScriptFromAssigned}
                ideaTitle={activeScriptIdeaTitle}
                scriptAudio={activeScriptData?.script_audio ?? []}
                scriptRowId={activeScriptFromAssigned ? activeScriptRowId : null}
                scriptDurationMinutes={activeScriptDuration}
                onGoToScript={() => setStudioTab('script')}
                onSelectScript={() => {
                  router.push('/app/my-scripts?returnTab=audio');
                }}
                onScriptAudioChange={(urls) => {
                  setActiveScriptData((prev) =>
                    prev ? { ...prev, script_audio: urls } : prev,
                  );
                }}
                onLanguageChange={(lang, script) => {
                  setActiveScriptLanguage(lang);
                  setActiveScriptData((prev) =>
                    prev
                      ? { ...prev, script, locked: false }
                      : prev,
                  );
                }}
              />
            )}
          </div>
          )}
        </div>
          </>
        )}
      </div>

      {ideasRefPanel && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 bg-black/20"
          style={{ top: ideasPanelTopPx }}
          onClick={() => setIdeasRefPanel(null)}
          aria-hidden
        />
      )}

      <div
        className={`fixed right-0 bottom-0 w-full sm:w-[400px] bg-white border-l border-t border-gray-200 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          ideasRefPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ top: ideasPanelTopPx }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">
              {ideasRefPanel === 'books'
                ? `${ideaBooks.length} Book${ideaBooks.length === 1 ? '' : 's'}`
                : `${ideaSources.length} Source${ideaSources.length === 1 ? '' : 's'}`}
            </h2>
            <p className="text-[11px] text-[#6e6e73] font-light">
              {ideasRefPanel === 'books'
                ? 'Books referenced while researching this topic'
                : 'Research sources used to generate these ideas'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIdeasRefPanel(null)}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-[#1d1d1f]" />
          </button>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="px-4 py-4 space-y-3">
            {ideasRefPanel === 'sources' && (
              <>
                {ideaSources.length > 0 ? (
                  ideaSources.map((url, index) => {
                    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
                    let domain = '';
                    let domainInitial = '?';
                    try {
                      domain = new URL(href).hostname.replace('www.', '');
                      domainInitial = domain.charAt(0).toUpperCase();
                    } catch {
                      domain = url || 'Unknown source';
                      domainInitial = domain.charAt(0).toUpperCase();
                    }
                    return (
                      <a
                        key={`${url}-${index}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 bg-[#f5f5f7] hover:bg-gray-100 rounded-2xl p-4 transition-colors group border border-gray-100"
                      >
                        <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-[#1d1d1f] font-semibold text-sm flex-shrink-0 shadow-sm">
                          {domainInitial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-[#6e6e73] mb-0.5 font-light">{domain}</p>
                          <p className="text-xs font-medium text-[#1d1d1f] line-clamp-2 group-hover:text-blue-600 transition-colors break-all">
                            {url}
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            Visit source <ExternalLink className="w-3 h-3" />
                          </div>
                        </div>
                      </a>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#6e6e73]">No sources available</p>
                  </div>
                )}
              </>
            )}

            {ideasRefPanel === 'books' && (
              <>
                {ideaBooks.length > 0 ? (
                  ideaBooks.map((book, index) => (
                    <div
                      key={`${book.title}-${index}`}
                      className="flex items-start gap-3 bg-[#f5f5f7] rounded-2xl p-4 border border-gray-100"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <BookOpen className="w-4 h-4 text-[#1d1d1f]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1d1d1f] leading-snug">
                          {book.title || 'Untitled book'}
                        </p>
                        {book.author && (
                          <p className="text-xs text-[#6e6e73] font-light mt-0.5">
                            {book.author}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#6e6e73]">No books referenced</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <GenerationProgressOverlay
        isOpen={
          isLoading &&
          !isComposingNew &&
          !isComposePlaceholder &&
          !isScriptViewerMode &&
          !ideasTabDisabled
        }
        ready={fetchReady}
        onFinished={handleProgressFinished}
        subtext={`Usually under 5 minutes. We're analysing "${topic}" in the background.`}
      />

      <GenerationProgressOverlay
        isOpen={isGeneratingScript}
        ready={scriptGenReady}
        onFinished={handleScriptProgressFinished}
        steps={SCRIPT_GENERATION_STEPS}
        subtext="Usually under 5 minutes. We'll keep working in the background."
      />

      {scriptGenError && !isGeneratingScript && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-md w-[calc(100%-2rem)]">
          <div className="bg-white border border-red-200 shadow-lg rounded-2xl px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1d1d1f]">Script generation failed</p>
              <p className="text-xs text-[#6e6e73] mt-0.5 break-words">{scriptGenError}</p>
            </div>
            <button
              type="button"
              onClick={() => setScriptGenError(null)}
              className="text-xs font-semibold text-gray-500 hover:text-[#1d1d1f]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </StudioShell>
  );
}
