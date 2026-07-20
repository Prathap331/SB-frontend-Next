'use client';

import { useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';

interface ApiFailCardProps {
  onRetry: () => void;
  /** 'banner' fits inside a page section, 'full' centers itself with more padding */
  variant?: 'banner' | 'full';
}

export function ApiFailCard({ onRetry, variant = 'banner' }: ApiFailCardProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    onRetry();
  };

  return (
    <div
      className={`afc-card relative overflow-hidden bg-white border border-gray-200/80 rounded-3xl shadow-sm text-center ${
        variant === 'full' ? 'px-8 py-12 max-w-lg mx-auto' : 'px-6 py-10 mb-6'
      }`}
    >
      {/* dotted backdrop + giant watermark */}
      <div className="afc-dots absolute inset-0 pointer-events-none" aria-hidden />
      <span
        className="absolute -top-4 left-1/2 -translate-x-1/2 text-[110px] leading-none font-black text-orange-500/[0.06] select-none pointer-events-none rotate-[-6deg]"
        aria-hidden
      >
        OOPS
      </span>

      <div className="relative flex flex-col items-center gap-5">
        {/* ── CSS robot mascot ── */}
        <div className="afc-float" aria-hidden>
          <div className="relative w-24 flex flex-col items-center">
            {/* antenna */}
            <div className="w-0.5 h-3 bg-[#1d1d1f] rounded-full" />
            <div className="afc-blink absolute -top-1.5 w-2.5 h-2.5 rounded-full bg-red-500" />
            {/* head */}
            <div className="afc-tilt w-20 h-16 rounded-2xl bg-[#1d1d1f] flex flex-col items-center justify-center gap-1.5 shadow-lg">
              <div className="flex items-center gap-3 text-orange-400 font-black text-base leading-none select-none">
                <span className="afc-eye">×</span>
                <span className="afc-eye afc-eye-2">×</span>
              </div>
              {/* wobbly mouth */}
              <div className="w-6 h-1.5 border-b-2 border-orange-400 rounded-[50%] rotate-180" />
            </div>
            {/* dizzy stars */}
            <span className="afc-star absolute -left-4 top-3 text-orange-400 text-sm select-none">✦</span>
            <span className="afc-star afc-star-2 absolute -right-4 top-1 text-orange-300 text-xs select-none">✦</span>
          </div>
          {/* shadow */}
          <div className="afc-shadow mx-auto mt-2 w-14 h-1.5 rounded-full bg-black/10" />
        </div>

        {/* ── unplugged cable gag ── */}
        <div className="flex items-center gap-2 text-gray-300" aria-hidden>
          <div className="w-12 sm:w-20 h-0.5 bg-gradient-to-r from-transparent to-gray-300 rounded-full" />
          <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />
          <Zap className="afc-zap w-4 h-4 text-orange-400" />
          <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300" />
          <div className="w-12 sm:w-20 h-0.5 bg-gradient-to-l from-transparent to-gray-300 rounded-full" />
        </div>

        {/* ── message ── */}
        <div>
          <h3 className="text-xl font-bold text-[#1d1d1f] mb-1.5">Oops! Something went wrong.</h3>
          <p className="text-sm text-[#6e6e73] leading-relaxed max-w-md mx-auto">
            The API failed to respond. Please try again.
          </p>
        </div>

        {/* ── action ── */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold hover:bg-black transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 transition-transform duration-500 group-hover:rotate-180 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Poking the server…' : 'Try Again'}
        </button>
      </div>

      <style>{`
        .afc-dots {
          background-image: radial-gradient(circle, rgba(29,29,31,0.05) 1px, transparent 1px);
          background-size: 18px 18px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
          -webkit-mask-image: linear-gradient(to bottom, black, transparent 70%);
        }
        .afc-float { animation: afc-float 3s ease-in-out infinite; }
        @keyframes afc-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        .afc-shadow { animation: afc-shadow 3s ease-in-out infinite; }
        @keyframes afc-shadow {
          0%, 100% { transform: scaleX(1); opacity: 1; }
          50% { transform: scaleX(0.7); opacity: 0.6; }
        }
        .afc-tilt { animation: afc-tilt 3s ease-in-out infinite; }
        @keyframes afc-tilt {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        .afc-blink { animation: afc-blink 1.2s step-end infinite; }
        @keyframes afc-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .afc-eye { display: inline-block; animation: afc-eye 2.6s ease-in-out infinite; }
        .afc-eye-2 { animation-delay: 0.15s; }
        @keyframes afc-eye {
          0%, 88%, 100% { transform: scaleY(1); }
          92%, 96% { transform: scaleY(0.1); }
        }
        .afc-star { animation: afc-star 2s ease-in-out infinite; }
        .afc-star-2 { animation-delay: 0.7s; }
        @keyframes afc-star {
          0%, 100% { opacity: 0.2; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(25deg); }
        }
        .afc-zap { animation: afc-zap 1.4s ease-in-out infinite; }
        @keyframes afc-zap {
          0%, 100% { opacity: 0.25; transform: scale(0.9); }
          45%, 55% { opacity: 1; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .afc-float, .afc-shadow, .afc-tilt, .afc-blink,
          .afc-eye, .afc-star, .afc-zap { animation: none; }
        }
      `}</style>
    </div>
  );
}
