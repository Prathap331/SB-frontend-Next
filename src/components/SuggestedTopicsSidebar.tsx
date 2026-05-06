'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown } from 'lucide-react';

const TOPICS = [
  {
    idea: 'Why Gen Z Is Rewriting the Rules of Work',
    description: 'From quiet quitting to side hustles at 22, the youngest workforce is forcing companies to rethink everything.',
    tags: ['#GenZ', '#Culture', '#Business'],
  },
  {
    idea: "The Science Behind Why You Can't Stop Scrolling",
    description: 'Dopamine loops, variable reward schedules, and the psychology app designers exploit to keep your eyes on screen.',
    tags: ['#Psychology', '#Technology'],
  },
  {
    idea: "How Ancient Rome's Fall Mirrors Modern America",
    description: 'Debt spirals, political polarisation, over-expansion — historians are drawing uncomfortable parallels.',
    tags: ['#History', '#Politics'],
  },
  {
    idea: 'AI Is Replacing Jobs — But Creating These New Ones',
    description: 'Prompt engineers, AI trainers, and synthetic media specialists are among the fastest-growing roles of 2025.',
    tags: ['#AI', '#FutureTech', '#Career'],
  },
  {
    idea: 'The Hidden Cost of Being a People Pleaser',
    description: 'People-pleasing quietly erodes self-esteem, fuels resentment, and wrecks relationships over time.',
    tags: ['#Psychology', '#SelfImprovement'],
  },
  {
    idea: 'Why Every Major Sport Is Obsessed With Analytics Now',
    description: 'From Moneyball to Brentford FC, data science flipped how teams scout talent, design plays and manage health.',
    tags: ['#Sports', '#DataScience'],
  },
  {
    idea: "The Richest 1% Are Quietly Moving Their Money Here",
    description: 'Ultra-high-net-worth individuals are shifting into private credit, farmland, and tokenised real estate.',
    tags: ['#Finance', '#Wealth', '#Investing'],
  },
  {
    idea: "Inside the Brains of the World's Best Decision Makers",
    description: 'Ravikant, Bezos, and Munger all use the same mental models. Breaking down what separates great thinkers.',
    tags: ['#Leadership', '#Philosophy'],
  },
];

const SCROLL_STEP = 160;

export default function SuggestedTopicsSidebar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(true);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop < el.scrollHeight - el.clientHeight - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    return () => el.removeEventListener('scroll', updateArrows);
  }, []);

  const scroll = (dir: 'up' | 'down') => {
    trackRef.current?.scrollBy({ top: dir === 'down' ? SCROLL_STEP : -SCROLL_STEP, behavior: 'smooth' });
  };

  const handleClick = (idea: string) => {
    const topic = idea.split(' ').slice(0, 6).join(' ');
    router.push(`/search/${encodeURIComponent(topic)}`);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Label */}
      <p className="text-[10px] font-semibold tracking-widest text-[#6e6e73] uppercase px-0.5 mb-1">
        Suggested Topics
      </p>

      {/* Up arrow */}
      <button
        onClick={() => scroll('up')}
        aria-label="Scroll up"
        className={`w-full h-7 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
          canScrollUp ? 'opacity-100' : 'opacity-30 pointer-events-none'
        }`}
      >
        <ChevronUp className="w-3.5 h-3.5 text-[#1d1d1f]" />
      </button>

      {/* Cards track */}
      <div
        ref={trackRef}
        className="flex flex-col gap-3 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TOPICS.map((t, i) => (
          <button
            key={i}
            onClick={() => handleClick(t.idea)}
            className="group w-full text-left bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150 flex-shrink-0"
          >
            <p className="text-xs font-semibold text-[#1d1d1f] leading-snug mb-1.5 line-clamp-2 group-hover:text-black">
              {t.idea}
            </p>
            <p className="text-[10px] text-[#6e6e73] font-light leading-relaxed line-clamp-2 mb-2">
              {t.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {t.tags.map(tag => (
                <span key={tag} className="text-[9px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-1.5 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Down arrow */}
      <button
        onClick={() => scroll('down')}
        aria-label="Scroll down"
        className={`w-full h-7 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center transition-all duration-200 hover:shadow-md hover:border-gray-300 ${
          canScrollDown ? 'opacity-100' : 'opacity-30 pointer-events-none'
        }`}
      >
        <ChevronDown className="w-3.5 h-3.5 text-[#1d1d1f]" />
      </button>
    </div>
  );
}
