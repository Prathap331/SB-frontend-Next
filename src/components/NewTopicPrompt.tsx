'use client';

import { Search, Sparkles } from 'lucide-react';

type Props = {
  /** Optional: focus the top search bar */
  onFocusSearch?: () => void;
  variant?: 'banner' | 'full';
};

/**
 * Empty-state prompt shown when the user starts a new topic in the studio.
 * Visual language matches ApiFailCard (dotted backdrop, floated icon, centered CTA).
 */
export function NewTopicPrompt({ onFocusSearch, variant = 'banner' }: Props) {
  return (
    <div
      className={`ntp-card relative overflow-hidden bg-white border border-gray-200/80 rounded-3xl shadow-sm text-center ${
        variant === 'full' ? 'px-8 py-12 max-w-lg mx-auto' : 'px-6 py-10 mb-6'
      }`}
    >
      <div className="ntp-dots absolute inset-0 pointer-events-none" aria-hidden />
      <span
        className="absolute -top-4 left-1/2 -translate-x-1/2 text-[100px] leading-none font-black text-amber-500/[0.07] select-none pointer-events-none rotate-[-6deg]"
        aria-hidden
      >
        NEW
      </span>

      <div className="relative flex flex-col items-center gap-5">
        <div className="ntp-float" aria-hidden>
          <div className="relative w-24 flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-[#1d1d1f] flex items-center justify-center shadow-lg">
              <Search className="w-9 h-9 text-amber-400" strokeWidth={2.25} />
            </div>
            <span className="ntp-spark absolute -right-2 -top-1 text-amber-400 text-lg select-none">✦</span>
            <span className="ntp-spark ntp-spark-2 absolute -left-3 top-3 text-amber-300 text-sm select-none">✦</span>
          </div>
          <div className="ntp-shadow mx-auto mt-2 w-14 h-1.5 rounded-full bg-black/10" />
        </div>

        <div className="flex items-center gap-2 text-gray-300" aria-hidden>
          <div className="w-12 sm:w-20 h-0.5 bg-gradient-to-r from-transparent to-gray-300 rounded-full" />
          <Sparkles className="ntp-zap w-4 h-4 text-amber-400" />
          <div className="w-12 sm:w-20 h-0.5 bg-gradient-to-l from-transparent to-gray-300 rounded-full" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-[#1d1d1f] mb-1.5">Search a new topic</h3>
          <p className="text-sm text-[#6e6e73] leading-relaxed max-w-md mx-auto">
            Type any idea in the search bar above — a niche, a news story, a curiosity —
            and we&apos;ll generate fresh content ideas ready for YouTube.
          </p>
        </div>

        <button
          type="button"
          onClick={onFocusSearch}
          className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Search className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
          Start searching
        </button>

        <p className="text-[11px] text-[#a1a1a6] font-light">
          Tip: be specific — e.g. &ldquo;forgotten inventions that changed the world&rdquo;
        </p>
      </div>

      <style>{`
        .ntp-dots {
          background-image: radial-gradient(circle, rgba(29,29,31,0.05) 1px, transparent 1px);
          background-size: 18px 18px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
          -webkit-mask-image: linear-gradient(to bottom, black, transparent 70%);
        }
        .ntp-float { animation: ntp-float 3s ease-in-out infinite; }
        @keyframes ntp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        .ntp-shadow { animation: ntp-shadow 3s ease-in-out infinite; }
        @keyframes ntp-shadow {
          0%, 100% { transform: scaleX(1); opacity: 1; }
          50% { transform: scaleX(0.7); opacity: 0.6; }
        }
        .ntp-spark { animation: ntp-spark 2s ease-in-out infinite; }
        .ntp-spark-2 { animation-delay: 0.7s; }
        @keyframes ntp-spark {
          0%, 100% { opacity: 0.25; transform: scale(0.85) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(20deg); }
        }
        .ntp-zap { animation: ntp-zap 1.6s ease-in-out infinite; }
        @keyframes ntp-zap {
          0%, 100% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ntp-float, .ntp-shadow, .ntp-spark, .ntp-zap { animation: none; }
        }
      `}</style>
    </div>
  );
}
