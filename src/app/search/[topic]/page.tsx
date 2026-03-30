'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Clock, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { 
  Youtube, 
  User2, 
  Newspaper, 
} from 'lucide-react';
import { ApiService } from '@/services/api';
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
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <div className="w-full shadow-lg border border-gray-400 rounded-lg">
          <div className="relative flex items-center">
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
                   className="pl-10 sm:pl-12 md:pl-14 pr-20 sm:pr-24 md:pr-32 py-4 sm:py-5 md:py-7 text-xs sm:text-sm md:text-lg rounded-lg border-0 bg-white text-black placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-400 font-sans w-full"
                 />
                 <Button
                   onClick={handleSearchSubmit}
                   className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 rounded-lg bg-black text-white hover:bg-gray-800 hover:shadow-xl hover:scale-105 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-xs sm:text-sm md:text-lg font-medium font-sans transition-all duration-300 ease-in-out"
                 >
                   <span className="hidden sm:inline">Generate Ideas</span>
                   <span className="sm:hidden">Generate</span>
                 </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Analytics Section */}
      <section className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <Card className="shadow-xl border border-gray-200 bg-white h-[820px] overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {[
                { key: 'Trend strength score', label: 'Trend strength score' },
                { key: 'Content Saturation index', label: 'Content saturation index' },
                { key: 'Content angle gap score', label: 'Content angle gap score' },
              ].map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}                  
                  size="lg"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden pr-1 pb-6">
            <div className="flex h-full flex-col overflow-hidden">
              {activeTab === 'Trend strength score' && (
               <div className="grid grid-cols-1 lg:grid-cols-2  gap-4 overflow-auto">
                

                

                  {/* Trend Strength Score */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <p className="text-[12px] font-bold tracking-widest text-black uppercase mb-2">Trend Strength Score</p>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-green-600">51</span>
                      <span className="text-gray-400 text-sm mb-1">/100</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] px-2.5 py-0.5 rounded-full mb-3 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Rising
                    </span>
                    <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                      <strong className="text-gray-900">Publish now.</strong> Active upswing — early movers capture the highest reach before this topic saturates.
                    </p>
                    {/* Phase bar */}
                    <div className="flex gap-1 mb-4">
                      {['Flat', 'Emerging', 'Rising', 'Peak', 'Saturating'].map(p => (
                        <span key={p} className={`text-[9px] px-1.5 py-0.5 rounded flex-1 text-center font-medium ${p === 'Rising' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{p}</span>
                      ))}
                    </div>
                    {/* Score composition */}
                    <p className="text-[10px] text-black mb-2 uppercase tracking-widest">Score composition</p>
                    {[
                      { label: 'Base', display: '45', value: 45, max: 60, color: 'bg-green-500' },
                      { label: 'Psych boost', display: '+6', value: 6, max: 20, color: 'bg-green-400' },
                      { label: 'Reliability', display: '0.95', value: 0.95, max: 1, color: 'bg-blue-400' },
                    ].map(bar => (
                      <div key={bar.label} className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-gray-500 w-20 flex-shrink-0">{bar.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.value / bar.max) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-700 w-8 text-right font-medium">{bar.display}</span>
                      </div>
                    ))}
                  </div>

                  {/* Why It's Trending */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-bold tracking-widest text-black uppercase">Why It&apos;s Trending</p>
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[9px] px-2 py-0.5 rounded-full font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Creator surge
                      </span>
                    </div>
                    <div className="flex gap-3 mb-3">
                      <div className="space-y-1.5 flex-shrink-0">
                        {[
                          { label: 'Curiosity', active: false },
                          { label: 'Social wave', active: false },
                          { label: 'Creator surge', active: true },
                          { label: 'Breaking event', active: false },
                        ].map(f => (
                          <div key={f.label} className={`text-[10px] flex items-center gap-1 ${f.active ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                            <span>{f.active ? '●' : '✦'}</span>{f.label}
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-gray-900 text-sm font-bold mb-1">YouTube views doubled this week</p>
                        <p className="text-gray-500 text-xs leading-relaxed">Algorithm is surfacing this topic. Creators who publish in the next 48 hours capture the peak window. Social hasn&apos;t taken the lead yet.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {['YouTube video', 'TikTok / Reels', 'Publish now'].map((btn, i) => (
                        <span key={btn} className={`text-[10px] px-3 py-1 rounded-full cursor-pointer ${i === 2 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>{btn}</span>
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-400 mb-1.5 uppercase tracking-widest">Weights this scan · regime: creator surge</p>
                    <div className="flex gap-1.5">
                      {[
                        { label: 'Search', pct: '20%', active: false },
                        { label: 'Social', pct: '25%', active: false },
                        { label: 'YouTube', pct: '40%', active: true },
                        { label: 'News', pct: '15%', active: false },
                      ].map(w => (
                        <div key={w.label} className={`flex-1 rounded text-center px-1 py-1.5 ${w.active ? 'bg-blue-600' : 'bg-gray-100'}`}>
                          <p className={`text-[9px] uppercase ${w.active ? 'text-blue-100' : 'text-gray-400'}`}>{w.label}</p>
                          <p className={`text-xs font-bold ${w.active ? 'text-white' : 'text-gray-700'}`}>{w.pct}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                

                

                  {/* Platform Signals */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <p className="text-[12px] font-bold tracking-widest text-black uppercase mb-0.5">Platform Signals</p>
                    <p className="text-[11px] text-gray-800 mb-4">Where this topic is gaining momentum · leading signal highlighted</p>
                    <div className="space-y-4">
                      {[
                        { icon: Youtube, name: 'YouTube', sub: 'Video discovery', note: 'view accel 2.3× this week', tag: 'Leading', tagColor: 'bg-blue-600', score: 57, barW: 90, barColor: 'bg-blue-500' },
                        { icon: User2, name: 'Social', sub: 'Reddit · X/Twitter', note: 'post velocity 1.0× normal', tag: 'Normal', tagColor: 'bg-gray-400', score: 25, barW: 35, barColor: 'bg-gray-400' },
                        { icon: Search, name: 'Search', sub: 'Google Trends', note: 'search index 1.3× annual avg', tag: 'Mild', tagColor: 'bg-gray-400', score: 26, barW: 38, barColor: 'bg-gray-400' },
                        { icon: Newspaper, name: 'News', sub: 'NewsAPI · GDELT', note: 'articles 1.2× 90 day avg', tag: 'Quiet', tagColor: 'bg-gray-300', score: 20, barW: 28, barColor: 'bg-gray-300' },
                      ].map(signal => {
                          const Icon = signal.icon;

                          return(

                            <div key={signal.name} className="flex items-center gap-3">

<div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
  <Icon className="w-4 h-4" />
</div>
                            <div className="flex flex-col items-center gap-1 mb-1">
                              <span className="text-gray-900 text-xs font-semibold">{signal.name}</span>
                              <span className="text-[8px] text-gray-400 text-nowrap">{signal.sub}</span>
                            </div>
                          <div className="w-full flex flex-col gap-2 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-full h-1 rounded-full bg-gray-100">
                                <div className={`h-full rounded-full ${signal.barColor}`} style={{ width: `${signal.barW}%` }} />
                              </div>
                            </div>
                            <div className='flex w-full justify-between'>
                              <span className="text-[9px] text-gray-400 whitespace-nowrap">{signal.note}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded ${signal.tagColor} text-white flex-shrink-0`}>{signal.tag}</span>
                          </div>
                          </div>
                          <div className="text-right flex-shrink-0 w-10">
                            <p className="text-gray-900 text-sm font-bold">{signal.score}</p>
                            <p className="text-[9px] text-gray-400">score/100</p>
                          </div>
                        </div>
                        )
})}
                    </div>
                  </div>

                  {/* Signal Confidence — 2×2 grid */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-bold tracking-widest text-black uppercase">Signal Confidence</p>
                      <span className="text-[9px] text-green-600 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />All sources live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {[
                        { label: 'Search', detail: 'Live · 52 wks' },
                        { label: 'Social', detail: 'Live · 4 sources' },
                        { label: 'YouTube', detail: 'Live · 10 videos' },
                        { label: 'News', detail: 'Live · 90-day' },
                      ].map(src => (
                        <div key={src.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block mb-1.5" />
                          <p className="text-gray-900 text-sm font-bold">{src.label}</p>
                          <p className="text-[10px] text-gray-400">{src.detail}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mb-1.5">Reliability score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-green-500" style={{ width: '95%' }} />
                      </div>
                      <span className="text-xs text-gray-700 font-medium">0.95</span>
                    </div>
                  </div>
                </div>
            
            )}

            {activeTab === 'Content Saturation index' && (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-full overflow-auto">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-4">

                  {/* Content Saturation Index */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[10px] tracking-widest text-black font-bold uppercase mb-2">Content Saturation Index</p>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-orange-500">38</span>
                      <span className="text-gray-400 text-sm mb-1">/100</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] px-2.5 py-0.5 rounded-full mb-3 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Competitive
                    </span>
                    <p className="text-gray-500 text-xs mb-4 leading-relaxed">
                      <strong className="text-gray-900">Winnable with the right angle.</strong> Some dominant channels exist but no single lock-in. A well-executed video with an uncovered angle breaks through.
                    </p>
                    <div className="flex gap-1">
                      {['Open', 'Competitive', 'Crowded', 'Saturated'].map(p => (
                        <span key={p} className={`text-[9px] px-1 py-0.5 rounded flex-1 text-center font-medium ${p === 'Competitive' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{p}</span>
                      ))}
                    </div>
                  </div>

                  {/* Breakout Indicator */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[10px] tracking-widest text-black font-bold uppercase">Breakout Indicator</p>
                      <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 border border-orange-200 text-[9px] px-2 py-0.5 rounded-full font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Watch closely
                      </span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full border-2 border-orange-400 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-orange-500 font-bold text-lg leading-none">2</span>
                        <span className="text-[8px] text-gray-400">of 5</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Search at 2.1× 90-day baseline', active: true },
                          { label: 'YouTube views doubling WoW', active: true },
                          { label: 'Upload surge (24h window)', active: false },
                          { label: 'Engagement heat rising', active: false },
                          { label: 'View spike in 24h cohort', active: false },
                        ].map(item => (
                          <div key={item.label} className={`text-[10px] flex items-center gap-1.5 ${item.active ? 'text-black font-medium' : 'text-gray-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.active ? 'bg-orange-500' : 'bg-gray-300'}`} />
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="flex flex-col gap-4 min-h-0">

                  {/* Dimension Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-[10px] tracking-widest text-black font-bold uppercase mb-0.5">Dimension Breakdown</p>
                    <p className="text-[10px] text-gray-400 mb-3">What&apos;s driving the score — forces that open or close this topic</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          name: 'Supply pressure', weight: '25% weight',
                          effect: 'Closes', effectColor: 'bg-red-50 text-red-600 border border-red-200',
                          score: 58, scoreColor: 'text-red-500', barColor: 'bg-red-400', barW: 72,
                          status: 'Moderate', statusColor: 'bg-orange-100 text-orange-600',
                          desc: 'Decent volume exists. Upload rate manageable — not flooded. Creator field spread across ~41 channels.',
                        },
                        {
                          name: 'Audience demand', weight: '25% weight',
                          effect: 'Opens', effectColor: 'bg-green-50 text-green-700 border border-green-200',
                          score: 71, scoreColor: 'text-green-400', barColor: 'bg-green-400', barW: 88,
                          status: 'Strong', statusColor: 'bg-green-100 text-green-700',
                          desc: 'High search velocity from TSS. Daily views signal the algorithm is actively distributing this topic.',
                        },
                        {
                          name: 'Upload freshness', weight: '15% weight',
                          effect: 'Closes', effectColor: 'bg-red-50 text-red-600 border border-red-200',
                          score: 44, scoreColor: 'text-amber-500', barColor: 'bg-amber-400', barW: 55,
                          status: 'Mild flood', statusColor: 'bg-amber-100 text-amber-600',
                          desc: "Some uploads in 48h but not a surge. Topic isn't aggressively flooded — entry window still usable.",
                        },
                        {
                          name: 'Angle coverage', weight: '15% weight',
                          effect: 'Opens', effectColor: 'bg-green-50 text-green-700 border border-green-200',
                          score: 33, scoreColor: 'text-green-600', barColor: 'bg-green-600', barW: 40,
                          status: 'Gap exists', statusColor: 'bg-green-100 text-green-600',
                          desc: 'Corpus is semantically repetitive. A fresh perspective or sub-angle will stand out immediately.',
                        },
                        {
                          name: 'Viral ceiling', weight: '10% weight',
                          effect: 'Opens', effectColor: 'bg-green-50 text-green-700 border border-green-200',
                          score: 62, scoreColor: 'text-blue-600', barColor: 'bg-blue-500', barW: 75,
                          status: 'High ceiling', statusColor: 'bg-blue-100 text-blue-600',
                          desc: 'Top 5% of videos earn vastly more VPD than median — algorithm can produce breakout videos here.',
                        },
                        {
                          name: 'Quality gap', weight: '10% weight',
                          effect: 'Opens', effectColor: 'bg-green-50 text-green-700 border border-green-200',
                          score: 55, scoreColor: 'text-purple-600', barColor: 'bg-purple-400', barW: 68,
                          status: 'Opportunity', statusColor: 'bg-gray-100 text-gray-600',
                          desc: 'Incumbent videos underperform on engagement. Audiences served by age, not quality.',
                        },
                      ].map(dim => (
                        <div key={dim.name} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <div>
                              <p className="text-gray-900 text-xs font-bold">{dim.name}</p>
                              <p className="text-[9px] text-gray-400">{dim.weight}</p>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${dim.effectColor}`}>{dim.effect}</span>
                          </div>
                          <div className="h-1 rounded-full bg-gray-200 mb-2">
                            <div className={`h-full rounded-full ${dim.barColor}`} style={{ width: `${dim.barW}%` }} />
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xl font-bold ${dim.scoreColor}`}>{dim.score}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dim.statusColor}`}>{dim.status}</span>
                          </div>
                          <p className="text-[9px] text-gray-400 leading-relaxed">{dim.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Incumbent Health */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] tracking-widest text-black font-bold uppercase">Incumbent Health</p>
                      <p className="text-[10px] text-gray-400">Can a well-made video displace what&apos;s already ranking?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left: Engagement Gap + Creator Density */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] tracking-widest text-gray-400 uppercase mb-1">Engagement Gap</p>
                          <p className="text-3xl font-bold text-purple-600 mb-0.5">55%</p>
                          <p className="text-[10px] text-gray-500 mb-2">Incumbents underperform their tier benchmark</p>
                          <div className="h-1.5 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-purple-600" style={{ width: '55%' }} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] tracking-widest text-gray-400 uppercase mb-1">Creator Density</p>
                          <p className="text-3xl font-bold text-green-500 mb-0.5">0.55</p>
                          <p className="text-[10px] text-gray-500 mb-2">41 unique channels across 75 videos</p>
                          <div className="h-1.5 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-green-500" style={{ width: '55%' }} />
                          </div>
                        </div>
                      </div>
                      {/* Right: VPD Decay + Overall Verdict */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] tracking-widest text-gray-400 uppercase mb-1">VPD Decay</p>
                          <p className="text-3xl font-bold text-orange-500 mb-0.5">48%</p>
                          <p className="text-[10px] text-gray-500 mb-2">Top videos losing daily view momentum</p>
                          <div className="h-1.5 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-orange-400" style={{ width: '48%' }} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] tracking-widest text-gray-400 uppercase mb-1">Overall Verdict</p>
                          <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-[10px] px-2.5 py-1 rounded-full mb-1.5 font-medium">
                            ✓ Entry is viable
                          </span>
                          <p className="text-[10px] text-gray-500 leading-relaxed">Incumbents rely on age, not quality. A well-produced video has a clear displacement path.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Content angle gap score' && (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-full overflow-auto">

                {/* ── LEFT COLUMN ── */}
                <div className="flex flex-col gap-4">

                  {/* Content Angle Gap Score */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <span className="text-[9px] font-bold text-green-600">CONTENT LANDSCAPE</span>
                    <p className="text-[10px] tracking-widest text-black font-bold uppercase mb-2">Coverage distribution across 18 angles</p>
                    <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-green-600">18</span>
                    </div>
                   
                    <p className="text-[9px] tracking-widest text-gray-400 uppercase mb-2">Coverage distribution · 18 angles</p>
                    {[
                      { label: 'Not covered', count: 7, total: 18, color: 'bg-green-500', textColor: 'text-green-600' },
                      { label: 'Low quality', count: 6, total: 18, color: 'bg-amber-400', textColor: 'text-amber-600' },
                      { label: 'Well covered', count: 5, total: 18, color: 'bg-gray-300', textColor: 'text-gray-500' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                        <span className="text-[10px] text-gray-500 w-20 flex-shrink-0">{item.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.count / item.total) * 100}%` }} />
                        </div>
                        <span className={`text-[10px] font-medium ${item.textColor} w-14 text-right`}>{item.count} angles</span>
                      </div>
                    ))}

<span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-[9px] px-2.5 py-0.5 rounded-full mb-3 font-medium">
                      13 gap opportunities ranked below
                    </span>
                    
                    <span className='flex items-start gap-1.5 '>
                    <span className="w-3 h-1.5 rounded-full bg-green-500 mt-1" />
                    <p className=" text-gray-500 text-[10px] mb-4 leading-relaxed">
                     18 angles mapped — most remain uncovered or low quality. High CAGS = winnable + in-demand.
                    </p>
                    </span>
                  </div>

                  {/* Top Angle Anatomy */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1">
                    <p className="text-[10px] tracking-widest text-black font-bold uppercase mb-1">Top Angle Anatomy</p>
                    <p className="text-[10px] text-gray-400 mb-3">6-step perspective breakdown for highest-ranked gaps</p>
                    <div className="space-y-3">
                      {[
                        {
                          rank: '#1', rankBg: 'bg-green-500', label: 'Rural Communities',
                         covered: '0%',
                          dims: [
                            { key: 'WHO', val: 'Rural communities' },
                            { key: 'WHAT', val: 'Economics · Sociology' },
                            { key: 'WHEN', val: 'Present · National' },
                            { key: 'HOOK', val: 'Cause → Effect' },
                            { key: 'TENSION', val: 'Who gains / loses' },
                            { key: 'POV', val: 'Hidden angle' },
                          ],
                        },
                        {
                          rank: '#2', rankBg: 'bg-green-600', label: 'Fashion Workers',
                           covered: '0%',
                          dims: [
                            { key: 'WHO', val: 'Fashion workers' },
                            { key: 'WHAT', val: 'Labour · Policy' },
                            { key: 'WHEN', val: 'Present · Global' },
                            { key: 'HOOK', val: 'Trade-off' },
                            { key: 'TENSION', val: 'Corp. Influence' },
                            { key: 'POV', val: 'Crisis' },
                          ],
                        },
                        {
                          rank: '#3', rankBg: 'bg-amber-400', label: 'Gen Z Consumers', covered: '33%',
                          dims: [
                            { key: 'WHO', val: 'Gen Z consumers' },
                            { key: 'WHAT', val: 'Psychology · Sociology' },
                            { key: 'WHEN', val: 'Present · Global' },
                            { key: 'HOOK', val: '2nd-order effects' },
                            { key: 'TENSION', val: 'Inequality' },
                            { key: 'POV', val: 'Human story' },
                          ],
                        },
                      ].map(angle => (
                        <div key={angle.rank} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[9px] text-white px-1.5 py-0.5 rounded font-bold ${angle.rankBg}`}>{angle.rank}</span>
                            <span className="text-[10px] font-bold text-gray-900 uppercase tracking-wide">{angle.label}</span>
                            <span className="ml-auto text-[9px] text-gray-400">{angle.covered} covered</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {angle.dims.map(d => (
                              <div key={d.key} className="bg-white border border-gray-200 rounded p-1.5">
                                <p className="text-[7px] text-gray-400 uppercase mb-0.5">{d.key}</p>
                                <p className="text-[9px] text-gray-700 font-medium leading-tight">{d.val}</p>
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

                  {/* Gap Opportunities */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1 overflow-auto">
                    <p className="text-[10px] tracking-widest text-black font-bold uppercase mb-0.5">Gap Opportunities</p>
                    <p className="text-[10px] text-gray-400 mb-4">All angles ranked by CAGS score — higher = more winnable, more demanded</p>

                    {/* Table header */}
                    <div className="grid grid-cols-[32px_56px_1fr_110px] gap-3 px-3 mb-2">
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest">#</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest">CAGS</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest">Angle · Suggested Title</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest text-right">Social Demand</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        {
                          rank: 1, score: 91,
                          scoreColor: 'text-green-600', scoreBorder: 'border-green-400',
                          angle: 'Rural communities · economics & sociology · cause→effect of automation revealing cost-shifting by tech companies',
                          title: 'The Towns Mob Wife Forgot: What Fast Fashion Is Really Doing to Rural America',
                          tags: ['rural', 'economics', 'cause-effect', 'hidden angle'],
                          socialThreads: 23, socialScore: 0.91, socialBar: 91, socialBarColor: 'bg-green-500',
                        },
                        {
                          rank: 2, score: 84,
                          scoreColor: 'text-green-600', scoreBorder: 'border-green-400',
                          angle: 'Fashion industry workers · labour & policy · trade-off between fast fashion economics and sustainability',
                          title: 'Who Really Pays For Mob Wife Aesthetic? The Workers No One Talks About',
                          tags: ['workers', 'policy', 'trade-off'],
                          socialThreads: 18, socialScore: 0.75, socialBar: 75, socialBarColor: 'bg-green-400',
                        },
                        {
                          rank: 3, score: 73,
                          scoreColor: 'text-amber-600', scoreBorder: 'border-amber-400',
                          angle: 'Gen Z consumers · psychology & sociology · second-order effects of aesthetic identity cycles, manufactured nostalgia',
                          title: 'Why Gen Z Keeps Reviving Dead Aesthetics: The Psychology Behind Mob Wife',
                          tags: ['gen-z', 'psychology', '2nd-order'],
                          socialThreads: 12, socialScore: 0.65, socialBar: 65, socialBarColor: 'bg-amber-500',
                        },
                        {
                          rank: 4, score: 68,
                          scoreColor: 'text-amber-600', scoreBorder: 'border-amber-400',
                          angle: 'Independent designers · economics & entrepreneurship · feedback loop between viral aesthetics and small brand economics',
                          title: 'How Small Designers Are Cashing In (and Burning Out) On the Mob Wife Trend',
                          tags: ['designers', 'economics', 'feedback loop'],
                          socialThreads: 8, socialScore: 0.54, socialBar: 54, socialBarColor: 'bg-amber-500',
                        },
                        {
                          rank: 5, score: 61,
                          scoreColor: 'text-orange-500', scoreBorder: 'border-orange-400',
                          angle: 'Media critics · sociology & anthropology · risk scenario of aesthetic homogenisation via platform algorithm uniformity',
                          title: 'Is TikTok Killing Fashion Diversity? The Mob Wife Effect on Culture',
                          tags: ['critics', 'sociology', 'risk scenario'],
                          socialThreads: 7, socialScore: 0.48, socialBar: 48, socialBarColor: 'bg-amber-400',
                        },
                        {
                          rank: 6, score: 54,
                          scoreColor: 'text-orange-500', scoreBorder: 'border-orange-400',
                          angle: 'Brand marketers · business strategy · opportunity mapping for brands capitalising on the aesthetic cycle',
                          title: 'How Brands Are Quietly Winning (and Losing) the Mob Wife Aesthetic Race',
                          tags: ['brands', 'strategy', 'opportunity'],
                          socialThreads: 5, socialScore: 0.39, socialBar: 39, socialBarColor: 'bg-amber-400',
                        },
                        {
                          rank: 7, score: 47,
                          scoreColor: 'text-gray-500', scoreBorder: 'border-gray-300',
                          angle: 'Sustainability advocates · environment · lifecycle cost of fast fashion vs. thrifted aesthetics',
                          title: 'The Dirty Secret Behind the Mob Wife Look: Fast Fashion\'s Environmental Cost',
                          tags: ['sustainability', 'environment', 'lifecycle'],
                          socialThreads: 3, socialScore: 0.28, socialBar: 28, socialBarColor: 'bg-gray-400',
                        },
                      ].map(item => (
                        <div key={item.rank} className="grid grid-cols-[32px_56px_1fr_110px] gap-3 items-start p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                          <span className="text-gray-400 text-sm font-bold pt-0.5">{item.rank}</span>
                          <div className={`w-10 h-10 rounded-lg border-2 ${item.scoreBorder} flex items-center justify-center flex-shrink-0`}>
                            <span className={`text-sm font-bold ${item.scoreColor}`}>{item.score}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-700 font-medium mb-1 leading-relaxed">{item.angle}</p>
                            <p className="text-[10px] text-green-600 italic mb-2">&ldquo;{item.title}&rdquo;</p>
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map(tag => (
                                <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{tag}</span>
                              ))}
                            </div>
                          </div>
                          {/* Social Demand */}
                          <div className="flex flex-col gap-1.5 pt-0.5">
                            <p className="text-[9px] text-gray-400 uppercase tracking-widest">Social demand</p>
                            <div className="h-1 rounded-full bg-gray-200">
                              <div className={`h-full rounded-full ${item.socialBarColor}`} style={{ width: `${item.socialBar}%` }} />
                            </div>
                            <p className="text-[9px] text-gray-500">{item.socialThreads} threads · <span className="font-medium text-gray-700">{item.socialScore}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      </section>


      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Script Ideas for:{" "}
            <br className="sm:hidden" />
            <span className="inline-block bg-black text-white px-2 py-1 rounded font-semibold mt-2 sm:mt-0">
              {topic}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600">Choose from various problem statements and perspectives for your YouTube script</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Card className="shadow-lg lg:sticky lg:top-24">
              <CardContent className="space-y-6 pt-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Category</label>
                  <div className="space-y-2">
                    {['all', 'Technology', 'Social Impact', 'Economic Analysis', 'Historical', 'Future Analysis'].map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(category)}
                        className="w-full justify-start"
                        size="sm"
                      >
                        {category === 'all' ? 'All Categories' : category}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button onClick={() => setSelectedCategory('all')} variant="outline" className="w-full">
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <p className="text-sm sm:text-base text-gray-600">{isLoading ? 'Loading script ideas...' : `Found ${filtered.length} script ideas`}</p>
            </div>

            {isLoading && (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Script Ideas</h3>
                      <p className="text-gray-600">Our AI is analyzing &quot;{topic}&quot; and creating personalized script ideas for you...</p>
                      <p className="text-sm text-gray-500 mt-2">This may take up to 5 minutes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="text-center py-8 border-black-200 bg-black-50 mb-6">
                <CardContent>
                  <div className="flex flex-col items-center space-y-4">
                    <AlertCircle className="w-6 h-6 text-black" />
                    <div>
                      <h3 className="text-lg font-semibold text-black mb-2">API Temporarily Unavailable</h3>
                      <p className="text-black mb-4">{error}</p>
                      <Button onClick={() => window.location.reload()} variant="outline" className="border-black text-black hover:bg-gray-100">
                        Try Again
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && (
              <div className="space-y-6">
                {filtered.map((statement) => (
                  <Card key={statement.id} className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/80 backdrop-blur-sm">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-4">
                        <div className="flex-1 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                            <CardTitle className="text-lg sm:text-xl">
                              {statement.title}
                            </CardTitle>
                            <Badge variant="secondary" className="bg-black text-white">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Trending
                            </Badge>
                          </div>
                          <CardDescription className="text-gray-600 leading-relaxed">{statement.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <Badge variant="secondary">{statement.category}</Badge>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                          <div className="flex items-center space-x-2">
                            <label className="text-sm font-medium text-gray-700">Length (min):</label>
                            <Input type="number" placeholder="10" value={videoLengths[statement.id] || ''} onChange={(e) => handleVideoLengthChange(statement.id, e.target.value)} className="w-20" min={1} max={60} />
                          </div>
                          <Button onClick={() => handleGenerateScript(statement)} className="bg-gradient-to-r from-gray-500 to-black hover:from-gray-600 hover:to-black text-white font-semibold w-full sm:w-auto" disabled={!videoLengths[statement.id]?.trim()} size="sm">
                            <Clock className="w-4 h-4 mr-2" />
                            Generate Script
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {filtered.length === 0 && (
                  <Card className="text-center py-12">
                    <CardContent>
                      <p className="text-gray-500 text-lg mb-4">No scripts match your current filters</p>
                      <Button onClick={() => setSelectedCategory('all')} variant="outline">Reset Filters</Button>
                    </CardContent>
                  </Card>
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
