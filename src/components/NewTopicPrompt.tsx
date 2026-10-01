'use client';

import { Search, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  /** Optional: focus the top search bar */
  onFocusSearch?: () => void;
  variant?: 'banner' | 'full';
  children?: ReactNode;
};

/**
 * Empty-state prompt shown when the user starts a new topic in the studio.
 * Visual language matches ApiFailCard (dotted backdrop, floated icon, centered CTA).
 */
export function NewTopicPrompt({ onFocusSearch, variant = 'banner', children }: Props) {
  return (
    <div
      className={`ntp-card relative overflow-visible bg-white border border-gray-200/80 rounded-3xl shadow-sm ${
        variant === 'full' ? 'px-8 py-10 max-w-lg mx-auto' : 'px-6 py-6 mb-6'
      }`}
    >
      <div className="ntp-dots absolute inset-0 rounded-3xl overflow-hidden pointer-events-none" aria-hidden />
      <span
        className="absolute -top-2 left-1/2 -translate-x-1/2 text-[56px] leading-none font-black text-amber-500/[0.07] select-none pointer-events-none rotate-[-6deg]"
        aria-hidden
      >
        NEW
      </span>

      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="ntp-float" aria-hidden>
          <div className="relative w-14 flex flex-col items-center">
            <div className="w-11 h-11 rounded-xl bg-[#1d1d1f] flex items-center justify-center shadow-md">
              <Search className="w-5 h-5 text-amber-400" strokeWidth={2.25} />
            </div>
            <span className="ntp-spark absolute -right-1.5 -top-0.5 text-amber-400 text-[10px] select-none">✦</span>
            <span className="ntp-spark ntp-spark-2 absolute -left-2 top-1.5 text-amber-300 text-[8px] select-none">✦</span>
          </div>
          <div className="ntp-shadow mx-auto mt-1.5 w-8 h-1 rounded-full bg-black/10" />
        </div>

        <div className="flex items-center gap-2 text-gray-300" aria-hidden>
          <div className="w-10 sm:w-16 h-0.5 bg-gradient-to-r from-transparent to-gray-300 rounded-full" />
          <Sparkles className="ntp-zap w-3.5 h-3.5 text-amber-400" />
          <div className="w-10 sm:w-16 h-0.5 bg-gradient-to-l from-transparent to-gray-300 rounded-full" />
        </div>

        <h3 className="text-lg font-bold text-[#1d1d1f]">Search a new topic</h3>

        <button
          type="button"
          onClick={onFocusSearch}
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <Search className="w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-110" />
          Start searching
        </button>
      </div>

      {children ? (
        <div className="relative mt-6 pt-5 border-t border-gray-100">
          {children}
        </div>
      ) : null}

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
          50% { transform: translateY(-4px); }
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
          50% { opacity: 1; transform: scale(1.15) rotate(16deg); }
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
