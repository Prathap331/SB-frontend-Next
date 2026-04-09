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
import { ApiService, PipelineMetricsResponse } from '@/services/api';
import { ScriptGenerationModal, ScriptGenerationParams } from '@/components/ScriptGenerationModal';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";


const pieData = [
  { name: "Category A", value: 40 },
  { name: "Category B", value: 25 },
  { name: "Category C", value: 20 },
  { name: "Category D", value: 15 },
];

const COLORS = ["#3B5BFF", "#FFBB28", "#FF8042", "#0088FE"]; // Auto-rotate colors

interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}

interface VideoItem {
  url: string;
  title: string;
  thumbnail: string;
}


const renderLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  percent,
}: PieLabelProps) => {
  const RADIAN = Math.PI / 180;

  // Position INSIDE the border (closer to outerRadius)
  const radius = outerRadius - (outerRadius - innerRadius) * 0.25;

  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="10"
      fontWeight="600"
    >
      <tspan x={x} dy="-0.2em">{name}</tspan>
      <tspan x={x} dy="1.2em">{`${(percent * 100).toFixed(0)}%`}</tspan>
    </text>
  );
};





interface ScriptIdea {
  id: number;
  title: string;
  description: string;
  category: string;
}

const KeywordanalysisProducts = [
  {
    id: "video editing tips",
    volume: "47.2K",
    difficulty: 68,
    trend: 82,
    velocity: "High",
    intentType: "Informational",
    intentDesc: "Tutorial",
  },
  {
    id: "video editing software",
    volume: "32.5K",
    difficulty: 75,
    trend: 68,
    velocity: "Medium",
    intentType: "Commercial",
    intentDesc: "Product",
  },
  {
    id: "beginner video editing",
    volume: "28.8K",
    difficulty: 52,
    trend: 91,
    velocity: "Very High",
    intentType: "Informational",
    intentDesc: "How-to",
  },
  {
    id: "editing tutorials",
    volume: "18.3K",
    difficulty: 45,
    trend: 58,
    velocity: "Low",
    intentType: "Informational",
    intentDesc: "Tutorial",
  },
  {
    id: "video effects tips",
    volume: "12.7K",
    difficulty: 61,
    trend: 95,
    velocity: "Very High",
    intentType: "Informational",
    intentDesc: "How-to",
  },
] as const;


const trafficByLocation = [
  {
    country: "United States",
    flag: "🇺🇸",
    traffic: "21.7M",
    trafficGrowth: "+3.3M",
    share: "30.9%",
    keywordCount: "1.8M",
    keywordGrowth: "+364.1K",
  },
  {
    country: "United Kingdom",
    flag: "🇬🇧",
    traffic: "5.5M",
    trafficGrowth: "+414.7K",
    share: "7.9%",
    keywordCount: "345.2K",
    keywordGrowth: "+75.2K",
  },
  {
    country: "France",
    flag: "🇫🇷",
    traffic: "4.6M",
    trafficGrowth: "+671K",
    share: "6.5%",
    keywordCount: "283.2K",
    keywordGrowth: "+39.2K",
  },
  {
    country: "Germany",
    flag: "🇩🇪",
    traffic: "3.7M",
    trafficGrowth: "+747.5K",
    share: "5.3%",
    keywordCount: "235.4K",
    keywordGrowth: "+18K",
  },
  {
    country: "Poland",
    flag: "🇵🇱",
    traffic: "3.1M",
    trafficGrowth: "+804.4K",
    share: "4.4%",
    keywordCount: "116.9K",
    keywordGrowth: "+9.4K",
  },
];


const competitorVideos = [
  { id:'1',authority: 'High Authority', category: 'Educational Tech', views: '2.4M', range: '1.8M - 3.2M', engagement: '8.5%' },
  { id:'2',authority: 'High Authority', category: 'Creative Content', views: '1.4M', range: '1.8M - 3.2M', engagement: '8.5%' },
  { id:'3',authority: 'Medium Authority', category: 'Beginner Guides', views: '485K', range: '250k - 720k', engagement: '6.2%' },
  { id:'4',authority: 'Low Authority', category: 'Beginner Guide', views: '82K', range: '35k - 150k', engagement: '4.8%' },
] as const;


const performanceKeywords = [
  { keyword: 'Tutorial', value: 100 },
  { keyword: 'Review', value: 70 },
  { keyword: 'Guide', value: 60 },
  { keyword: 'Tips', value: 45 },
  { keyword: 'Demo', value: 40 },
] as const;

const videoLinks: string[] = [
  "https://www.youtube.com/watch?v=_Yhyp-_hX2s",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
  "https://www.youtube.com/watch?v=_Yhyp-_hX2s",
  "https://www.youtube.com/watch?v=K4TOrB7at0Y",
  "https://www.youtube.com/watch?v=9bZkp7q19f0",
] as const;



const metaReports = [
  { month: 'January', revenue: '$24,500', growth: '+5.2%' },
  { month: 'February', revenue: '$28,900', growth: '+18.0%' },
  { month: 'March', revenue: '$31,200', growth: '+8.0%' },
] as const;

const regionalSales = [
  { region: 'North America', sales: '$145,230' },
  { region: 'Europe', sales: '$98,450' },
  { region: 'Asia Pacific', sales: '$123,890' },
  { region: 'Latin America', sales: '$56,780' },
  { region: 'Middle East', sales: '$34,210' },
] as const;

const monthlyHighlights = [
  'Revenue increased by 15% compared to last quarter',
  'New customer acquisition grew by 23%',
  'Average order value increased to $342',
  'Customer satisfaction rate reached 94%',
  'Product returns decreased by 8%',
] as const;

// Cache both in memory and localStorage to persist between visits
const resultsCache = new Map<string, { scriptIdeas: ScriptIdea[]; error: string | null; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours - topics don't change that often

interface CacheItem {
  scriptIdeas: ScriptIdea[];
  error: string | null;
  timestamp: number;
}

const getFromLocalStorage = (topic: string): CacheItem | null => {
  try {
    const item = localStorage.getItem(`topic_${topic}`);
    if (!item) return null;
    const parsed = JSON.parse(item) as CacheItem;
    const now = Date.now();
    if (now - parsed.timestamp > CACHE_DURATION) {
      localStorage.removeItem(`topic_${topic}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
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
  // Save to memory cache
  resultsCache.set(topic, data);
  // Save to localStorage
  try {
    localStorage.setItem(`topic_${topic}`, JSON.stringify(data));
  } catch {
    // If localStorage is full, clean up old items
    const keys = Object.keys(localStorage);
    const topicKeys = keys.filter(k => k.startsWith('topic_'));
    if (topicKeys.length > 0) {
      localStorage.removeItem(topicKeys[0]); // Remove oldest
      try {
        localStorage.setItem(`topic_${topic}`, JSON.stringify(data));
      } catch {
        console.warn('Failed to save to localStorage after cleanup');
      }
    }
  }
};

const cleanupCache = () => {
  const now = Date.now();
  // Clean memory cache
  for (const [key, value] of resultsCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      resultsCache.delete(key);
    }
  }
  // Clean localStorage
  try {
    const keys = Object.keys(localStorage);
    const topicKeys = keys.filter(k => k.startsWith('topic_'));
    topicKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item) as CacheItem;
        if (now - parsed.timestamp > CACHE_DURATION) {
          localStorage.removeItem(key);
        }
      }
    });
  } catch {
    // Ignore localStorage errors
  }
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

  const [scriptIdeas, setScriptIdeas] = useState<ScriptIdea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [videoLengths, setVideoLengths] = useState<Record<number, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ScriptIdea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState(topic);
  const [activeTab, setActiveTab] = useState<'Trend strength score' | 'Content Saturation index' | 'Content angle gap score'>('Trend strength score');
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetricsResponse | null>(null);
  const [isPipelineLoading, setIsPipelineLoading] = useState(false);
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

  // Fetch pipeline metrics (TSS + CSI + CAGS) — fires immediately on topic change
  useEffect(() => {
    if (!topic) return;
    setPipelineMetrics(null);
    setIsPipelineLoading(true);
    ApiService.pipelineMetrics(topic)
      .then(data => { setPipelineMetrics(data); setIsPipelineLoading(false); })
      .catch(err => { console.error('[pipeline-metrics]', err); setIsPipelineLoading(false); });
  }, [topic]);

  useEffect(() => {
    setSearchQuery(topic);
  }, [topic]);

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/search/${encodeURIComponent(trimmed)}`);
  };

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      if (!topic) return;

      // Try localStorage first
      const localData = getFromLocalStorage(topic);
      if (localData) {
        setScriptIdeas(localData.scriptIdeas);
        setError(localData.error);
        setIsLoading(false);
        // Also update memory cache
        resultsCache.set(topic, localData);
        return;
      }

      // Try memory cache next
      const cached = resultsCache.get(topic);
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setScriptIdeas(cached.scriptIdeas);
        setError(cached.error);
        setIsLoading(false);
        // Update localStorage while we have the data
        saveToCache(topic, cached);
        return;
      }

      initialLoadStartRef.current = Date.now();
      setIsLoading(true);
      setError(null);
      setScriptIdeas([]);

      const maxWaitMs = 300000; // 5 minutes
      const retryDelayMs = 5000;

      while (!isCancelled) {
        try {
          const response = await ApiService.processTopic(topic);
          if (isCancelled) return;

          const ideas: ScriptIdea[] = response.ideas.map((idea, idx) => ({
            id: idx + 1,
            title: idea,
            description: response.descriptions[idx] || 'No description available.',
            category: getCategoryFromIndex(idx),
          }));

          const cacheData = { scriptIdeas: ideas, error: null, timestamp: Date.now() };
          saveToCache(topic, cacheData);
          setScriptIdeas(ideas);
          setIsLoading(false);
          return;
        } catch (err) {
          const elapsed = Date.now() - (initialLoadStartRef.current ?? Date.now());
          const message = err instanceof Error ? err.message : String(err);

          const isRetryable = message.includes('502') || message.toLowerCase().includes('temporarily unavailable');
          if (isRetryable && elapsed + retryDelayMs < maxWaitMs) {
            await new Promise((r) => setTimeout(r, retryDelayMs));
            continue;
          }

          if (elapsed > 300000 && !isCancelled) { // 5 minutes timeout
            setError("The server is taking a long time to respond. You can wait or try refreshing the page.");
          }

          // fallback sample data
          const fallbackIdeas: ScriptIdea[] = [
            {
              id: 1,
              title: `Understanding ${topic}: A Comprehensive Analysis`,
              description: `Dive deep into the world of ${topic} and explore its various aspects, implications, and real-world applications.`,
              category: 'Technology',
            },
            {
              id: 2,
              title: `The Impact of ${topic} on Modern Society`,
              description: `Explore how ${topic} is shaping our world today and what it means for the future.`,
              category: 'Social Impact',
            },
            {
              id: 3,
              title: `Future Trends: Where ${topic} is Heading`,
              description: `Get a glimpse into the future of ${topic} and discover what experts predict will happen next.`,
              category: 'Future Analysis',
            },
          ];

          const errorMessage = message.includes('timeout')
            ? 'API request timed out after waiting. Using sample data.'
            : message.includes('502')
            ? 'API server returned 502 for an extended period. Using sample data.'
            : 'API temporarily unavailable. Using sample data.';

          const cacheData = { scriptIdeas: fallbackIdeas, error: errorMessage, timestamp: Date.now() };
          saveToCache(topic, cacheData);
          if (isCancelled) return;
          setScriptIdeas(fallbackIdeas);
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [topic]);

  const getCategoryFromIndex = (index: number) => {
    const categoryMap = ['Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'];
    return categoryMap[index % categoryMap.length];
  };

  const filtered = scriptIdeas.filter((s) => selectedCategory === 'all' || s.category === selectedCategory);

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

      {/* Dashboard Analytics Section */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-4">
        <Card className="shadow-xl border border-gray-200 bg-white h-[820px] overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mt-4 w-fit">
              {([
                { key: 'Trend strength score',    label: 'Trend strength score',    icon: TrendingUp },
                { key: 'Content Saturation index', label: 'Content saturation index', icon: BarChart3 },
                { key: 'Content angle gap score',  label: 'Content angle gap score',  icon: Target },
              ] as { key: typeof activeTab; label: string; icon: typeof TrendingUp }[]).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-white text-[#1d1d1f] shadow-sm font-semibold'
                        : 'text-gray-500 hover:text-[#1d1d1f]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden pr-1 pb-6">
            <div className="flex h-full flex-col overflow-hidden">

              {/* ── Pipeline loading skeleton ── */}
              {isPipelineLoading && (
                <div className="flex h-full w-full gap-4 animate-pulse">
                  {/* Left column skeleton */}
                  <div className="flex flex-col gap-4 w-[260px] flex-shrink-0">
                    <div className="bg-gray-100 rounded-xl p-4 flex flex-col gap-3">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                      <div className="h-10 w-16 bg-gray-200 rounded" />
                      <div className="h-4 w-28 bg-gray-200 rounded-full" />
                      <div className="h-2 w-full bg-gray-200 rounded" />
                      <div className="h-2 w-4/5 bg-gray-200 rounded" />
                      <div className="space-y-2 mt-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-200 flex-shrink-0" />
                            <div className="h-1.5 flex-1 bg-gray-200 rounded-full" />
                            <div className="h-2 w-10 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded-xl p-4 flex-1 flex flex-col gap-3">
                      <div className="h-3 w-32 bg-gray-200 rounded" />
                      <div className="h-2 w-full bg-gray-200 rounded" />
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-gray-200 rounded-lg p-3 space-y-2">
                          <div className="flex gap-2">
                            <div className="h-4 w-6 bg-gray-300 rounded" />
                            <div className="h-4 w-24 bg-gray-300 rounded" />
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {[1,2,3,4,5,6].map(j => <div key={j} className="h-8 bg-gray-300 rounded" />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right column skeleton */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="bg-gray-100 rounded-xl p-4 flex-1 flex flex-col gap-3">
                      <div className="h-3 w-36 bg-gray-200 rounded" />
                      <div className="h-2 w-64 bg-gray-200 rounded" />
                      {/* Header row */}
                      <div className="flex gap-3 px-3">
                        <div className="h-2 w-6 bg-gray-200 rounded" />
                        <div className="h-2 w-12 bg-gray-200 rounded" />
                        <div className="h-2 flex-1 bg-gray-200 rounded" />
                        <div className="h-2 w-20 bg-gray-200 rounded" />
                      </div>
                      {/* Row skeletons */}
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="grid grid-cols-[32px_56px_1fr_110px] gap-3 items-center p-3 bg-gray-200 rounded-lg">
                          <div className="h-4 w-4 bg-gray-300 rounded" />
                          <div className="w-10 h-10 bg-gray-300 rounded-lg" />
                          <div className="space-y-1.5">
                            <div className="h-2 w-full bg-gray-300 rounded" />
                            <div className="h-2 w-3/4 bg-gray-300 rounded" />
                            <div className="flex gap-1 mt-1">
                              <div className="h-3 w-12 bg-gray-300 rounded-full" />
                              <div className="h-3 w-10 bg-gray-300 rounded-full" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full bg-gray-300 rounded-full" />
                            <div className="h-2 w-16 bg-gray-300 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!isPipelineLoading && pipelineMetrics && activeTab === 'Trend strength score' && (() => {
                const tss = pipelineMetrics.trend_strength_score;
                const phase = tss.phase;
                const primaryDriver = tss.why_trending.primary_driver;
                const drivers = [
                  { label: 'Curiosity',      active: /curiosity/i.test(primaryDriver) },
                  { label: 'Social wave',    active: /social/i.test(primaryDriver) },
                  { label: 'Creator surge',  active: /creator/i.test(primaryDriver) },
                  { label: 'Breaking event', active: /break/i.test(primaryDriver) },
                ];
                const activeDriver = drivers.find(d => d.active)?.label || primaryDriver;
                const platformWeights = tss.why_trending.platform_weights;
                const maxPct = Math.max(...platformWeights.map(w => parseInt(w.percentage)));
                const PLATFORM_META: Record<
  string,
  {
    icon: typeof Youtube;
    sub: string;
    iconBg: string;
    iconColor: string;
    barColor: string;
    tagColor: string;
  }
> = {
  YouTube: {
    icon: Youtube,
    sub: 'Video discovery',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    barColor: 'bg-red-500',
    tagColor: 'bg-red-600',
  },
  Search: {
    icon: Search,
    sub: 'Google Trends',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    barColor: 'bg-blue-500',
    tagColor: 'bg-blue-600',
  },
  Social: {
    icon: User2,
    sub: 'Reddit · X/Twitter',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
    barColor: 'bg-purple-500',
    tagColor: 'bg-purple-600',
  },
  News: {
    icon: Newspaper,
    sub: 'NewsAPI · GDELT',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    barColor: 'bg-gray-500',
    tagColor: 'bg-gray-500',
  },
};
               
                const signals = tss.platform_signals;
                const sources = tss.confidence.sources;
                const reliability = tss.confidence.reliability_score;
                const comp = tss.composition;
                return (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-auto">

                  {/* Trend Strength Score */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Trend Strength Score</p>
                    </div>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-3xl font-black text-green-600 leading-none">{tss.score}</span>
                        <span className="text-[9px] text-green-500 font-semibold mt-0.5">/100</span>
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] px-2.5 py-0.5 rounded-full mb-2 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{tss.status}
                        </span>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          <strong className="text-gray-900">{tss.verdict}</strong> {tss.description}
                        </p>
                      </div>
                    </div>
                    {/* Phase bar */}
                    <div className="flex gap-1 mb-4">
                      {['Flat', 'Emerging', 'Rising', 'Peak', 'Saturating'].map(p => (
                        <span key={p} className={`text-[9px] px-1.5 py-0.5 rounded flex-1 text-center font-medium ${p === phase ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{p}</span>
                      ))}
                    </div>
                    {/* Score composition */}
                    <div className="border-t border-gray-100 pt-4 mt-1">
                      <p className="text-[10px] text-gray-400 mb-3 uppercase tracking-widest font-medium">Score composition</p>
                      {[
                        { label: 'Base',        display: String(comp?.base ?? 45),       value: comp?.base ?? 45,       max: 100, color: 'bg-green-500' },
                        { label: 'Psych boost', display: `+${comp?.psych_boost ?? 6}`,   value: comp?.psych_boost ?? 6,  max: 20,  color: 'bg-green-400' },
                        { label: 'Reliability', display: String(comp?.reliability ?? 0.95), value: comp?.reliability ?? 0.95, max: 1, color: 'bg-blue-400' },
                      ].map(bar => (
                        <div key={bar.label} className="flex items-center gap-2.5 mb-2.5">
                          <span className="text-[10px] text-gray-500 w-20 flex-shrink-0">{bar.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.value / bar.max) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-700 w-8 text-right font-bold">{bar.display}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Why It's Trending */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Flame className="w-4 h-4 text-orange-500" />
                        </div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Why It&apos;s Trending</p>
                      </div>
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[9px] px-2 py-0.5 rounded-full font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{activeDriver}
                      </span>
                    </div>
                    <div className="flex gap-3 mb-3">
                      <div className="space-y-1.5 flex-shrink-0">
                        {drivers.map(f => (
                          <div key={f.label} className={`text-[10px] flex items-center gap-1 ${f.active ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                            <span>{f.active ? '●' : '✦'}</span>{f.label}
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-gray-900 text-sm font-bold mb-1">{tss?.why_trending.headline ?? 'YouTube views doubled this week'}</p>
                        <p className="text-gray-500 text-xs leading-relaxed">{tss?.why_trending.summary ?? "Algorithm is surfacing this topic. Creators who publish in the next 48 hours capture the peak window."}</p>
                      </div>
                    </div>
                    {/* <div className="flex flex-wrap gap-2 mb-3">
                      {['YouTube video', 'TikTok / Reels', 'Publish now'].map((btn, i) => (
                        <span key={btn} className={`text-[10px] px-3 py-1 rounded-full cursor-pointer ${i === 2 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{btn}</span>
                      ))}
                    </div> */}
                    <div className="border-t border-gray-100 pt-3 mt-1">
                      <p className="text-[9px] text-gray-400 mb-2 uppercase tracking-widest font-medium">Weights this scan · regime: {activeDriver.toLowerCase()}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {platformWeights.map(w => {
                          const pct = parseInt(w.percentage);
                          const isActive = pct === maxPct;
                          return (
                            <div key={w.platform} className={`flex-1 rounded-xl text-center px-1.5 py-4 border transition-colors ${isActive ? 'bg-blue-600 border-blue-600 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                              <p className={`text-[9px] uppercase font-semibold tracking-wide ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{w.platform}</p>
                              <p className={`text-xs font-black mt-0.5 ${isActive ? 'text-white' : 'text-gray-700'}`}>{w.percentage}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Platform Signals */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Radio className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Platform Signals</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-4 pl-[42px]">Where this topic is gaining momentum · leading signal highlighted</p>
                    <div className="space-y-4">
                      {signals.map(signal => {
                        const meta = PLATFORM_META[signal.platform] ?? { icon: Search, sub: signal.platform };
                        const Icon = meta.icon;
                        const barColor = meta.barColor;
                        return (
                          <div key={signal.platform} className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl ${meta.iconBg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-4 h-4 ${meta.iconColor}`} />
                            </div>
                            <div className="flex flex-col items-start gap-0.5 min-w-[56px] flex-shrink-0">
                              <span className="text-gray-900 text-xs font-semibold">{signal.platform}</span>
                              <span className="text-[9px] text-gray-400 whitespace-nowrap">{meta.sub}</span>
                            </div>
                            <div className="w-full flex flex-col gap-1.5 min-w-0">
                              <div className="w-full h-2 rounded-full bg-gray-100">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${signal.barW}%` }} />
                              </div>
                              <div className="flex w-full justify-between">
                                <span className="text-[9px] text-gray-400 whitespace-nowrap">{signal.note}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded ${meta.tagColor} text-white flex-shrink-0`}>{signal.tag}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-center justify-center w-12 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-100 py-1.5">
                              <p className="text-gray-900 text-sm font-black leading-none">{signal.score}</p>
                              <p className="text-[8px] text-gray-400 mt-0.5">/100</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Signal Confidence */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Signal Confidence</p>
                      </div>
                      <span className="text-[9px] text-green-600 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />All sources live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {sources.map(src => {
                        const srcMeta = PLATFORM_META[src.name] ?? { icon: Search, iconBg: 'bg-gray-100', iconColor: 'text-gray-500' };
                        const SrcIcon = srcMeta.icon;
                        return (
                          <div key={src.name} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                            <div className={`w-7 h-7 rounded-lg ${srcMeta.iconBg} flex items-center justify-center mb-2`}>
                              <SrcIcon className={`w-3.5 h-3.5 ${srcMeta.iconColor}`} />
                            </div>
                            <p className="text-gray-900 text-sm font-bold">{src.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{src.detail}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1.5 font-medium uppercase tracking-widest">Reliability score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${reliability * 100}%` }} />
                      </div>
                      <span className="text-xs text-gray-700 font-bold">{reliability}</span>
                    </div>
                  </div>
                </div>
                );
              })()}

            {!isPipelineLoading && activeTab === 'Content Saturation index' && (() => {
                const csi = pipelineMetrics?.content_saturation_index;
                const csiStatus = csi?.status ?? 'Competitive';
                const breakout = csi?.breakout;
                const ih = csi?.incumbent_health;

                // Static per-dimension metadata (weights + descriptions + icons)
                const DIM_META: Record<string, { weight: string; desc: string; icon: typeof TrendingUp; iconBg: string; iconColor: string }> = {
                  'Supply pressure':  { weight: '25% weight', desc: 'Upload rate and channel volume in this topic.',          icon: Layers,     iconBg: 'bg-red-50',    iconColor: 'text-red-500' },
                  'Audience demand':  { weight: '25% weight', desc: 'Search velocity and view momentum driving this topic.',  icon: TrendingUp, iconBg: 'bg-green-50',  iconColor: 'text-green-600' },
                  'Upload freshness': { weight: '15% weight', desc: 'Recency of uploads in the past 48h window.',            icon: Zap,        iconBg: 'bg-amber-50',  iconColor: 'text-amber-500' },
                  'Angle coverage':   { weight: '15% weight', desc: 'Semantic diversity across existing corpus.',             icon: Globe,      iconBg: 'bg-blue-50',   iconColor: 'text-blue-500' },
                  'Viral ceiling':    { weight: '10% weight', desc: 'Top vs median VPD ratio — algorithm breakout potential.',icon: Rocket,     iconBg: 'bg-purple-50', iconColor: 'text-purple-500' },
                  'Quality gap':      { weight: '10% weight', desc: 'Incumbent engagement vs tier benchmark.',                icon: Trophy,     iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
                };
                const getEffectStyle  = (e: string) => e === 'Opens' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200';
                const getBarColor     = (e: string, s: string) => {
                  if (e === 'Closes') return s === 'Strong' ? 'bg-red-500' : 'bg-amber-400';
                  if (s === 'Strong') return 'bg-green-400';
                  if (s === 'Moderate') return 'bg-blue-500';
                  return 'bg-purple-400';
                };
                const getScoreColor   = (e: string, s: string) => {
                  if (e === 'Closes') return s === 'Strong' ? 'text-red-500' : 'text-amber-500';
                  if (s === 'Strong') return 'text-green-600';
                  if (s === 'Moderate') return 'text-blue-600';
                  return 'text-purple-600';
                };
                const getStatusStyle  = (s: string) => {
                  if (s === 'Strong' || s === 'Gap exists') return 'bg-green-100 text-green-700';
                  if (s === 'Moderate' || s === 'Mild flood') return 'bg-amber-100 text-amber-600';
                  if (s === 'High ceiling') return 'bg-blue-100 text-blue-600';
                  return 'bg-gray-100 text-gray-600';
                };

                // Breakout: the backend gives active signals; pad to 5 standard ones
                const ALL_BREAKOUT_SIGNALS = [
                  'Search rising', 'YouTube growth detected',
                  'Upload surge detected', 'Engagement heat rising', '24h view spike',
                ];
                const activeSignals = new Set(breakout?.signals ?? []);
                const breakoutItems = ALL_BREAKOUT_SIGNALS.map(label => ({
                  label,
                  active: activeSignals.has(label) || [...activeSignals].some(s => label.toLowerCase().includes(s.toLowerCase())),
                }));

                // Incumbent health — backend returns raw numbers (0–1 or 0–100)
                const engGap = ih ? Math.round(ih.engagement_gap > 1 ? ih.engagement_gap : ih.engagement_gap * 100) : 55;
                const density = ih?.creator_density ?? 0.55;
                const vpd = ih ? Math.round(ih.vpd_decay > 1 ? ih.vpd_decay : ih.vpd_decay * 100) : 48;

                const dimensions = csi?.dimensions ?? [
                  { name: 'Supply pressure',  score: 58, effect: 'Closes', status: 'Moderate' },
                  { name: 'Audience demand',  score: 71, effect: 'Opens',  status: 'Strong' },
                  { name: 'Upload freshness', score: 44, effect: 'Closes', status: 'Mild flood' },
                  { name: 'Angle coverage',   score: 33, effect: 'Opens',  status: 'Gap exists' },
                  { name: 'Viral ceiling',    score: 62, effect: 'Opens',  status: 'High ceiling' },
                  { name: 'Quality gap',      score: 55, effect: 'Opens',  status: 'Opportunity' },
                ];

                return (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-full overflow-auto">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-4">

                  {/* Content Saturation Index */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-4 h-4 text-orange-500" />
                      </div>
                      <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Content Saturation Index</p>
                    </div>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-orange-50 border-2 border-orange-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-3xl font-black text-orange-500 leading-none">{csi?.score ?? 38}</span>
                        <span className="text-[9px] text-orange-400 font-semibold mt-0.5">/100</span>
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] px-2.5 py-0.5 rounded-full mb-2 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{csiStatus}
                        </span>
                        <p className="text-gray-500 text-xs leading-relaxed">
                          <strong className="text-gray-900">{csi?.verdict ?? 'Winnable with the right angle.'}</strong> {csi?.description ?? 'Some dominant channels exist but no single lock-in.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {['Open', 'Competitive', 'Crowded', 'Saturated'].map(p => (
                        <span key={p} className={`text-[9px] px-1 py-1 rounded-lg flex-1 text-center font-semibold transition-colors ${p === csiStatus ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{p}</span>
                      ))}
                    </div>
                  </div>

                  {/* Breakout Indicator */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Breakout Indicator</p>
                      </div>
                      <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 text-[9px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{breakout?.label ?? 'Watch closely'}
                      </span>
                    </div>
                    <div className="flex items-center justify-center mb-4">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                          <circle cx="40" cy="40" r="32" fill="none" stroke="#f97316" strokeWidth="8"
                            strokeDasharray={`${((breakout?.score ?? 2) / (breakout?.out_of ?? 5)) * 201} 201`}
                            strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-orange-500 leading-none">{breakout?.score ?? 2}</span>
                          <span className="text-[9px] text-gray-400 font-medium">of {breakout?.out_of ?? 5}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {breakoutItems.map(item => (
                        <div key={item.label} className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg ${item.active ? 'bg-orange-50 border border-orange-100' : ''}`}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.active ? 'bg-orange-500' : 'bg-gray-200'}`} />
                          <span className={`text-[11px] ${item.active ? 'text-orange-700 font-semibold' : 'text-gray-400'}`}>{item.label}</span>
                          {item.active && <span className="ml-auto text-[9px] text-orange-500 font-bold">✓</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="flex flex-col gap-4 min-h-0">

                  {/* Dimension Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Layers className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Dimension Breakdown</p>
                        <p className="text-[10px] text-gray-400">Forces that open or close this topic</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {dimensions.map(dim => {
                        const meta = DIM_META[dim.name] ?? { weight: '', desc: '', icon: BarChart3, iconBg: 'bg-gray-100', iconColor: 'text-gray-500' };
                        const DimIcon = meta.icon;
                        return (
                          <div key={dim.name} className="bg-gray-50 border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <div className={`w-7 h-7 rounded-lg ${meta.iconBg} flex items-center justify-center flex-shrink-0`}>
                                <DimIcon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
                              </div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${getEffectStyle(dim.effect)}`}>{dim.effect}</span>
                            </div>
                            <p className="text-gray-900 text-xs font-bold mb-0.5">{dim.name}</p>
                            <p className="text-[9px] text-gray-400 mb-2">{meta.weight}</p>
                            <div className="h-2 rounded-full bg-gray-200 mb-2">
                              <div className={`h-full rounded-full ${getBarColor(dim.effect, dim.status)}`} style={{ width: `${dim.score}%` }} />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xl font-black ${getScoreColor(dim.effect, dim.status)}`}>{dim.score}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${getStatusStyle(dim.status)}`}>{dim.status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Incumbent Health */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Eye className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Incumbent Health</p>
                        <p className="text-[10px] text-gray-400">Can a well-made video displace what&apos;s already ranking?</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <p className="text-[9px] tracking-widest text-purple-600 uppercase font-semibold">Engagement Gap</p>
                        </div>
                        <p className="text-2xl font-black text-purple-600 mb-1">{engGap}%</p>
                        <p className="text-[9px] text-gray-500 mb-2">Incumbents underperform tier benchmark</p>
                        <div className="h-2 rounded-full bg-purple-100">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${engGap}%` }} />
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          <p className="text-[9px] tracking-widest text-green-600 uppercase font-semibold">Creator Density</p>
                        </div>
                        <p className="text-2xl font-black text-green-600 mb-1">{density}</p>
                        <p className="text-[9px] text-gray-500 mb-2">Unique channels ratio across corpus</p>
                        <div className="h-2 rounded-full bg-green-100">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(density * 100, 100)}%` }} />
                        </div>
                      </div>
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          <p className="text-[9px] tracking-widest text-orange-600 uppercase font-semibold">VPD Decay</p>
                        </div>
                        <p className="text-2xl font-black text-orange-500 mb-1">{vpd}%</p>
                        <p className="text-[9px] text-gray-500 mb-2">Top videos losing daily view momentum</p>
                        <div className="h-2 rounded-full bg-orange-100">
                          <div className="h-full rounded-full bg-orange-400" style={{ width: `${vpd}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                      <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">✓</span>
                      <div>
                        <p className="text-xs font-bold text-green-700">{ih?.verdict ?? 'Entry is viable'}</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{csi?.description ?? 'Incumbents rely on age, not quality. A well-produced video has a clear displacement path.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                );
              })()}

            {!isPipelineLoading && activeTab === 'Content angle gap score' && (() => {
                const cags = pipelineMetrics?.content_angle_gap_score;
                const totalAngles = cags?.total_angles ?? 18;

                // Distribution with color mapping
                const DIST_COLORS: Record<string, { color: string; textColor: string }> = {
                  'Not covered': { color: 'bg-green-500', textColor: 'text-green-600' },
                  'Low quality':  { color: 'bg-amber-400', textColor: 'text-amber-600' },
                  'Well covered': { color: 'bg-gray-300',  textColor: 'text-gray-500' },
                };
                const distribution = (cags?.distribution ?? [
                  { label: 'Not covered', count: 7 },
                  { label: 'Low quality', count: 6 },
                  { label: 'Well covered', count: 5 },
                ]).map(d => ({ ...d, total: totalAngles, ...(DIST_COLORS[d.label] ?? { color: 'bg-gray-300', textColor: 'text-gray-500' }) }));

                const gapCount = distribution.filter(d => d.label !== 'Well covered').reduce((s, d) => s + d.count, 0);

                // Rank badge colors
                const RANK_COLORS = ['bg-green-500', 'bg-green-600', 'bg-amber-400', 'bg-amber-500', 'bg-orange-400'];

                // Top angles from backend
                const topAngles = (cags?.top_angles ?? []).slice(0, 3).map((a, i) => ({
                  rank: `#${a.rank}`,
                  rankBg: RANK_COLORS[i] ?? 'bg-gray-400',
                  label: a.who,
                  covered: a.coverage === 'Not Covered' ? '0%' : a.coverage === 'Low quality' ? '<33%' : '>66%',
                  dims: [
                    { key: 'WHO',  val: a.who },
                    { key: 'WHAT', val: a.what },
                    { key: 'WHEN', val: a.when },
                    { key: 'HOOK', val: a.frame },
                    { key: 'COVERAGE', val: a.coverage },
                    { key: 'TITLE', val: a.title.length > 30 ? a.title.slice(0, 30) + '…' : a.title },
                  ],
                }));

                // Gap opportunities from backend
                const getScoreStyle = (s: number) => {
                  if (s >= 80) return { scoreColor: 'text-green-600', scoreBorder: 'border-green-400', socialBarColor: 'bg-green-500' };
                  if (s >= 60) return { scoreColor: 'text-amber-600', scoreBorder: 'border-amber-400', socialBarColor: 'bg-amber-400' };
                  if (s >= 40) return { scoreColor: 'text-orange-500', scoreBorder: 'border-orange-400', socialBarColor: 'bg-orange-400' };
                  return           { scoreColor: 'text-gray-500',   scoreBorder: 'border-gray-300',   socialBarColor: 'bg-gray-400' };
                };
                const gapOpportunities = cags?.gap_opportunities ?? [];

                return (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-full overflow-auto">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-4">

                  {/* Content Landscape */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Content Landscape</p>
                        <p className="text-[10px] text-gray-400">Coverage across {totalAngles} angles</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-20 h-20 rounded-2xl bg-green-50 border-2 border-green-100 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-3xl font-black text-green-600 leading-none">{totalAngles}</span>
                        <span className="text-[9px] text-green-500 font-semibold mt-0.5">angles</span>
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-[9px] px-2.5 py-0.5 rounded-full mb-2 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{gapCount} gap opportunities
                        </span>
                        <p className="text-[10px] text-gray-500 leading-relaxed">Most angles remain uncovered or low quality. High CAGS = winnable + in-demand.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {distribution.map(item => (
                        <div key={item.label} className="flex items-center gap-2.5">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                          <span className="text-[11px] text-gray-600 w-24 flex-shrink-0 font-medium">{item.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.count / item.total) * 100}%` }} />
                          </div>
                          <span className={`text-[11px] font-bold ${item.textColor} w-16 text-right`}>{item.count} angles</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Angle Anatomy */}
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Target className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Top Angle Anatomy</p>
                        <p className="text-[10px] text-gray-400">Perspective breakdown for highest-ranked gaps</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {topAngles.map(angle => (
                        <div key={angle.rank} className="bg-gray-50 border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors">
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className={`text-[10px] text-white px-2 py-0.5 rounded-lg font-bold ${angle.rankBg}`}>{angle.rank}</span>
                            <span className="text-[11px] font-bold text-gray-900 tracking-wide truncate">{angle.label}</span>
                            <span className="ml-auto text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{angle.covered} covered</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {angle.dims.map(d => (
                              <div key={d.key} className="bg-white border border-gray-200 rounded-lg p-2">
                                <p className="text-[8px] text-gray-400 uppercase font-bold mb-0.5 tracking-wider">{d.key}</p>
                                <p className="text-[9px] text-gray-700 font-semibold leading-tight">{d.val}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="flex flex-col gap-4 min-h-0">
                  <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 overflow-auto hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-widest text-[#1d1d1f] uppercase">Gap Opportunities</p>
                        <p className="text-[10px] text-gray-400">Ranked by CAGS score — higher = more winnable, more demanded</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-[28px_52px_1fr_120px] gap-3 px-3 py-2 mb-1 border-b border-gray-100">
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">#</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">CAGS</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Angle · Suggested Title</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold text-right">Social Demand</span>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {gapOpportunities.map(item => {
                        const style = getScoreStyle(item.score);
                        const socialBar = Math.round(item.demand_score * 100);
                        return (
                          <div key={item.rank} className="grid grid-cols-[28px_52px_1fr_120px] gap-3 items-center p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-150">
                            <span className="text-gray-400 text-sm font-bold">{item.rank}</span>
                            <div className={`w-10 h-10 rounded-xl border-2 ${style.scoreBorder} flex items-center justify-center flex-shrink-0 bg-white`}>
                              <span className={`text-sm font-black ${style.scoreColor}`}>{Math.round(item.score)}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-gray-800 font-semibold mb-0.5 leading-tight">{item.angle}</p>
                              <p className="text-[10px] text-green-600 italic">&ldquo;{item.title}&rdquo;</p>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <p className="text-[9px] text-gray-400 uppercase tracking-widest">demand</p>
                              <div className="w-full h-2 rounded-full bg-gray-200">
                                <div className={`h-full rounded-full ${style.socialBarColor}`} style={{ width: `${socialBar}%` }} />
                              </div>
                              <span className={`text-[10px] font-bold ${style.scoreColor}`}>{item.demand_score.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </section>


      {/* ── Script Ideas Section ── */}
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-8 sm:py-12">

        {/* Header card */}
        <div className="bg-white border border-gray-200/80 rounded-3xl shadow-sm px-6 sm:px-8 py-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
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
                {filtered.length} idea{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-5 lg:sticky lg:top-24">
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Filter by</p>
              <div className="space-y-1.5">
                {['all', 'Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'].map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-between group ${
                        isActive
                          ? 'bg-[#1d1d1f] text-white'
                          : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                      }`}
                    >
                      <span>{category === 'all' ? 'All Categories' : category}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                    </button>
                  );
                })}
              </div>
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="mt-4 w-full text-center text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors py-1"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* Cards grid */}
          <div className="lg:col-span-3">

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
                {filtered.map((statement, idx) => (
                  <div
                    key={statement.id}
                    className="bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                  >
                    {/* Card header strip */}
                    <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                      <div className="flex items-start gap-4">
                        {/* Number badge */}
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
                      <p className="mt-3 text-sm text-[#6e6e73] leading-relaxed pl-12">{statement.description}</p>
                    </div>

                    {/* Card footer */}
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

                {filtered.length === 0 && (
                  <div className="bg-white border border-gray-200/80 rounded-2xl shadow-sm text-center py-14">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                        <Filter className="w-5 h-5 text-[#6e6e73]" />
                      </div>
                      <p className="text-sm text-[#6e6e73]">No ideas match this category</p>
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="text-xs font-semibold text-[#1d1d1f] border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-[#f5f5f7] transition-colors"
                      >
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

      <Footer />
    </div>
  );
}
