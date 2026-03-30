'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import ComingFeatures from '../components/ComingFeatures';
import Footer from '../components/Footer';
import { Search, TrendingUp } from 'lucide-react';
import StoryBitPipeline from '@/components/Architecture';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const trendingTopics = [
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

  const handleSearch = (topic: string) => {
    if (topic.trim()) {
      router.push(`/search/${encodeURIComponent(topic)}`);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#f5f5f7] pt-2 pb-2 px-5 sm:px-8">
        {/* subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="w-[800px] h-[500px] rounded-full bg-white/60 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* pill badge */}
          <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            AI-Powered Script Writing
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#1d1d1f] mb-6 leading-[1.05]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Write your YouTube
            <br />
            script in{' '}
            <span className="text-[#1d1d1f]">3 minutes.</span>
          </h1>

          <p
            className="text-lg sm:text-xl text-[#6e6e73] mb-12 mx-auto leading-relaxed font-light"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            AI that transforms your ideas into engaging, factual,
            research&#8209;backed YouTube scripts.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center bg-white rounded-2xl shadow-lg shadow-black/[0.08] border border-gray-200/80 overflow-hidden transition-shadow hover:shadow-xl hover:shadow-black/[0.10] focus-within:shadow-xl focus-within:shadow-black/[0.12] focus-within:border-gray-300">
              <Search className="absolute left-5 w-5 h-5 text-[#6e6e73] pointer-events-none flex-shrink-0" />
              <input
                type="text"
                placeholder="Search topics, events, documentary ideas…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                className="flex-1 pl-14 pr-4 py-4 text-[15px] text-[#1d1d1f] placeholder-[#a1a1a6] bg-transparent outline-none font-normal"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              />
              <div className="pr-2">
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-medium px-5 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      {/* ── Trending Topics ── */}
      <section className="py-10 px-5 sm:px-8 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap gap-2 items-center justify-center">
            {/* Label chip */}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-black px-3 py-1.5 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              Trending
            </span>

            {trendingTopics.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleSearch(topic)}
                className="text-[13px] font-medium text-grey-600 bg-[#ffffff] hover:bg-[#ebebed] hover:text-[#1d1d1f] px-3.5 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </section>
      </section>


      {/* ── Why it's different ── */}
      <section className="bg-white py-16 sm:py-10 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <h2
              className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
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
