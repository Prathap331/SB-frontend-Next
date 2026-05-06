'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import ComingFeatures from '../components/ComingFeatures';
import Footer from '../components/Footer';
import { Search, TrendingUp } from 'lucide-react';
import StoryBitPipeline from '@/components/Architecture';
import { ApiService } from '@/services/api';
import CategorySlider from '@/components/CategorySlider';
import SuggestedTopics from '@/components/SuggestedTopics';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fallbackTrendingTopics = [
    'AI Revolution in Healthcare',
    'Climate Change Solutions',
    'Space Exploration Updates',
    'Cryptocurrency Market Trends',
    'Remote Work Future',
    'Renewable Energy Breakthrough',
    'Electric Vehicle Adoption',
    'Quantum Computing Advances',
    'Mental Health Awareness',
    'Cybersecurity Threats',
  ];

  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
  
    (async () => {
      try {
        const topics = await ApiService.getTrendingTopics(12);
  
        if (!mounted) return;
  
        setTrendingTopics(topics); // ✅ no fallback merge
      } catch (err) {
        console.error('Trending fetch failed:', err);
        // ❌ DO NOTHING (no fallback)
      } finally {
        if (mounted) setIsTrendingLoading(false);
      }
    })();
  
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = (topic: string) => {
    if (topic.trim()) {
      router.push(`/search/${encodeURIComponent(topic)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#f5f5f7] pt-10 pb-4 sm:pt-14 sm:pb-6 md:pt-20 md:pb-8 px-5 sm:px-8">
        {/* subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="w-[min(800px,100vw)] h-[400px] rounded-full bg-white/60 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* pill badge */}
          <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full my-4 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-Powered Script Writing
          </div>

          <h1
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#1d1d1f] mb-4 sm:mb-6 leading-[1.08] sm:leading-[1.05]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Write your YouTube
            <br className="hidden xs:block" />
            {' '}script in{' '}
            <span className="text-[#1d1d1f]">3 minutes.</span>
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl text-gray-800 mb-6 sm:mb-8 mx-auto leading-relaxed font-light px-2 sm:px-0"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            AI that transforms your ideas into engaging, factual,
            research-backed YouTube scripts.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center bg-white rounded-full shadow-lg shadow-black/[0.08] border border-gray-200/80 overflow-hidden transition-shadow hover:shadow-xl hover:shadow-black/[0.10] focus-within:shadow-xl focus-within:shadow-black/[0.12] focus-within:border-gray-300">
              <Search className="absolute left-4 sm:left-5 w-4 h-4 sm:w-5 sm:h-5 text-[#6e6e73] pointer-events-none flex-shrink-0" />
              <input
                type="text"
                placeholder="Search topics, events, ideas…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                className="flex-1 pl-10 sm:pl-12 pr-2 py-3 sm:py-4 text-sm sm:text-[15px] text-[#1d1d1f] placeholder-[#a1a1a6] bg-transparent outline-none font-normal min-w-0"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              />
              <div className="pr-1.5 sm:pr-2 flex-shrink-0">
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="bg-[#1d1d1f] hover:bg-black text-white text-[12px] sm:text-[13px] font-medium px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      {/* ── Trending Topics ── */}
      <section className="py-6 sm:py-10 px-5 sm:px-8 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2 items-center justify-center">
            {/* Label chip */}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black px-3 py-1.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Trending
            </span>

            {isTrendingLoading && trendingTopics.length === 0 ? (
              Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="text-[13px] font-medium text-grey-600 bg-[#ffffff] px-3.5 py-1.5 rounded-full opacity-60 animate-pulse"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Loading…
                </span>
              ))
            ) : (
              trendingTopics.slice(0, 12).map((topic, i) => (
              <button
                key={i}
                onClick={() => handleSearch(topic)}
                className="text-[13px] font-medium text-grey-600 bg-[#ffffff] hover:bg-[#ebebed] hover:text-[#1d1d1f] px-3.5 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              >
                {topic}
              </button>
              ))
            )}
          </div>
        </div>
      </section>
      </section>


      {/* ── Suggested Topics ── */}
      <section className="bg-white pt-10 sm:pt-14 md:pt-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 mb-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-1">
            Suggested Topics
          </h2>
          <p className="text-sm text-[#6e6e73] font-light">Click any card to analyse the trend and generate script ideas</p>
        </div>
        <SuggestedTopics />
      </section>

      {/* ── Top Content Categories ── */}
      <section className="bg-white pt-10 sm:pt-14 md:pt-16 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-2">
        Top Content Categories
      </h2>
      <CategorySlider />
      </div>
      </section>


      {/* ── Why it's different ── */}
      <section className="bg-white py-10 sm:py-14 md:py-16 px-5 sm:px-8  ">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f]"
              // style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
            >
              Why it&apos;s different.
            </h2>
            <p className="mt-3 text-[#6e6e73] text-base sm:text-lg font-light">
              A multi-agent pipeline purpose-built for depth and accuracy.
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-[#f5f5f7]">
            <StoryBitPipeline />
          </div>
        </div>
      </section>

      {/* ── Coming Features ── */}
      <ComingFeatures />

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
