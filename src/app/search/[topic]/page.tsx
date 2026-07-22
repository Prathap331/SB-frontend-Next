'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Loader2, Search, Globe, Sparkles, Link2,
  Check, FileText, Menu, AlertCircle, ArrowLeft,
} from 'lucide-react';
import {
  Youtube,
  User2,
  Newspaper,
  X,
  Camera,
  Upload,
  ImageOff,
} from 'lucide-react';
import { ApiService, TSSResponse, ECIResponse, SimilarPastIdea, GeneratedScriptData } from '@/services/api';
import {
  MAX_IMAGE_SIZE, IMAGE_TYPES, THUMBNAIL_BUCKET, PHOTO_SLOTS, PhotoKey,
} from '@/lib/thumbnails';
import GenerationProgressOverlay from '@/components/GenerationProgressOverlay';
import { ApiFailCard } from '@/components/ApiFailCard';
import { supabase as sbClient } from '@/lib/supabaseClient';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';
import StudioSidebar, { type StudioSideView } from '@/components/studio/StudioSidebar';
import {
  StudioStageNav,
  StudioScriptPanel,
  StudioMetadataPanel,
  StudioThumbnailsPanel,
  StudioBRollPanel,
  ideaHook,
  type StudioTab,
} from '@/components/studio/StudioPanels';
import {
  upsertTopicIdeas,
  markIdeaPendingScript,
  markIdeaScriptGenerated,
  syncScriptsFromLegacyCache,
  getTopicRecord,
} from '@/lib/studio-storage';
import { normalizeScriptData } from '@/lib/script-data';
import { ProfileWorkspace, type ProfileTabId } from '@/app/profile/page';
import { ContentVaultPanel } from '@/app/content-vault/page';

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
const resultsCache = new Map<string, { scriptIdeas: ScriptIdea[]; similarPastIdeas: SimilarPastIdea[]; topicSummary: string | null; error: string | null; timestamp: number }>();
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
  error: string | null;
  timestamp: number;
}

interface PipelineCacheItem {
  data: TSSResponse;
  timestamp: number;
}

const getFromLocalStorage = (topic: string): CacheItem | null => {
  try {
    const item = localStorage.getItem(`topic_ideas_${topic}`);
    if (!item) return null;
    const parsed = JSON.parse(item) as CacheItem;
    if (Date.now() - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`topic_ideas_${topic}`);
      return null;
    }
    // Discard stale entries cached from failed API calls (old fallback/sample data)
    if (parsed.error || !parsed.scriptIdeas?.length) {
      localStorage.removeItem(`topic_ideas_${topic}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

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
  try {
    localStorage.setItem(`topic_ideas_${topic}`, JSON.stringify(data));
  } catch {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('topic_ideas_'));
    if (keys.length > 0) {
      localStorage.removeItem(keys[0]);
      try { localStorage.setItem(`topic_ideas_${topic}`, JSON.stringify(data)); } catch { /* ignore */ }
    }
  }
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
  k.startsWith('topic_ideas_') ||
  k.startsWith('topic_pipeline_') ||
  k.startsWith('topic_eci_') // ✅ ADD THIS
);
    topicKeys.forEach(key => {
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
  const params = useParams();
  const router = useRouter();
  const { searchPath } = useKeywordNavigation();
  // Read raw param and decode safely so UI shows spaces (not "%20")
  const rawTopic = Array.isArray(params?.topic) ? params.topic[0] : params?.topic ?? '';
  const topic = (() => {
    try {
      // decodeURIComponent is safe if the value contains percent-escapes like %20
      return decodeURIComponent(rawTopic);
    } catch {
      // If decoding fails (malformed percent-encoding), fall back to raw value
      return rawTopic;
    }
  })();



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
  const [isLoading, setIsLoading] = useState(true);
  const [fetchReady, setFetchReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [videoLengths, setVideoLengths] = useState<Record<number, string>>({});
  const [studioTab, setStudioTab] = useState<StudioTab>('ideas');
  const [generatedIdeaIds, setGeneratedIdeaIds] = useState<Set<number>>(new Set());
  const [activeScriptData, setActiveScriptData] = useState<GeneratedScriptData | null>(null);
  const [activeScriptIdeaTitle, setActiveScriptIdeaTitle] = useState<string>('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [scriptGenReady, setScriptGenReady] = useState(false);
  const [scriptGenError, setScriptGenError] = useState<string | null>(null);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sideView, setSideView] = useState<StudioSideView>(null);

  // Mobile suggested scripts from Supabase (same fields as desktop Content Vault sidebar)
  type MobileScriptRow = {
    id: string;
    title: string | null;
    script: string | null;
    topic: string | null;
    duration: number | null;
    category: string | null;
    subcategories: string[] | null;
  };
  const [mobileSuggested, setMobileSuggested] = useState<MobileScriptRow[]>([]);
  useEffect(() => {
    sbClient
      .from('scripts_universal')
      .select('id, title, script, topic, duration, category, subcategories')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setMobileSuggested(data as MobileScriptRow[]); });
  }, []);
  const [searchQuery, setSearchQuery] = useState(topic);
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

  const syncStudioFromIdeas = useCallback((
    ideas: ScriptIdea[],
    summary: string | null,
    relatedIdeas: SimilarPastIdea[],
  ) => {
    if (!topic || !ideas.length) return;
    upsertTopicIdeas({
      topic,
      ideas: ideas.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
      })),
      topicSummary: summary,
      similarPastIdeas: relatedIdeas,
    });
    syncScriptsFromLegacyCache(topic);
    const rec = getTopicRecord(topic);
    if (rec) {
      setGeneratedIdeaIds(new Set(rec.ideas.filter((i) => i.hasScript).map((i) => i.id)));
      const selected =
        (rec.selectedIdeaId != null && rec.scripts[String(rec.selectedIdeaId)]) ||
        Object.values(rec.scripts)[0];
      if (selected?.data) {
        setActiveScriptData(selected.data);
        setActiveScriptIdeaTitle(selected.ideaTitle);
      }
    }
    setSidebarRefresh((n) => n + 1);
    try {
      window.dispatchEvent(new Event('studio-storage-updated'));
    } catch { /* ignore */ }
  }, [topic]);

  useEffect(() => {
    setSearchQuery(topic);
    setStudioTab('ideas');
    setSideView(null);
    const rec = getTopicRecord(topic);
    if (rec) {
      setGeneratedIdeaIds(new Set(rec.ideas.filter((i) => i.hasScript).map((i) => i.id)));
      syncScriptsFromLegacyCache(topic);
      const synced = getTopicRecord(topic);
      const selected =
        (synced?.selectedIdeaId != null && synced.scripts[String(synced.selectedIdeaId)]) ||
        (synced ? Object.values(synced.scripts)[0] : undefined);
      if (selected?.data) {
        setActiveScriptData(selected.data);
        setActiveScriptIdeaTitle(selected.ideaTitle);
      } else {
        setActiveScriptData(null);
        setActiveScriptIdeaTitle('');
      }
    } else {
      setGeneratedIdeaIds(new Set());
      setActiveScriptData(null);
      setActiveScriptIdeaTitle('');
    }
  }, [topic]);

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!topic) return;

      setFetchReady(false);

      // 1. Memory cache hit
      const memCached = resultsCache.get(topic);
      if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION) {
        console.log('[script-ideas] memory cache hit:', topic);
        setScriptIdeas(memCached.scriptIdeas);
        setSimilarPastIdeas(memCached.similarPastIdeas);
        setTopicSummary(memCached.topicSummary);
        setError(memCached.error);
        if (!memCached.error && memCached.scriptIdeas.length) {
          syncStudioFromIdeas(memCached.scriptIdeas, memCached.topicSummary, memCached.similarPastIdeas ?? []);
        }
        finishLoading();
        return;
      }

      // 2. localStorage cache hit
      const lsCached = getFromLocalStorage(topic);
      if (lsCached) {
        console.log('[script-ideas] localStorage cache hit:', topic);
        resultsCache.set(topic, lsCached);
        setScriptIdeas(lsCached.scriptIdeas);
        setSimilarPastIdeas(lsCached.similarPastIdeas ?? []);
        setTopicSummary(lsCached.topicSummary ?? null);
        setError(lsCached.error);
        if (!lsCached.error && lsCached.scriptIdeas.length) {
          syncStudioFromIdeas(lsCached.scriptIdeas, lsCached.topicSummary ?? null, lsCached.similarPastIdeas ?? []);
        }
        finishLoading();
        return;
      }

      // 3. Another mount is already fetching — await its promise then read from cache.
      //    This is how React Strict Mode's second mount safely shares the first mount's request.
      if (inFlightIdeas.has(topic)) {
        await inFlightIdeas.get(topic);
        if (cancelled) return;
        const result = resultsCache.get(topic) ?? getFromLocalStorage(topic);
        if (result) {
          setScriptIdeas(result.scriptIdeas);
          setSimilarPastIdeas(result.similarPastIdeas ?? []);
          setTopicSummary(result.topicSummary ?? null);
          setError(result.error);
          finishLoading();
        }
        return;
      }

      // 4. This mount owns the fetch. Create a shared promise other mounts can await.
      let settleFetch!: () => void;
      inFlightIdeas.set(topic, new Promise<void>(res => { settleFetch = res; }));

      initialLoadStartRef.current = Date.now();
      setIsLoading(true);
      setFetchReady(false);
      setError(null);
      setScriptIdeas([]);
      setSimilarPastIdeas([]);

      const maxWaitMs = 300000;
      const retryDelayMs = 5000;

      const applyResult = (
        ideas: ScriptIdea[],
        err: string | null,
        summary: string | null = null,
        relatedIdeas: SimilarPastIdea[] = []
      ) => {
        // Only cache successful results — never persist errors/empty fallbacks
        if (!err) {
          saveToCache(topic, {
            scriptIdeas: ideas,
            similarPastIdeas: relatedIdeas,
            topicSummary: summary,
            error: err,
            timestamp: Date.now(),
          });
          syncStudioFromIdeas(ideas, summary, relatedIdeas);
        }

        inFlightIdeas.delete(topic);
        settleFetch();
      
        setScriptIdeas(ideas);
        setSimilarPastIdeas(relatedIdeas);
        setError(err);
        setTopicSummary(summary);
        finishLoading();
      };

      while (true) {
        try {
          const response = await ApiService.processTopic(topic);

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
  response.similar_past_ideas ?? []
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

    run();
    return () => { cancelled = true; };
  }, [topic, finishLoading, syncStudioFromIdeas]);

  const getCategoryFromIndex = (index: number) => {
    const categoryMap = ['Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'];
    return categoryMap[index % categoryMap.length];
  };


  // ── Face choice + thumbnail photo popups ──────────────────────────────────
  const [faceChoiceIdea, setFaceChoiceIdea] = useState<ScriptIdea | null>(null);
  const [showPhotoPopup, setShowPhotoPopup] = useState(false);
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [pFiles, setPFiles]       = useState<Partial<Record<PhotoKey, File>>>({});
  const [pPreviews, setPPreviews] = useState<Partial<Record<PhotoKey, string>>>({});
  const [pError, setPError]       = useState<string | null>(null);
  const [pSaving, setPSaving]     = useState(false);
  const photoInputRefs = useRef<Partial<Record<PhotoKey, HTMLInputElement | null>>>({});

  const openFaceChoice = (idea: ScriptIdea) => {
    if (!videoLengths[idea.id]) {
      console.warn('No length specified for this script');
      return;
    }
    setFaceChoiceIdea(idea);
    setShowPhotoPopup(false);
    setPError(null);
  };

  const closeFacePopups = () => {
    setFaceChoiceIdea(null);
    setShowPhotoPopup(false);
    setPError(null);
    Object.values(pPreviews).forEach(url => { if (url) URL.revokeObjectURL(url); });
    setPPreviews({});
    setPFiles({});
  };

  // User picked "With my photo" (true) or "Faceless channel" (false)
  const handleFaceChoice = async (isFace: boolean) => {
    if (!faceChoiceIdea) return;
    const idea = faceChoiceIdea;

    if (!isFace) {
      closeFacePopups();
      proceedGeneration(idea, false);
      return;
    }

    // With photo → make sure the user actually has photos in their profile
    setCheckingPhotos(true);
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) { router.push('/auth'); return; }
      const { data } = await sbClient
        .from('user_profiles')
        .select('thumbnail_images')
        .eq('id', session.user.id)
        .maybeSingle();
      const imgs = (data?.thumbnail_images ?? {}) as Record<string, string>;
      if (imgs.photo1 && imgs.photo2) {
        closeFacePopups();
        proceedGeneration(idea, true);
      } else {
        setShowPhotoPopup(true);
      }
    } catch {
      // Photo lookup failed — don't block generation
      closeFacePopups();
      proceedGeneration(idea, true);
    } finally {
      setCheckingPhotos(false);
    }
  };

  const handlePhotoSelect = (key: PhotoKey, file: File) => {
    setPError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setPError('Only JPG, PNG or WEBP images are accepted.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPError('Each image must be under 5 MB.');
      return;
    }
    setPPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!);
      return { ...prev, [key]: URL.createObjectURL(file) };
    });
    setPFiles(prev => ({ ...prev, [key]: file }));
  };

  const removePhoto = (key: PhotoKey) => {
    setPPreviews(prev => {
      if (prev[key]) URL.revokeObjectURL(prev[key]!);
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPFiles(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Upload the selected photos to the profile, then generate with isFace=true
  const handlePhotoUploadAndGenerate = async () => {
    const entries = Object.entries(pFiles) as [PhotoKey, File][];
    if (entries.length < PHOTO_SLOTS.length || !faceChoiceIdea) return;
    const idea = faceChoiceIdea;

    setPSaving(true);
    setPError(null);
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const uid = session.user.id;

      const thumbnailImages: Record<string, string> = { photo1: '', photo2: '' };
      for (const [key, file] of entries) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${uid}/${key}.${ext}`;
        const { error: upErr } = await sbClient.storage
          .from(THUMBNAIL_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw new Error(`Failed to upload "${key}" photo: ${upErr.message}`);
        const { data: pub } = sbClient.storage.from(THUMBNAIL_BUCKET).getPublicUrl(path);
        thumbnailImages[key] = `${pub.publicUrl}?v=${Date.now()}`;
      }

      const { error } = await sbClient.from('user_profiles').upsert(
        { id: uid, thumbnail_images: thumbnailImages, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) throw error;

      closeFacePopups();
      proceedGeneration(idea, true);
    } catch (e: any) {
      setPError(e?.message || 'Failed to upload photos. Please try again.');
    } finally {
      setPSaving(false);
    }
  };

  const proceedGeneration = async (idea: ScriptIdea, isFace: boolean) => {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }

    const payload = {
      userId: session.user.id,
      title: idea.title,
      description: idea.description,
      time: Number(videoLengths[idea.id] || 10),
      isFace,
    };

    const unusedIdeas = scriptIdeas
      .filter((i) => i.id !== idea.id)
      .map((i) => ({ title: i.title, description: i.description }));

    if (unusedIdeas.length > 0) {
      ApiService.sendUnusedIdeas({
        topic,
        topic_summary: topicSummary,
        ideas: unusedIdeas,
      });
    }

    markIdeaPendingScript(topic, {
      id: idea.id,
      title: idea.title,
      description: idea.description,
      category: idea.category,
      videoLength: videoLengths[idea.id],
    }, videoLengths[idea.id]);
    setGeneratedIdeaIds((prev) => new Set(prev).add(idea.id));
    setSidebarRefresh((n) => n + 1);
    try {
      window.dispatchEvent(new Event('studio-storage-updated'));
    } catch { /* ignore */ }

    try {
      sessionStorage.setItem(
        'pending_unused_idea',
        JSON.stringify({
          topic,
          topic_summary: topicSummary,
          ideas: [{ title: idea.title, description: idea.description }],
        }),
      );
      sessionStorage.setItem('studio_search_topic', topic);
      sessionStorage.setItem(
        'studio_selected_idea',
        JSON.stringify({
          id: idea.id,
          title: idea.title,
          description: idea.description,
          category: idea.category,
        }),
      );
    } catch (err) {
      console.error(err);
    }

    setScriptGenError(null);
    setScriptGenReady(false);
    setIsGeneratingScript(true);

    try {
      const raw = await ApiService.generateScript(payload);
      const normalized = normalizeScriptData(raw);
      markIdeaScriptGenerated(
        topic,
        {
          id: idea.id,
          title: idea.title,
          description: idea.description,
          category: idea.category,
          videoLength: videoLengths[idea.id],
        },
        normalized,
      );
      try {
        const safeKey = idea.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        localStorage.setItem(
          `script_${safeKey}`,
          JSON.stringify({
            data: normalized,
            params: payload,
            timestamp: Date.now(),
            pageTitle: idea.title,
          }),
        );
        localStorage.setItem('script_latest_key', `script_${safeKey}`);
      } catch { /* ignore */ }

      setActiveScriptData(normalized);
      setActiveScriptIdeaTitle(idea.title);
      setStudioTab('script');
      setSidebarRefresh((n) => n + 1);
      try {
        window.dispatchEvent(new Event('studio-storage-updated'));
      } catch { /* ignore */ }
      setScriptGenReady(true);
    } catch (e: any) {
      console.error(e);
      setScriptGenError(e?.message || 'Failed to generate script. Please try again.');
      setScriptGenReady(true);
    }
  };

  const handleVideoLengthChange = (id: number, value: string) => {
    setVideoLengths((prev) => ({ ...prev, [id]: value }));
  };

  const stageCompleted = {
    ideas: scriptIdeas.length > 0,
    script: !!activeScriptData?.script,
    metadata: !!(activeScriptData?.youtube_metadata?.titles?.length || activeScriptData?.youtube_metadata?.descriptions?.length || activeScriptData?.youtube_metadata?.hashtags?.length),
    thumbnails: !!(activeScriptData?.youtube_metadata?.thumbnail_text?.length),
    broll: false,
  };

  const selectIdeaScript = (idea: ScriptIdea) => {
    const rec = getTopicRecord(topic);
    const fromStudio = rec?.scripts[String(idea.id)];
    if (fromStudio?.data) {
      setActiveScriptData(fromStudio.data);
      setActiveScriptIdeaTitle(fromStudio.ideaTitle);
      setStudioTab('script');
      return;
    }
    try {
      const safeKey = idea.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const raw = localStorage.getItem(`script_${safeKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) {
          setActiveScriptData(parsed.data);
          setActiveScriptIdeaTitle(idea.title);
          setStudioTab('script');
        }
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f6f8] flex">
      <div className="hidden lg:flex h-full">
        <StudioSidebar
          activeTopic={topic}
          refreshKey={sidebarRefresh}
          activeView={sideView}
          onSelectView={setSideView}
        />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 h-full shadow-xl">
            <StudioSidebar
              activeTopic={topic}
              refreshKey={sidebarRefresh}
              activeView={sideView}
              onSelectView={(v) => {
                setSideView(v);
                setMobileNavOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="flex-shrink-0 border-b border-gray-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 max-w-5xl mx-auto">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search a topic (e.g. 'productivity for developers')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                className="pl-10 pr-4 py-5 rounded-full border-gray-200 bg-white text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="flex items-center gap-2 rounded-full bg-[#3d3d3a] hover:bg-[#1d1d1f] text-white text-sm font-semibold px-4 py-2.5 transition-colors flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate ideas</span>
              <span className="sm:hidden">Go</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {sideView ? (
              <div>
                <button
                  type="button"
                  onClick={() => setSideView(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#1d1d1f] mb-5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to topic
                </button>
                {sideView === 'content-vault' ? (
                  <ContentVaultPanel embedded />
                ) : (
                  <ProfileWorkspace
                    embedded
                    forcedTab={sideView as ProfileTabId}
                  />
                )}
              </div>
            ) : (
              <>
            <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Topic</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1d1d1f] mb-5 break-words">{topic}</h1>

            <div className="mb-6">
              <StudioStageNav
                active={studioTab}
                onChange={setStudioTab}
                completed={stageCompleted}
              />
            </div>

            {studioTab === 'ideas' && (
              <>
                {isLoading ? null : error && (
                  <ApiFailCard onRetry={() => window.location.reload()} />
                )}

                {!isLoading && !error && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scriptIdeas.map((statement) => {
                      const generated = generatedIdeaIds.has(statement.id);
                      const hook = ideaHook(statement.description);
                      return (
                        <div
                          key={statement.id}
                          className={`relative rounded-2xl border p-5 transition-all ${
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
                          <p className="text-sm text-[#6e6e73] leading-relaxed mb-3">
                            {statement.description}
                          </p>
                          
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">
                                Length (min)
                              </label>
                              <Input
                                type="number"
                                placeholder="8"
                                value={videoLengths[statement.id] || ''}
                                onChange={(e) => handleVideoLengthChange(statement.id, e.target.value)}
                                className="w-20 h-9 text-sm rounded-lg border-gray-200 bg-white text-center"
                                min={1}
                                max={60}
                              />
                            </div>
                            <div className="flex gap-2">
                              {generated && (
                                <button
                                  type="button"
                                  onClick={() => selectIdeaScript(statement)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-[#1d1d1f] hover:bg-gray-50"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openFaceChoice(statement)}
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                  className={`relative rounded-2xl border p-5 ${
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
                                  <p className="text-sm text-[#6e6e73] mb-4">{idea.description}</p>
                                  <div className="flex flex-wrap items-end justify-between gap-3">
                                    <div>
                                      <label className="block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">
                                        Length (min)
                                      </label>
                                      <Input
                                        type="number"
                                        placeholder="8"
                                        value={videoLengths[ideaId] || ''}
                                        onChange={(e) => handleVideoLengthChange(ideaId, e.target.value)}
                                        className="w-20 h-9 text-sm rounded-lg border-gray-200 bg-white text-center"
                                        min={1}
                                        max={60}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openFaceChoice(relatedIdea)}
                                      disabled={!videoLengths[ideaId]?.trim()}
                                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Generate script
                                    </button>
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
              <StudioScriptPanel
                data={activeScriptData}
                ideaTitle={activeScriptIdeaTitle}
              />
            )}

            {studioTab === 'metadata' && (
              <StudioMetadataPanel data={activeScriptData} />
            )}

            {studioTab === 'thumbnails' && (
              <StudioThumbnailsPanel data={activeScriptData} />
            )}

            {studioTab === 'broll' && <StudioBRollPanel />}
              </>
            )}
          </div>
        </div>
      </div>

      <GenerationProgressOverlay
        isOpen={isLoading}
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

      {/* ── Face choice popup ── */}
      {faceChoiceIdea && !showPhotoPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl shadow-black/20 border border-gray-200/80 p-6 sm:p-7 max-w-md w-full">
            <button
              type="button"
              onClick={closeFacePopups}
              aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-[#1d1d1f]" />
            </button>

            <h2 className="text-lg font-semibold text-[#1d1d1f] mb-1 pr-8">How should this video look?</h2>
            <p className="text-sm text-[#6e6e73] font-light mb-5">
              Tell us whether your face should appear in the thumbnails and presentation style.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* With user photo → isFace: true */}
              <button
                type="button"
                onClick={() => handleFaceChoice(true)}
                disabled={checkingPhotos}
                className="group rounded-2xl border-2 border-gray-200 hover:border-[#1d1d1f] hover:bg-[#f5f5f7]/60 p-5 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                  {checkingPhotos
                    ? <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                    : <Camera className="w-5 h-5 text-orange-500" />}
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f] mb-1">With my photo</p>
                <p className="text-[11px] text-[#6e6e73] leading-relaxed">
                  Uses your photos for click-worthy, face-driven thumbnails.
                </p>
              </button>

              {/* Faceless channel → isFace: false */}
              <button
                type="button"
                onClick={() => handleFaceChoice(false)}
                disabled={checkingPhotos}
                className="group rounded-2xl border-2 border-gray-200 hover:border-[#1d1d1f] hover:bg-[#f5f5f7]/60 p-5 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <ImageOff className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-sm font-semibold text-[#1d1d1f] mb-1">Faceless channel</p>
                <p className="text-[11px] text-[#6e6e73] leading-relaxed">
                  No face needed — thumbnails built from visuals, text and graphics only.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Thumbnail photo upload popup (no photos in profile yet) ── */}
      {faceChoiceIdea && showPhotoPopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-3xl shadow-2xl shadow-black/20 border border-gray-200/80 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={closeFacePopups}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-[#1d1d1f]" />
              </button>
              <h2 className="text-lg font-semibold text-[#1d1d1f] mb-1 pr-8">Your photos</h2>
              <p className="text-sm text-[#6e6e73] font-light">
                You haven&apos;t added any photos yet. Upload 2 HD photos of yourself for AI thumbnails.
              </p>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {PHOTO_SLOTS.map(({ key, label }) => {
                  const preview = pPreviews[key];
                  return (
                    <div key={key}>
                      <input
                        ref={el => { photoInputRefs.current[key] = el; }}
                        type="file"
                        accept={IMAGE_TYPES.join(',')}
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoSelect(key, file);
                          e.target.value = '';
                        }}
                      />
                      {preview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-green-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt={label} className="w-full aspect-square object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                            <span className="text-[10px] font-semibold text-white">{label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhoto(key)}
                            disabled={pSaving}
                            aria-label={`Remove ${label}`}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 hover:bg-black/75 flex items-center justify-center transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => photoInputRefs.current[key]?.click()}
                          disabled={pSaving}
                          className="w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-[#f5f5f7]/60 flex flex-col items-center justify-center gap-1.5 transition-all disabled:opacity-60"
                        >
                          <Camera className="w-5 h-5 text-[#6e6e73]" />
                          <span className="text-[11px] font-medium text-[#1d1d1f]">{label}</span>
                          <span className="flex items-center gap-1 text-[9px] text-[#6e6e73]">
                            <Upload className="w-2.5 h-2.5" /> Add photo
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-[#6e6e73]">JPG, PNG or WEBP · max 5 MB each · both photos required · clear, high-quality photos of your face work best</p>

              {pError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{pError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-[#fafafa] flex-shrink-0 space-y-2">
              <button
                type="button"
                onClick={handlePhotoUploadAndGenerate}
                disabled={Object.keys(pFiles).length < PHOTO_SLOTS.length || pSaving}
                className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
                  : <><Sparkles className="w-4 h-4 text-orange-400" />Upload & Generate Content</>}
              </button>
              <button
                type="button"
                onClick={() => { setShowPhotoPopup(false); setPError(null); }}
                disabled={pSaving}
                className="w-full py-1.5 text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                ← Back to options
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
