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
  const [activeTab, setActiveTab] = useState<'Keyword analysis' | 'competitor' | 'meta'>('Keyword analysis');
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
        <Card className="shadow-xl border border-gray-200 bg-white h-[800px] overflow-hidden flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 mb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-gray-900 bg-gray-100 p-2 rounded-lg">Summary :</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {[
                { key: 'Keyword analysis', label: 'Keyword analysis' },
                { key: 'competitor', label: 'Competitor content analysis' },
                { key: 'meta', label: 'Meta analysis' },
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
              {activeTab === 'Keyword analysis' && (
              <div className="flex h-full flex-col space-y-6 overflow-hidden">
                <div className="flex flex-wrap gap-3">
                <Button
  onClick={() => handleClick("category")}
  className={`
    rounded-3xl border text-black 
     hover:bg-gray-200
    ${activeButton === "category" 
      ? "bg-gray-200 text-black" 
      : "bg-white text-black "  }                          
  `}
>
  Filter by Category
</Button>

<Button
  onClick={() => handleClick("status")}
  className={`
    rounded-3xl border text-black 
     hover:bg-gray-200
    ${activeButton === "status" 
      ? "bg-gray-200 text-black" 
      : "bg-white text-black" }                          
  `}
>
  Filter by Status
</Button>

                </div>
                 <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr] flex-1 min-h-0">
                   <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                     <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-[#F5F7FB]">
                          <tr className="text-left text-xs sm:text-sm text-gray-500">
                            <th className="px-4 sm:px-6 py-4 font-semibold">Keyword</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold">Volume</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold">Diffuculty</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold">Trend</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold">Velocity</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold">Intent</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm sm:text-base text-gray-700">
  {KeywordanalysisProducts.map((item, index) => (
    <tr key={index} className="bg-white hover:bg-[#F9FAFE] transition">
      <td className="px-4 sm:px-6 py-4 font-semibold text-gray-900">
        {item.id}
      </td>
      <td className="px-4 sm:px-6 py-4">{item.volume}</td>
      <td className="px-4 sm:px-6 py-4">{item.difficulty}</td>
      <td className="px-4 sm:px-6 py-4">{item.trend}</td>

      {/* Velocity Badge */}
      <td className="px-4 sm:px-6 py-4 ">
      <span
  className={`
    flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-center
    ${
      item.velocity === "Low"
        ? "bg-red-600 text-white"
        : item.velocity === "Very High"
        ? "bg-green-700 text-white"
        : item.velocity === "High"
        ? "bg-green-500 text-white"
        : "bg-yellow-400 text-white" // Medium
    }
  `}
>
  {item.velocity === "Low" ? (
    <TrendingDown className="w-3 h-3" />
  ) : (
    <TrendingUp className="w-3 h-3" />
  )}

  {item.velocity}
</span>

      </td>

      {/* Intent Column */}
      <td className="px-4 sm:px-6 py-4">
        <div className="flex flex-col">
          <span className="font-semibold">{item.intentType}</span>
          <span className="text-gray-500 text-xs">{item.intentDesc}</span>
        </div>
      </td>
    </tr>
  ))}
</tbody>

                      </table>
                    </div>
                  </div>
                  <div className="rounded-2xl border flex flex-col min-h-0 ">
                    <div className="p-4 sm:p-4 flex-1 overflow-y-auto min-h-0">

    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-100 bg-gray-800 px-3 py-2.5 rounded">
        Traffic by location
      </h3>

    </div>

    {/* Table */}
    <table className="w-full text-sm">
      <thead>
        <tr className="text-black text-xs border-b border-gray-700 ">
          <th className="py-2 text-left">Location</th>
          <th className="py-2 text-left">Traffic</th>
          <th className="py-2 text-left">Share</th>
        </tr>
      </thead>

      <tbody>
        {trafficByLocation.map((row, idx) => (
          <tr key={row.country}>
            <td className="py-3 flex items-center  gap-2 font-medium text-black">
              <span className="text-lg">{row.flag}</span>
              {row.country}
            </td>

            <td className="py-3 text-black">
              {row.traffic}
              <span className="text-green-400 ml-1">{row.trafficGrowth}</span>
            </td>

            <td className="py-3 text-black">{row.share}</td>

          </tr>
        ))}
      </tbody>
    </table>

    {/* Footer link */}
    <div className="text-center text-black hover:text-gray-400 text-sm mt-4 cursor-pointer">
      &gt; Compare top 5 on chart
    </div>
  </div>
</div>

                </div>
              </div>
            )}

            {activeTab === 'competitor' && (
              <div className="flex h-full flex-col space-y-6 overflow-hidden">
                <div className="grid flex-1 min-h-0 gap-6 md:grid-cols-2 md:grid-rows-2">
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-[#F5F7FB] text-xs sm:text-sm text-gray-500">
                          <tr>
                            <th className="px-4 sm:px-6 py-4 font-semibold text-left">Authority</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold text-left">Category</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold text-left">Views</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold text-left">Range</th>
                            <th className="px-4 sm:px-6 py-4 font-semibold text-left">Engagement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm sm:text-xs text-gray-700">
                        {competitorVideos.map((video) => (
  <tr key={video.id} className="bg-white hover:bg-[#F9FAFE] transition font-semibold">

    {/* Authority Badge */}
    <td className="px-4 sm:px-6 py-4 flex items-center justify-center">
      <span
        className={`
          flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-center
          ${
            video.authority === "Low Authority"
              ? "bg-red-600 text-white"
              : video.authority === "High Authority"
              ? "bg-green-600 text-white"
              : "bg-yellow-400 text-white"
          }
        `}
      >
        {video.authority}
      </span>
    </td>

    <td className="px-4 sm:px-6 py-4">{video.category}</td>
    <td className="px-4 sm:px-6 py-4">{video.views}</td>
    <td className="px-4 sm:px-6 py-4">{video.range}</td>
    <td className="px-4 sm:px-6 py-4">{video.engagement}</td>
  </tr>
))}

                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Content Angles</h3>
                      <div className="space-y-3 text-sm sm:text-base">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-[#F5F7FB] text-xs sm:text-sm text-gray-500">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Authority</th>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm sm:text-xs text-gray-700">
                        
  <tr className="bg-white hover:bg-[#F9FAFE] transition font-semibold">
    <td className="px-4 sm:px-6 py-2">85%</td>
    <td className="px-4 sm:px-6 py-2">25%</td>
  </tr>


                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Links</h3>
                    <div className="flex gap-4 overflow-x-auto scrollbar-none py-2">
      {videos.map((video, index) => (
        <a
          key={index}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-[220px] rounded border border-gray-400 bg-white  shadow-md flex-shrink-0 hover:shadow-lg transition"
        >
          {/* Thumbnail */}
          <img
            src={video.thumbnail}
            alt={video.title}
            className="rounded w-full h-42 object-cover mb-1"
          />

          {/* Title */}
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 p-2">
            {video.title}
          </p>
        </a>
      ))}
    </div>

                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Comment Analysis</h3>
                      <div className="space-y-3">
                      {performanceKeywords.map((keyword) => (
  <div key={keyword.keyword} className="space-y-2">
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>{keyword.keyword}</span>
      <span className="font-medium text-gray-900">{keyword.value}%</span>
    </div>

    {/* Progress Bar */}
    <div className="h-2 rounded-full bg-[#cccccc] overflow-hidden"> {/* Dark Gray */}
      <div
        className="h-full rounded-full bg-[#444444]"               /* Light Gray */
        style={{ width: `${keyword.value}%` }}
      />
    </div>
  </div>
))}

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="flex h-full flex-col space-y-6 overflow-hidden">
                <div className="grid flex-1 min-h-0 gap-6 md:grid-cols-2 md:grid-rows-2">
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-[#F5F7FB] text-xs sm:text-sm text-gray-500">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Month</th>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Revenue</th>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Growth</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm sm:text-base text-gray-700">
                          {metaReports.map((report) => (
                            <tr key={report.month} className="bg-white hover:bg-[#F9FAFE] transition">
                              <td className="px-4 sm:px-6 py-2 font-semibold text-gray-900">{report.month}</td>
                              <td className="px-4 sm:px-6 py-2">{report.revenue}</td>
                              <td className="px-4 sm:px-6 py-2 text-[#288B4A] font-semibold">{report.growth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Content Angles</h3>
                      <div className="space-y-3 text-sm sm:text-base">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-[#F5F7FB] text-xs sm:text-sm text-gray-500">
                          <tr>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Authority</th>
                            <th className="px-4 sm:px-6 py-3 font-semibold text-left">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm sm:text-xs text-gray-700">
                        
  <tr className="bg-white hover:bg-[#F9FAFE] transition font-semibold">
    <td className="px-4 sm:px-6 py-2">85%</td>
    <td className="px-4 sm:px-6 py-2">25%</td>
  </tr>


                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
  <div className="flex-1 min-h-0 flex flex-col p-8 overflow-y-auto">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Intent</h3>

    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius="0%"
            outerRadius="100%"
            paddingAngle={1}
            label={renderLabel}
            labelLine={false}
          >
            {pieData.map((entry, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
       <div className="mt-4 text-gray-600 text-sm">Total Allocation Overview</div>
    </div>

  </div>
</div>

                  <div className="rounded-2xl border border-gray-300 flex flex-col overflow-hidden min-h-0">
                    <div className="p-6 flex-1 min-h-0 overflow-y-auto">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Highlights</h3>
                      <ul className="space-y-3 text-sm sm:text-base text-gray-600">
                        {monthlyHighlights.map((highlight) => (
                          <li key={highlight} className="flex items-start gap-2 items-center">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#444444]" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
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
