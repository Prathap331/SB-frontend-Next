'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import ComingFeatures from '../components/ComingFeatures';
import Footer from '../components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, TrendingUp, BrainCircuit } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const [selectedType] = useState('news');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const trendingNews = [
    'AI Revolution in Healthcare',
    'Climate Change Solutions 2024',
    'Space Exploration Updates',
    'Cryptocurrency Market Trends',
    'Remote Work Future',
    'Renewable Energy Breakthrough',
    'Electric Vehicle Adoption',
    'Social Media Privacy Laws',
    'Quantum Computing Advances',
    'Global Food Security Crisis',
    'Mental Health Awareness',
    'Cybersecurity Threats 2024',
    'Green Technology Innovation',
    'Digital Banking Evolution',
    'Artificial Intelligence Ethics',
    'Sustainable Fashion Movement',
    'Smart City Development',
    'Gene Therapy Breakthroughs',
    'Virtual Reality Education',
    'Ocean Plastic Pollution'
  ];

  const documentaryTopics = [
    'Ocean Conservation Efforts',
    'Ancient Civilizations Mystery',
    'Wildlife Protection Stories',
    'Technology Evolution Timeline',
    'Human Psychology Insights',
    'Cultural Heritage Preservation',
    'Space Race Documentary',
    'Indigenous Communities',
    'Environmental Activism',
    'Scientific Discoveries',
    'Art History Exploration',
    'Music Evolution Journey',
    'Food Culture Around World',
    'Urban Development Stories',
    'Adventure Sports Culture',
    'Traditional Crafts Revival',
    'Medical Breakthroughs',
    'Educational Innovation',
    'Social Justice Movements',
    'Archaeological Discoveries'
  ];

  const handleSearch = (topic: string) => {

    if (topic.trim()) {
      router.push(`/search/${encodeURIComponent(topic)}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  // Show suggestions based on selected type
  const currentSuggestions = selectedType === 'news' ? trendingNews : documentaryTopics;

  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Hero Section - White Background */}
      <section className="bg-white flex items-center justify-center px-4 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto text-center bg-[#0c0d10]/90 py-6 sm:py-8 md:py-10 px-4 sm:px-6 md:px-12 lg:px-24 xl:px-36 pb-6 sm:pb-8 md:pb-10 rounded-lg">
          <h1 style={{ fontFamily: 'Noto Sans, sans-serif' }} className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 sm:mb-5 md:mb-6 leading-tight font-sans">
            Write Script for your YouTube Video in<br className="sm:hidden" /> 3 Minutes
            {/* <span className="bg-black text-white px-2 py-1 rounded text-3xl md:text-4xl font-semibold">
              3 Minutes
            </span> */}
          </h1>
          <p style={{ fontFamily: 'Noto Sans, sans-serif' }} className="text-xs sm:text-sm md:text-lg text-white mb-0 leading-relaxed max-w-5xl mx-auto font-normal px-2 sm:px-0">
          AI that transforms your ideas into engaging, factual, research-backed YouTube scripts.
          </p>
        </div>
      </section>


    {/* Main Content Section - Dark Background */}
    <section className="pb-3">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

            {/* Type Selection Toggle */}
            {/* <div className="flex justify-center mb-8">
              <div className="bg-white rounded-xl py-2 px-2 shadow-sm border border-gray-200">
                <div className="flex">
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedType('news')}
                    className={`px-5 py-5 text-lg font-medium font-sans transition-all duration-300 ease-in-out rounded-xl ${
                      selectedType === 'news' 
                        ? 'bg-gray-200 text-gray-800 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <Newspaper className="w-4 h-4 mr-2" />
                    New Stories
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelectedType('documentaries')}
                    className={`px-5 py-5 text-lg font-medium font-sans transition-all duration-300 ease-in-out rounded-xl ${
                      selectedType === 'documentaries' 
                        ? 'bg-gray-100 text-gray-800 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Film className="w-4 h-4 mr-2" />
                    Documentaries
                  </Button>
                </div>
              </div>
            </div> */}

            {/* Search Section */}
            <div className="max-w-4xl mx-auto mb-6 sm:mb-8 md:mb-10 shadow-lg border border-gray-400 rounded-lg mt-4">
              <div className="relative flex items-center">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 z-10" />
                <Input
                  type="text"
                  placeholder="Search for topics, current events, and documentary ideas"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  className="pl-10 sm:pl-12 md:pl-14 pr-20 sm:pr-24 md:pr-32 py-4 sm:py-5 md:py-7 text-xs sm:text-sm md:text-lg rounded-lg border-0 bg-white text-black placeholder-gray-500 focus:bg-white focus:ring-2 focus:ring-gray-400 font-sans w-full"
                />
                <Button
                  onClick={() => handleSearch(searchQuery)}
                  className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 rounded-lg bg-black text-white hover:bg-gray-800 hover:shadow-xl hover:scale-105 px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 text-xs sm:text-sm md:text-lg font-medium font-sans transition-all duration-300 ease-in-out"
                >
                  <span className="hidden sm:inline">Generate Ideas</span>
                  <span className="sm:hidden">Generate</span>
                </Button>
              </div>
            </div>

            {/* Trending Topics Section */}
            <div className="max-w-8xl mx-auto">
              <div className="flex justify-center">
                <div className="flex flex-wrap gap-2 sm:gap-3 items-center justify-center">
                  <Button
                    variant="outline"
                    className="h-auto px-3 sm:px-4 py-1 text-xs sm:text-base md:text-lg font-bold rounded-lg border-2 bg-black text-white whitespace-nowrap font-sans flex items-center pointer-events-none"
                  >
                    <span className="hidden sm:inline">Trending Topics</span>
                    <span className="sm:hidden">Trending</span>
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 ml-1" />
                  </Button>
                  {currentSuggestions.slice(0, 10).map((topic, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleSuggestionClick(topic)}
                      className="h-auto px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 text-xs sm:text-md md:text-base font-medium transition-all duration-300 ease-in-out transform rounded-lg border-0 bg-white text-gray-500 hover:bg-gray-50 hover:shadow-lg hover:scale-105 hover:-translate-y-1 whitespace-nowrap font-sans group shadow-lg"
                    >
                      <span className="transition-colors duration-300 group-hover:text-gray-800">
                        {topic}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
        </div>
      </section>

      {/* Why it is different? Section */}
      <section className="py-8 sm:py-10 md:py-12 bg-white">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <h2 style={{ fontFamily: 'Noto Sans, sans-serif' }} className="text-2xl sm:text-3xl md:text-4xl font-medium pl-0 sm:pl-4 md:pl-8 text-left mb-6 sm:mb-8 md:mb-12">Why it is different?</h2>

          <Image
  src="/flowDesign.jpeg"
  alt="flow design"
  width={0}
  height={0}
  sizes="100vw"
  className="w-full h-auto rounded-lg"
/>

          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            <div className="bg-[#1a1a1a] text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  Triggered Chain-of-Actions (TCA) Intelligence
              </h3>
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 w-full flex justify-center mb-4 md:mb-0">
                  <BrainCircuit className="w-2/3 sm:w-1/2 h-auto max-w-[120px] sm:max-w-none" />
                </div>
                <div className="md:w-1/2 w-full text-center md:text-left">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                    Unlike LLMs&#39; single-response model, our system runs multi-step reasoning workflows automatically
                  </p>
                  <Button variant="secondary" className="text-xs sm:text-sm">Read More</Button>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  Triggered Chain-of-Actions (TCA) Intelligence
              </h3>
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 w-full flex justify-center mb-4 md:mb-0">
                  <BrainCircuit className="w-2/3 sm:w-1/2 h-auto max-w-[120px] sm:max-w-none" />
                </div>
                <div className="md:w-1/2 w-full text-center md:text-left">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                    Unlike LLMs&#39; single-response model, our system runs multi-step reasoning workflows automatically
                  </p>
                  <Button variant="secondary" className="text-xs sm:text-sm">Read More</Button>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  Triggered Chain-of-Actions (TCA) Intelligence
              </h3>
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 w-full flex justify-center mb-4 md:mb-0">
                  <BrainCircuit className="w-2/3 sm:w-1/2 h-auto max-w-[120px] sm:max-w-none" />
                </div>
                <div className="md:w-1/2 w-full text-center md:text-left">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                    Unlike LLMs&#39; single-response model, our system runs multi-step reasoning workflows automatically
                  </p>
                  <Button variant="secondary" className="text-xs sm:text-sm">Read More</Button>
                </div>
              </div>
            </div>
            <div className="bg-[#1a1a1a] text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">
                  Triggered Chain-of-Actions (TCA) Intelligence
              </h3>
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 w-full flex justify-center mb-4 md:mb-0">
                  <BrainCircuit className="w-2/3 sm:w-1/2 h-auto max-w-[120px] sm:max-w-none" />
                </div>
                <div className="md:w-1/2 w-full text-center md:text-left">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base">
                    Unlike LLMs&#39; single-response model, our system runs multi-step reasoning workflows automatically
                  </p>
                  <Button variant="secondary" className="text-xs sm:text-sm">Read More</Button>
                </div>
              </div>
            </div>
          </div> */}
        </div>
      </section>

      {/* Features Section */}
      {/* <section className="py-12  bg-white border border-gray-600 mx-16 mb-12">
        <div className="container mx-auto px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Zap className="w-10 h-10 mb-4 text-black" />
              <h3 className="text-xl font-bold mb-2">Quick Generation</h3>
              <p>Create professional scripts in just 3 minutes</p>
            </div>
            <div className="flex flex-col items-center">
              <FileText className="w-10 h-10 mb-4 text-black" />
              <h3 className="text-xl font-bold mb-2">Research-Based</h3>
              <p>All content backed by factual research and data</p>
            </div>
            <div className="flex flex-col items-center">
              <Layers className="w-10 h-10 mb-4 text-black" />
              <h3 className="text-xl font-bold mb-2">Multiple Formats</h3>
              <p>News stories, documentaries, and <br/>more</p>
            </div>
          </div>
        </div>
      </section> */}

      {/* Coming Features Section */}
      <ComingFeatures />

      {/* Footer */}
      <Footer />
    </div>
  );
}
