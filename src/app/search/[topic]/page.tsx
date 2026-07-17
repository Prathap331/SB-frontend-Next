'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Clock, TrendingUp, TrendingDown, Search, Activity, Flame, Radio, Shield, Layers, Rocket, Target, BarChart3, Zap, Globe, Eye, Trophy, Lightbulb, Sparkles, ChevronRight, Filter, ArrowUpRight, Link2 } from 'lucide-react';
import {
  Youtube,
  User2,
  Newspaper,
  X,
  Camera,
  Upload,
  ImageOff,
} from 'lucide-react';
import { ApiService, TSSResponse, ECIResponse, SimilarPastIdea } from '@/services/api';
import {
  MAX_IMAGE_SIZE, IMAGE_TYPES, THUMBNAIL_BUCKET, EXPRESSIONS, ExpressionKey,
} from '@/lib/thumbnails';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import ECIExactReplica from '@/components/ECIExactReplica';
import SuggestedTopicsSidebar from '@/components/SuggestedTopicsSidebar';
import GenerationProgressOverlay from '@/components/GenerationProgressOverlay';
import { supabase as sbClient } from '@/lib/supabaseClient';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';

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
  const { searchPath, landingPath } = useKeywordNavigation();
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

  useEffect(() => {
    setSearchQuery(topic);
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
        const cacheData = {
          scriptIdeas: ideas,
          similarPastIdeas: relatedIdeas,
          topicSummary: summary,
          error: err,
          timestamp: Date.now(),
        };
      
        saveToCache(topic, cacheData);
      
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

          const fallbackIdeas: ScriptIdea[] = [
            { id: 1, title: `Understanding ${topic}: A Comprehensive Analysis`, description: `Dive deep into ${topic} and explore its aspects, implications, and real-world applications.`, category: 'Technology' },
            { id: 2, title: `The Impact of ${topic} on Modern Society`, description: `Explore how ${topic} is shaping our world today and what it means for the future.`, category: 'Social Impact' },
            { id: 3, title: `Future Trends: Where ${topic} is Heading`, description: `Discover what experts predict will happen next with ${topic}.`, category: 'Future Analysis' },
          ];

          const errorMessage = message.includes('timeout')
            ? 'API request timed out. Using sample data.'
            : message.includes('502')
            ? 'Server temporarily unavailable. Using sample data.'
            : 'API temporarily unavailable. Using sample data.';

          applyResult(fallbackIdeas, errorMessage);
          return;
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [topic, finishLoading]);

  const getCategoryFromIndex = (index: number) => {
    const categoryMap = ['Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'];
    return categoryMap[index % categoryMap.length];
  };


  // ── Face choice + thumbnail photo popups ──────────────────────────────────
  const [faceChoiceIdea, setFaceChoiceIdea] = useState<ScriptIdea | null>(null);
  const [showPhotoPopup, setShowPhotoPopup] = useState(false);
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [pFiles, setPFiles]       = useState<Partial<Record<ExpressionKey, File>>>({});
  const [pPreviews, setPPreviews] = useState<Partial<Record<ExpressionKey, string>>>({});
  const [pError, setPError]       = useState<string | null>(null);
  const [pSaving, setPSaving]     = useState(false);
  const photoInputRefs = useRef<Partial<Record<ExpressionKey, HTMLInputElement | null>>>({});

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
      if (Object.keys(imgs).length > 0) {
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

  const handlePhotoSelect = (key: ExpressionKey, file: File) => {
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

  const removePhoto = (key: ExpressionKey) => {
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
    const entries = Object.entries(pFiles) as [ExpressionKey, File][];
    if (entries.length === 0 || !faceChoiceIdea) return;
    const idea = faceChoiceIdea;

    setPSaving(true);
    setPError(null);
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const uid = session.user.id;

      const thumbnailImages: Record<string, string> = {};
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
    const payload = {
      topic: idea.title,
      // userId: user?.id || "",
  
      duration_minutes: Number(videoLengths[idea.id] || 10),

      isFace,
  
      context: {
        topic: idea.title,
  
        selected_idea_id: String(idea.id),
  
        selected_angle_id: String(idea.id),
  
        selected_idea: idea,
  
        gap_context: {},
  
        db_context: "",
  
        web_context: "",
  
        social_data: [],
  
        news_data: [],
  
        tss_scores: tssData || {},
  
        csi_scores: eciData || {},
  
        csi_quality: {},
  
        pipeline_assembled_at: new Date().toISOString(),
  
        seo_output: {},
      },
    };
  
    // All ideas except the one the user selected are "unused" → send to backend.
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

    // Stash the selected idea so the script page can report it as unused
    // if the user leaves without unlocking the generated script.
    try {
      sessionStorage.setItem(
        "pending_unused_idea",
        JSON.stringify({
          topic,
          topic_summary: topicSummary,
          ideas: [{ title: idea.title, description: idea.description }],
        })
      );
    } catch (err) {
      console.error(err);
    }

    try {
      sessionStorage.setItem(
        "generate_params",
        JSON.stringify(payload)
      );
    } catch (err) {
      console.error(err);
    }
  
    router.push(`/script/${encodeURIComponent(idea.title)}`);
  };

  const handleVideoLengthChange = (id: number, value: string) => {
    setVideoLengths((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen bg-[#E9EBF0]/20">
      <Header />

      

      {/* ── Page-level flex: main content | desktop sidebar ── */}
  <div className="flex w-full items-start gap-0">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0">


          
      {/* Search Section */}
      <div className="container  mx-auto px-4 lg:px-8  py-6 sm:py-4">
        <div className="w-full shadow-lg border border-gray-400 rounded-full">
          <div className="relative flex items-center rounded-full">
                 <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 z-10" />
                 <Input
                   type="text"
                   placeholder="Search for topics, current events, and documentary ideas"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault();
                       handleSearchSubmit();
                     }
                   }}
                   className="pl-10 sm:pl-12 md:pl-14 pr-20 sm:pr-24 md:pr-32 py-4 sm:py-5 md:py-7 text-xs sm:text-sm md:text-lg rounded-full border-0 bg-white text-black placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-400 font-sans w-full"
                 />
                 <button
                   onClick={handleSearchSubmit}
                   className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 rounded-full bg-black text-white hover:bg-gray-800 hover:shadow-xl hover:scale-105 px-3 sm:px-4 md:px-6 py-2 sm:py-1.5 md:py-2 text-xs sm:text-sm md:text-lg font-medium font-sans transition-all duration-300 ease-in-out"
                 >
                   <span className="hidden sm:inline">Generate Ideas</span>
                   <span className="sm:hidden">Generate</span>
                 </button>
          </div>
        </div>
      </div>

      {/* Topic Summary */}
{topicSummary && (
  <div className="container mx-auto px-4 lg:px-8 pb-2">
     <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex flex-col gap-3 items-start shadow-sm">
      <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Globe className="w-3.5 h-3.5 text-indigo-500" />
      </div>
      <p className="text-lg text-[#3d3d3a] font-semibold leading-relaxed">Topic Summary</p>
      </div>


      <p className="text-md text-[#3d3d3a] font-[500] leading-relaxed">{topicSummary}</p>
    </div>
  </div>
)}

{/* <div className="container mx-auto px-4 lg:px-8 pb-2">
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 flex flex-col gap-3 items-start shadow-sm">
      <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Globe className="w-3.5 h-3.5 text-indigo-500" />
      </div>
      <p className="text-lg text-[#3d3d3a] font-semibold leading-relaxed">Topic Summary</p>
      </div>


      <p className="text-md text-[#3d3d3a] font-[500] leading-relaxed">We trace the money trail behind the Ketan Agarwal murder—insurance policies, debt write-offs, business takeovers—to expose the person who gained the most from his death. This financial forensics investigation reveals a suspect hidden in plain sight, completely overlooked by mainstream coverage.</p>
    </div>
  </div> */}

{/*       
      <section className="container  mx-auto px-4 lg:px-8 py-6 sm:py-4">
        <Card className="shadow-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          <CardHeader className="pb-3 px-2 sm:px-8">
            <div className="overflow-x-auto scrollbar-none">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mt-4 w-fit max-w-full flex-wrap sm:flex-nowrap">
                {([
                  { key: 'tss' as const, label: 'Trend Strength Score',          icon: TrendingUp },
                  { key: 'eci' as const, label: 'Evergreen Content Intelligence', icon: Activity   },
                ]).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                      activeTab === key ? 'bg-white text-[#1d1d1f] shadow-sm font-semibold' : 'text-gray-500 hover:text-[#1d1d1f]'
                    }`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="overflow-y-auto pb-6 px-2 sm:px-8">

           
            {activeTab === 'tss' && isTssLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-[#1d1d1f]" />
                <p className="text-sm text-[#6e6e73] font-light">Fetching trend signals…</p>
              </div>
            )}

{activeTab === 'tss' && !isTssLoading && tssData && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {mapTssToCards(tssData).map((card, i) => (
      <TSSCard key={i} {...card} />
    ))}
  </div>
)}

            {activeTab === 'tss' && !isTssLoading && !tssData && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
                <Activity className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-[#6e6e73]">No trend data available for this topic yet.</p>
              </div>
            )}

        
            {activeTab === 'eci' && eciData && (
  <ECIExactReplica data={eciData} />
)}

            {activeTab === 'eci' && !isEciLoading && !eciData && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
                <Sparkles className="w-8 h-8 text-gray-300" />
                <p className="text-sm text-[#6e6e73]">No evergreen data available for this topic yet.</p>
              </div>
            )}

          </CardContent>
        </Card>
      </section> */}
  





      {/* ── Content Ideas Section ── */}
      <div className="container  px-4 lg:px-8 py-8 sm:py-12">
      <div className="bg-gray-100 rounded-3xl relative">
          {/* Header — full width, sticky */}
          <div className="sticky top-14 z-10 bg-white border border-gray-200/80 rounded-3xl shadow-sm px-8 py-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
              <div className='flex gap-4'>

              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-orange-500" />
              </div>
              <div className='sm:hidden'>
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-0.5">AI-generated</p>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] leading-tight flex flex-wrap items-center gap-2">
                  Content Ideas
                </h2>
              </div>
              </div>


              <div className="min-w-0">
                <p className="hidden  sm:block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-0.5">AI-generated</p>
                <h2 className="hidden sm:block text-xl sm:text-2xl font-bold text-[#1d1d1f] leading-tight flex flex-wrap items-center gap-2">
                  Content Ideas
                </h2>

                  <span className="inline-flex items-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-semibold px-3 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    {topic}
                  </span>

                
                <p className="text-sm text-[#6e6e73] mt-1">Choose a perspective and generate a full youtube content in seconds</p>
              </div>
            </div>
            {!isLoading && (
              <div className="flex-shrink-0 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 bg-[#f5f5f7] text-[#6e6e73] text-xs font-medium px-3 py-1.5 rounded-full">
                  <Filter className="w-3 h-3" />
                  {scriptIdeas.length} idea{scriptIdeas.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Ideas list */}
          <div className="px-4 pb-8">
            <div className="flex-1 min-w-0">

              {isLoading ? null : error && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mb-6 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4.5 h-4.5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-700 mb-1">API Temporarily Unavailable</p>
                    <p className="text-sm text-red-600 mb-3">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

    
              {!isLoading && (
                <div className="space-y-4">
                  {scriptIdeas.map((statement, idx) => (
                    <div
                      key={statement.id}
                      className="bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                    >
                      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-black text-orange-500">{String(idx + 1).padStart(2, '0')}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="inline-flex items-center gap-1 bg-[#f5f5f7] text-[#6e6e73] text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase">
                                {statement.category}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                <TrendingUp className="w-2.5 h-2.5" />
                                Trending
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-[#1d1d1f] leading-snug">{statement.title}</h3>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed sm:pl-12  ">{statement.description}</p>
                      </div>
                      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-[#fafafa]">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Clock className="w-3.5 h-3.5 text-[#6e6e73]" />
                          <label className="text-xs font-medium text-[#6e6e73]">Length (min)</label>
                          <Input
                            type="number"
                            placeholder="10"
                            value={videoLengths[statement.id] || ''}
                            onChange={(e) => handleVideoLengthChange(statement.id, e.target.value)}
                            className="w-16 h-7 text-xs rounded-lg border-gray-200 bg-white text-center"
                            min={1}
                            max={60}
                          />
                        </div>
                        <div className="sm:ml-auto">
                          <button
                            onClick={() => openFaceChoice(statement)}
                            disabled={!videoLengths[statement.id]?.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                            Generate Content
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {scriptIdeas.length === 0 && (
                    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm text-center py-14">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                          <Filter className="w-5 h-5 text-[#6e6e73]" />
                        </div>
                        <p className="text-sm text-[#6e6e73]">No ideas match this category</p>
                        <button className="text-xs font-semibold text-[#1d1d1f] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-[#f5f5f7] transition-colors">
                          Show all
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            

            

          </div>
        </div>
      </div>

      {/* ── Related Topic Ideas Section ── */}
      {(isLoading || similarPastIdeas.length > 0) && (
        <div className="container px-4 lg:px-8 pb-8 sm:pb-12">
          <div className="bg-gray-100 rounded-3xl relative">
            <div className="sticky top-14 z-10 bg-white border border-gray-200/80 rounded-3xl shadow-sm px-8 py-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">

                <div className='flex gap-4'>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-6 h-6 text-indigo-500" />
                </div>

                <div className='sm:hidden'>
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-0.5">From past searches</p>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] leading-tight flex flex-wrap items-center gap-2">
                    Related Topic Ideas
                  </h2>
                </div>
</div>


                <div className="min-w-0">
                  <p className="hidden sm:block text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-0.5">From past searches</p>
                  <h2 className="hidden sm:block text-xl sm:text-2xl font-bold text-[#1d1d1f] leading-tight flex flex-wrap items-center gap-2">
                    Related Topic Ideas
                  </h2>
                    <span className="inline-flex items-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-semibold px-3 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      {topic}
                    </span>
                  <p className="text-sm text-[#6e6e73] mt-1">Ideas from similar topics you&apos;ve explored before</p>
                </div>
              </div>
              {!isLoading && (
                <div className="flex-shrink-0 self-start sm:self-center">
                  <span className="inline-flex items-center gap-1.5 bg-[#f5f5f7] text-[#6e6e73] text-xs font-medium px-3 py-1.5 rounded-full">
                    <Filter className="w-3 h-3" />
                    {similarPastIdeas.reduce((sum, g) => sum + g.ideas.length, 0)} idea{similarPastIdeas.reduce((sum, g) => sum + g.ideas.length, 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 pb-8">
              {!isLoading && (
                <div className="space-y-8">
                  {similarPastIdeas.map((pastTopic, groupIdx) => (
                    <div key={pastTopic.id}>
                      <div className="flex flex-wrap items-center gap-3 mb-4 px-2">
                        <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-100">
                          <Globe className="w-3 h-3" />
                          {pastTopic.topic}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-[#f5f5f7] text-[#6e6e73] text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          {Math.round(pastTopic.similarity * 100)}% match
                        </span>
                      </div>

                      <div className="space-y-4">
                        {pastTopic.ideas.map((idea, idx) => {
                          const ideaId = 10000 + groupIdx * 100 + idx;
                          const relatedIdea: ScriptIdea = {
                            id: ideaId,
                            title: idea.title,
                            description: idea.description,
                            category: pastTopic.topic,
                          };

                          return (
                            <div
                              key={`${pastTopic.id}-${idx}`}
                              className="bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                            >
                              <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                                <div className="flex flex-col sm:flex-row items-start gap-4">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-black text-indigo-500">{String(idx + 1).padStart(2, '0')}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full uppercase">
                                        Related
                                      </span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-bold text-[#1d1d1f] leading-snug">{idea.title}</h3>
                                  </div>
                                </div>
                                <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed sm:pl-12">{idea.description}</p>
                              </div>
                              <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-[#fafafa]">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-[#6e6e73]" />
                                  <label className="text-xs font-medium text-[#6e6e73]">Length (min)</label>
                                  <Input
                                    type="number"
                                    placeholder="10"
                                    value={videoLengths[ideaId] || ''}
                                    onChange={(e) => handleVideoLengthChange(ideaId, e.target.value)}
                                    className="w-16 h-7 text-xs rounded-lg border-gray-200 bg-white text-center"
                                    min={1}
                                    max={60}
                                  />
                                </div>
                                <div className="sm:ml-auto">
                                  <button
                                    onClick={() => openFaceChoice(relatedIdea)}
                                    disabled={!videoLengths[ideaId]?.trim()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                    Generate Content
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
              )}
            </div>
          </div>
        </div>
      )}



        {/* ── Mobile: horizontal suggested scripts slider (lg+ hidden) ── */}
        <div className="lg:hidden px-4 sm:px-6 py-6 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] font-semibold tracking-widest text-[#6e6e73] uppercase">
              Content Vault
            </p>
            <button
              onClick={() => router.push(landingPath('/content-vault'))}
              className="flex items-center gap-1 text-[10px] font-medium text-[#1d1d1f] bg-white border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded-full transition-all"
            >
              View all <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {mobileSuggested.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/script?scriptId=${s.id}`)}
                className="group flex-shrink-0 w-52 text-left bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150"
              >
                <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-1.5 line-clamp-2 group-hover:text-black">
                  {s.title || s.topic || 'Untitled Script'}
                </p>
                <p className="text-[10px] text-[#6e6e73] font-light leading-relaxed line-clamp-2 mb-2">
                  {s.script ? s.script.slice(0, 120).replace(/\*+/g, '').trim() + '…' : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {s.duration != null && s.duration > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                      <Clock className="w-2.5 h-2.5" />
                      {s.duration} min
                    </span>
                  )}
                  {s.category && (
                    <span className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] border border-gray-200 px-1.5 py-0.5 rounded-full">
                      {s.category}
                    </span>
                  )}
                  {(s.subcategories ?? []).slice(0, 2).map(sub => (
                    <span
                      key={sub}
                      className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] border border-gray-200 px-1.5 py-0.5 rounded-full"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        


        </div>{/* end main content */}

        {/* ── Desktop sidebar: sticky for the whole page ── */}
        <aside className="hidden lg:block flex-shrink-0 w-80 self-start sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto pt-6 pr-4 pb-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <SuggestedTopicsSidebar />
        </aside>

      </div>{/* end page-level flex */}

      <GenerationProgressOverlay
        isOpen={isLoading}
        ready={fetchReady}
        onFinished={handleProgressFinished}
        subtext={`Usually under 5 minutes. We're analysing "${topic}" in the background.`}
      />

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
              Tell us whether your face should appear in the video&apos;s thumbnails and presentation style.
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
                  Uses your expression photos for click-worthy, face-driven thumbnails.
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
              <h2 className="text-lg font-semibold text-[#1d1d1f] mb-1 pr-8">Thumbnail photos</h2>
              <p className="text-sm text-[#6e6e73] font-light">
                You haven&apos;t added any photos yet. Upload photos of yourself with different expressions for AI thumbnails.
              </p>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EXPRESSIONS.map(({ key, label, emoji }) => {
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
                          <img src={preview} alt={`${label} expression`} className="w-full aspect-square object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 flex items-center gap-1">
                            <span className="text-xs">{emoji}</span>
                            <span className="text-[10px] font-semibold text-white">{label}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhoto(key)}
                            disabled={pSaving}
                            aria-label={`Remove ${label} photo`}
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
                          <span className="text-xl leading-none">{emoji}</span>
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

              <p className="text-[11px] text-[#6e6e73]">JPG, PNG or WEBP · max 5 MB each · at least one photo required</p>

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
                disabled={Object.keys(pFiles).length === 0 || pSaving}
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

        <Footer />
    </div>
  );
}
