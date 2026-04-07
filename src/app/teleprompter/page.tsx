"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";

export default function Teleprompter() {
  const [script, setScript] = useState("");
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const text = sessionStorage.getItem("teleprompter_script");
    if (text) setScript(text);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setPosition((prev) => prev + speed * 0.8);
    }, 16);
    return () => clearInterval(interval);
  }, [speed, playing]);

  const reset = () => {
    setPosition(0);
    setPlaying(false);
  };

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">

      {/* Script scroll area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        {/* Center guide line */}
        <div className="absolute top-1/2 left-0 right-0 border-t border-white/5 z-10 pointer-events-none" />

        <div
          ref={containerRef}
          className="absolute w-full px-8 sm:px-16 md:px-32 lg:px-48 text-center"
          style={{ transform: `translateY(calc(45vh - ${position}px))` }}
        >
          <p
            className="text-2xl sm:text-3xl md:text-4xl leading-[1.8] font-light tracking-wide whitespace-pre-wrap"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
          >
            {script || "No script loaded. Go back and generate a script first."}
          </p>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-t border-white/10 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">

          {/* Reset */}
          <button
            onClick={reset}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={() => setPlaying(!playing)}
            className="w-12 h-12 rounded-full bg-white text-[#0a0a0a] hover:bg-gray-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0 shadow-lg"
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Speed */}
          <div className="flex-1 flex items-center gap-3">
            <button onClick={() => setSpeed(s => Math.max(0.5, +(s - 0.5).toFixed(1)))} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex-1 flex flex-col items-center gap-1">
              <input
                type="range" min="0.5" max="5" step="0.5" value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-white"
                style={{ background: `linear-gradient(to right, white ${((speed - 0.5) / 4.5) * 100}%, rgba(255,255,255,0.2) ${((speed - 0.5) / 4.5) * 100}%)` }}
              />
              <span className="text-[11px] text-white/50 font-light">{speed}× speed</span>
            </div>
            <button onClick={() => setSpeed(s => Math.min(5, +(s + 0.5).toFixed(1)))} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
