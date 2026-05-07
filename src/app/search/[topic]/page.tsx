'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Clock, TrendingUp, TrendingDown, Search, Activity, Flame, Radio, Shield, Layers, Rocket, Target, BarChart3, Zap, Globe, Eye, Trophy, Lightbulb, Sparkles, ChevronRight, Filter } from 'lucide-react';
import {
  Youtube,
  User2,
  Newspaper,
} from 'lucide-react';
import { ApiService, TSSResponse, ECIResponse } from '@/services/api';
import { ScriptGenerationModal, ScriptGenerationParams } from '@/components/ScriptGenerationModal';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import ECIExactReplica from '@/components/ECIExactReplica';
import SuggestedTopicsSidebar from '@/components/SuggestedTopicsSidebar';

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
const resultsCache = new Map<string, { scriptIdeas: ScriptIdea[]; error: string | null; timestamp: number }>();
const pipelineCache = new Map<string, { data: TSSResponse; timestamp: number }>();
const eciCache     = new Map<string, { data: ECIResponse;  timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Shared-promise deduplicator: both Strict-Mode mounts share one fetch promise.
// The second mount awaits the same promise, then reads from cache.
const inFlightIdeas    = new Map<string, Promise<void>>();
const inFlightPipeline = new Set<string>();

interface CacheItem {
  scriptIdeas: ScriptIdea[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [videoLengths, setVideoLengths] = useState<Record<number, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ScriptIdea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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


  const handleModalSubmit = async (params: ScriptGenerationParams) => {
    // Save generation params and navigate to /script where the fetch will be performed
    setIsGenerating(true);
    try {
      const payload = {
        ...params,
        ideaTitle: selectedIdea?.title,
        ideaDescription: selectedIdea?.description,
        length: videoLengths[selectedIdea?.id || 0] || '10',
      };

      // Use sessionStorage so it's short-lived and per-tab
      try {
        sessionStorage.setItem('generate_params', JSON.stringify(payload));
      } catch {
        console.warn('Failed to persist generate params to sessionStorage');
      }

      // Close modal and navigate to the script page which will perform the API call and show loader
      setIsModalOpen(false);
      router.push('/script');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    cleanupCache();
  }, []);

  // Fetch TSS — cached per topic
  useEffect(() => {
    if (!topic) return;
    const mem = pipelineCache.get(topic);
    if (mem && Date.now() - mem.timestamp < CACHE_DURATION) { setTssData(mem.data); return; }
    const ls = getPipelineFromLocalStorage(topic);
    if (ls) { pipelineCache.set(topic, ls); setTssData(ls.data); return; }
    if (inFlightPipeline.has(topic)) return;
    inFlightPipeline.add(topic);
    setIsTssLoading(true);
    setTssData(null);
    ApiService.pipelineMetrics(topic)
    .then(data => {
      console.log("🔥 TSS API RESPONSE:", data); // ✅ HERE
      savePipelineToCache(topic, data);
      setTssData(data);
    })
      .catch(err => console.error('[tss]', err))
      .finally(() => { setIsTssLoading(false); inFlightPipeline.delete(topic); });
  }, [topic]);

  // Fetch ECI — lazy: only when ECI tab is first activated
  useEffect(() => {
    if (!topic || activeTab !== 'eci') return;
  
    // ✅ 1. Memory cache
    const mem = eciCache.get(topic);
    if (mem && Date.now() - mem.timestamp < CACHE_DURATION) {
      console.log("⚡ ECI memory cache hit");
      setEciData(mem.data);
      return;
    }
  
    // ✅ 2. localStorage cache
    const ls = getECIFromLocalStorage(topic);
    if (ls) {
      console.log("💾 ECI localStorage cache hit");
      eciCache.set(topic, ls);
      setEciData(ls.data);
      return;
    }
  
    // ❌ No cache → fetch
    setIsEciLoading(true);
    setEciData(null);
  
    ApiService.eci(topic)
      .then((data) => {
        console.log("🔥 ECI API RESPONSE:", data);
  
        // ✅ SAVE HERE
        saveECIToCache(topic, data);
  
        setEciData(data);
      })
      .catch((err) => console.error('[eci]', err))
      .finally(() => setIsEciLoading(false));
  }, [topic, activeTab]);

  useEffect(() => {
    setSearchQuery(topic);
  }, [topic]);

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/search/${encodeURIComponent(trimmed)}`);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!topic) return;

      // 1. Memory cache hit
      const memCached = resultsCache.get(topic);
      if (memCached && Date.now() - memCached.timestamp < CACHE_DURATION) {
        console.log('[script-ideas] memory cache hit:', topic);
        setScriptIdeas(memCached.scriptIdeas);
        setError(memCached.error);
        setIsLoading(false);
        return;
      }

      // 2. localStorage cache hit
      const lsCached = getFromLocalStorage(topic);
      if (lsCached) {
        console.log('[script-ideas] localStorage cache hit:', topic);
        resultsCache.set(topic, lsCached);
        setScriptIdeas(lsCached.scriptIdeas);
        setError(lsCached.error);
        setIsLoading(false);
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
          setError(result.error);
          setIsLoading(false);
        }
        return;
      }

      // 4. This mount owns the fetch. Create a shared promise other mounts can await.
      let settleFetch!: () => void;
      inFlightIdeas.set(topic, new Promise<void>(res => { settleFetch = res; }));

      initialLoadStartRef.current = Date.now();
      setIsLoading(true);
      setError(null);
      setScriptIdeas([]);

      const maxWaitMs = 300000;
      const retryDelayMs = 5000;

      const applyResult = (ideas: ScriptIdea[], err: string | null) => {
        const cacheData = { scriptIdeas: ideas, error: err, timestamp: Date.now() };
        saveToCache(topic, cacheData);
        inFlightIdeas.delete(topic);
        settleFetch(); // unblock any waiting mount
        // Always update state — in Strict Mode the component is still mounted;
        // in prod this only runs once.
        setScriptIdeas(ideas);
        setError(err);
        setIsLoading(false);
      };

      while (true) {
        try {
          const response = await ApiService.processTopic(topic);
          console.log('[script-ideas] API response for:', topic, response);

          const ideas: ScriptIdea[] = (response.ideas ?? []).map((idea, idx) => ({
            id: idx + 1,
            title: idea,
            description: (response.descriptions ?? [])[idx] || 'No description available.',
            category: getCategoryFromIndex(idx),
          }));

          applyResult(ideas, null);
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
  }, [topic]);

  const getCategoryFromIndex = (index: number) => {
    const categoryMap = ['Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'];
    return categoryMap[index % categoryMap.length];
  };


  const handleGenerateScript = async (idea: ScriptIdea) => {
    if (!videoLengths[idea.id]) {
      console.warn('No length specified for this script');
      return;
    }
    setSelectedIdea(idea);
    setIsModalOpen(true);
  };

  const handleVideoLengthChange = (id: number, value: string) => {
    setVideoLengths((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen bg-[#E9EBF0]/20">
      <Header />

      <ScriptGenerationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        topic={selectedIdea?.title || ''}
        initialDuration={videoLengths[selectedIdea?.id || 0] || '10'}
        onGenerate={handleModalSubmit}
        isGenerating={isGenerating}
      />

      {/* Search Section */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-4">
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
                 <Button
                   onClick={handleSearchSubmit}
                   className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 rounded-full bg-black text-white hover:bg-gray-800 hover:shadow-xl hover:scale-105 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-xs sm:text-sm md:text-lg font-medium font-sans transition-all duration-300 ease-in-out"
                 >
                   <span className="hidden sm:inline">Generate Ideas</span>
                   <span className="sm:hidden">Generate</span>
                 </Button>
          </div>
        </div>
      </div>

      {/* ── Analytics Section ── */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-4">
        <Card className="shadow-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <div className="overflow-x-auto scrollbar-none">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mt-4 w-fit min-w-max">
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

          <CardContent className="overflow-y-auto pb-6 px-0">

            {/* ════════════════════ TSS TAB ════════════════════ */}
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

            {/* ════════════════════ ECI TAB ════════════════════ */}
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
      </section>


      {/* ── Script Ideas Section ── */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-8 sm:py-12">
      <div className="bg-gray-100 rounded-3xl relative">
          {/* Header — full width, sticky */}
          <div className="sticky top-14 z-10 bg-white border border-gray-200/80 rounded-3xl shadow-sm px-6 sm:px-8 py-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-6 h-6 text-orange-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-0.5">AI-generated</p>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] leading-tight flex flex-wrap items-center gap-2">
                  Script Ideas
                  <span className="inline-flex items-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-semibold px-3 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    {topic}
                  </span>
                </h2>
                <p className="text-sm text-[#6e6e73] mt-1">Choose a perspective and generate a full YouTube script in seconds</p>
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

          {/* Two-column body */}
          <div className="flex gap-5 sm:px-6 pb-8 items-start">

            {/* ── Left: ideas list ── */}
            <div className="flex-1 min-w-0">

              {isLoading && (
                <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm text-center py-14">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-[#1d1d1f] mb-1">Generating Script Ideas</p>
                      <p className="text-sm text-[#6e6e73]">AI is analysing &quot;{topic}&quot; — this may take up to 5 minutes</p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
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
                        <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed sm:pl-12 line-clamp-2 sm:line-clamp-6">{statement.description}</p>
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
                            onClick={() => handleGenerateScript(statement)}
                            disabled={!videoLengths[statement.id]?.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                            Generate Script
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

            {/* ── Right: suggested topics (sticky) — hidden on small screens ── */}
            <div className="hidden lg:block w-[35%] flex-shrink-0 self-start">
              <div className="sticky top-24">
                <SuggestedTopicsSidebar />
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
