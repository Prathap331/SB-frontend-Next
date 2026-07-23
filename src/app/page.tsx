'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import ComingFeatures from '../components/ComingFeatures';
import Footer from '../components/Footer';
import { Search, ArrowUpRight, Globe, Newspaper } from 'lucide-react';
import StoryBitPipeline from '@/components/Architecture';
import { ApiService, TrendingTopic } from '@/services/api';
import CategorySlider from '@/components/CategorySlider';
import SuggestedTopics from '@/components/SuggestedTopics';
import RecommendedArticles from '@/components/blog/RecommendedArticles';
import { useKeywordNavigation } from '@/hooks/use-keyword-navigation';

type Tab = 'national' | 'international';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'national',      label: 'National News',      icon: <Newspaper className="w-3.5 h-3.5" /> },
  { id: 'international', label: 'International News', icon: <Globe     className="w-3.5 h-3.5" /> },
];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { searchPath, landingPath } = useKeywordNavigation();

  // ── Tab state ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('national');

  // Topics per tab
  const [nationalTopics,      setNationalTopics]      = useState<TrendingTopic[]>([]);
  const [internationalTopics, setInternationalTopics] = useState<TrendingTopic[]>([]);

  // Loading per tab
  const [loadingNational,      setLoadingNational]      = useState(true);
  const [loadingInternational, setLoadingInternational] = useState(false);

  // Track which tabs have been fetched already
  const [fetchedTabs, setFetchedTabs] = useState<Set<Tab>>(new Set());

  // ── Inline search warning popup ──────────────────────────────────
  const [searchWarning, setSearchWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!searchWarning) return;
    const timer = setTimeout(() => setSearchWarning(null), 3500);
    return () => clearTimeout(timer);
  }, [searchWarning]);

  // ── Initial load: National News ────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const topics = await ApiService.getNationalTopics();
        if (mounted) setNationalTopics(topics);
      } catch (err) {
        console.error('National fetch failed:', err);
      } finally {
        if (mounted) {
          setLoadingNational(false);
          setFetchedTabs(prev => new Set(prev).add('national'));
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Lazy load on tab switch ────────────────────────────────────
  useEffect(() => {
    if (fetchedTabs.has(activeTab)) return;

    let mounted = true;

    if (activeTab === 'international') {
      setLoadingInternational(true);
      ApiService.getInternationalTopics()
        .then(topics => { if (mounted) setInternationalTopics(topics); })
        .catch(err => console.error('International fetch failed:', err))
        .finally(() => {
          if (mounted) {
            setLoadingInternational(false);
            setFetchedTabs(prev => new Set(prev).add('international'));
          }
        });
    }

    return () => { mounted = false; };
  }, [activeTab, fetchedTabs]);

  // ── Helpers ────────────────────────────────────────────────────
  const activeTopics = activeTab === 'national' ? nationalTopics : internationalTopics;
  const isLoading = activeTab === 'national' ? loadingNational : loadingInternational;

  const handleSearch = (topic: any) => {
    const searchText = typeof topic === 'string' ? topic : topic?.tittle;
    if (searchText?.trim()) {
      router.push(searchPath(searchText));
    }
  };

  const handleGenerate = async () => {
    const wordCount = searchQuery
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    if (wordCount < 4) {
      setSearchWarning('For better AI responses, please describe your search using at least 4 words.');
      return;
    }

    setSearchWarning(null);
    router.push(searchPath(searchQuery));
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#f5f5f7] pt-10 pb-4 sm:pt-10 sm:pb-6 md:pt-14 md:pb-16 px-5 sm:px-8">
        {/* subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="w-[min(800px,100vw)] h-[400px] rounded-full " />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">

          <div className='flex flex-wrap sm:gap-2 mx-auto justify-center'>
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full my-2 sm:my-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              2000+ Digital creators
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full my-2 sm:my-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              40K+ Script Generated
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full my-2 sm:my-4 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Your AI Script Assistant
            </div>
          </div>

          <h1
            className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#1d1d1f] mb-4 sm:mb-6 leading-[1.08] sm:leading-[1.05]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Generate Your YouTube Video Content
            <br className="hidden xs:block" />
            {' '} in{' '}
            <span className="text-[#1d1d1f]">2 minutes.</span>
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl text-gray-800 mb-6 sm:mb-8 mx-auto leading-relaxed font-light px-2 sm:px-0"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            AI that transforms your ideas into engaging, factual,
            research-backed YouTube Content.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto relative">
            <div className="relative flex items-center bg-white rounded-full shadow-lg shadow-black/[0.08] border border-gray-200/80 overflow-hidden transition-shadow hover:shadow-xl hover:shadow-black/[0.10] focus-within:shadow-xl focus-within:shadow-black/[0.12] focus-within:border-gray-300">
              <Search className="absolute left-4 sm:left-5 w-4 h-4 sm:w-5 sm:h-5 text-[#6e6e73] pointer-events-none flex-shrink-0" />
              <input
                type="text"
                placeholder="Describe your search using at least 4 words for the best AI results."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchWarning) setSearchWarning(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                className="flex-1 pl-10 sm:pl-12 pr-2 py-3 sm:py-4 text-sm sm:text-[15px] text-[#1d1d1f] placeholder-[#a1a1a6] bg-transparent outline-none font-normal min-w-0"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              />

              <div className="pr-1.5 sm:pr-2 flex-shrink-0">
                <button
                   onClick={handleGenerate}
                   disabled={isLoading}
                  className="bg-[#1d1d1f] hover:bg-black text-white text-[12px] sm:text-[13px] font-medium px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Inline warning popup */}
            {searchWarning && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-30 w-[90%] sm:w-auto sm:max-w-sm animate-in fade-in slide-in-from-top-1 duration-200"
                role="alert"
              >
                <div className="relative bg-[#1d1d1f] text-white text-[12px] sm:text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-xl text-center leading-snug">
                  {/* arrow */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1d1d1f] rotate-45" />
                  {searchWarning}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Trending Topics with Tabs ── */}
        <section className="py-6 sm:py-10 px-5 sm:px-8 border-b border-gray-100">
          <div className="max-w-5xl mx-auto">

            {/* Tab row */}
            <div className="flex flex-wrap justify-center items-center gap-2 mb-5">
              <div className="flex items-center  gap-1.5 bg-white border border-gray-200 rounded-full px-1 py-1 shadow-sm">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium px-3 py-1 rounded-full transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-[#1d1d1f] text-white'
                        : 'text-black hover:text-black hover:bg-[#f5f5f7]'
                    }`}
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isLoading && activeTopics.length === 0 ? (
                Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="text-[13px] font-medium text-grey-600 bg-white px-3.5 py-1.5 rounded-full opacity-60 animate-pulse border border-gray-100"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    Loading…
                  </span>
                ))
              ) : activeTopics.length === 0 ? (
                <span
                  className="text-[13px] text-[#6e6e73] px-3.5 py-1.5"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  No topics available right now.
                </span>
              ) : (
                activeTopics.map(topic => (
                  <button
                    key={topic.id}
                    title={topic.regular_tittle}
                    onClick={() => handleSearch(topic.tittle)}
                    className="text-[13px] font-medium text-grey-600 bg-white hover:bg-[#ebebed] hover:text-[#1d1d1f] px-3.5 py-1.5 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] border border-gray-100"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  >
                    {topic.tittle}
                  </button>
                ))
              )}
            </div>

          </div>
        </section>
      </section>


      {/* ── Suggested Topics ── */}
      <section className="bg-white pt-10 sm:pt-14 md:pt-16 px-8 ">
        <div className="max-w-8xl mx-auto mb-6">
          <div className="flex items-center gap-4 mb-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
              Content Vault
            </h2>
            <button
              onClick={() => router.push(landingPath('/content-vault'))}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1d1d1f] bg-white border border-gray-200 hover:border-gray-400 hover:bg-[#f5f5f7] px-3 py-1.5 rounded-full transition-all duration-200 flex-shrink-0"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm text-[#6e6e73] font-light">Create Faster with Ready Scripts</p>
        </div>
        <SuggestedTopics />
      </section>

      {/* ── Top Content Categories ── */}
      <section className="bg-white pt-10 sm:pt-14 md:pt-16 px-8">
        <div className="max-w-8xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f] mb-2">
            Top Content Categories
          </h2>
          <CategorySlider />
        </div>
      </section>

      {/* ── Why it's different ── */}
      <section className="bg-white py-10 sm:py-14 md:py-16 px-8">
        <div className="max-w-8xl mx-auto">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
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

      {/* ── Recommended Articles ── */}
      <RecommendedArticles />

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}