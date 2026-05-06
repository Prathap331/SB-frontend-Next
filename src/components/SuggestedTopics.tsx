'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TOPICS = [
  {
    idea: 'Why Gen Z Is Rewriting the Rules of Work',
    description: 'From quiet quitting to building side hustles at 22, explore how the youngest workforce is forcing companies to rethink everything about jobs.',
    tags: ['#GenZ', '#Culture', '#Business'],
  },
  {
    idea: "The Science Behind Why You Can't Stop Scrolling",
    description: 'Dopamine loops, variable reward schedules, and the psychology that app designers deliberately exploit to keep your eyes on the screen.',
    tags: ['#Psychology', '#Technology', '#MentalHealth'],
  },
  {
    idea: "How Ancient Rome's Fall Mirrors Modern America",
    description: 'Debt spirals, political polarisation, over-expansion — historians are drawing uncomfortable parallels between the Roman Empire and today.',
    tags: ['#History', '#Politics', '#Society'],
  },
  {
    idea: 'AI Is Replacing Jobs — But Creating These New Ones',
    description: 'While automation closes some doors, prompt engineers, AI trainers, and synthetic media specialists are among the fastest-growing roles of 2025.',
    tags: ['#AI', '#FutureTech', '#Career'],
  },
  {
    idea: 'The Hidden Cost of Being a People Pleaser',
    description: 'People-pleasing feels like kindness, but research shows it quietly erodes self-esteem, fuels resentment, and wrecks relationships over time.',
    tags: ['#Psychology', '#SelfImprovement', '#Relationships'],
  },
  {
    idea: 'Why Every Major Sport Is Obsessed With Analytics Now',
    description: 'From Moneyball to Brentford FC, data science has flipped how teams scout talent, design plays, and even manage player health.',
    tags: ['#Sports', '#DataScience', '#Strategy'],
  },
  {
    idea: "The Richest 1% Are Quietly Moving Their Money Here",
    description: "Ultra-high-net-worth individuals are shifting assets into private credit, farmland, and tokenised real estate — and here's exactly why.",
    tags: ['#Finance', '#Wealth', '#Investing'],
  },
  {
    idea: "Inside the Brains of the World's Best Decision Makers",
    description: 'Naval Ravikant, Jeff Bezos, and Munger all use the same mental models. Breaking down the frameworks that separate great thinkers from the rest.',
    tags: ['#Leadership', '#Philosophy', '#Mindset'],
  },
];

const CARD_GAP = 16;

export default function SuggestedTopics() {
  const trackRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const cardW = el.querySelector('button')?.offsetWidth ?? 288;
    el.scrollBy({ left: dir === 'right' ? cardW + CARD_GAP : -(cardW + CARD_GAP), behavior: 'smooth' });
  };

  const handleCardClick = (idea: string) => {
    const topic = idea.split(' ').slice(0, 6).join(' ');
    router.push(`/search/${encodeURIComponent(topic)}`);
  };

  return (
    <div className="relative w-full">
      {/* Left arrow */}
      <button
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:scale-105 ${
          canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronLeft className="w-4 h-4 text-[#1d1d1f]" />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:scale-105 ${
          canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <ChevronRight className="w-4 h-4 text-[#1d1d1f]" />
      </button>

      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-16 z-10 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-16 z-10 bg-gradient-to-l from-white to-transparent" />

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 px-8 pb-3 pt-1 overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {TOPICS.map((t, i) => (
          <button
            key={i}
            onClick={() => handleCardClick(t.idea)}
            className="group flex-shrink-0 snap-start w-64 sm:w-72 text-left bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
          >
            <p className="text-sm font-semibold text-[#1d1d1f] leading-snug mb-2 group-hover:text-black">
              {t.idea}
            </p>
            <p className="text-[11px] text-[#6e6e73] font-light leading-relaxed line-clamp-3 mb-4">
              {t.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {t.tags.map(tag => (
                <span key={tag} className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
