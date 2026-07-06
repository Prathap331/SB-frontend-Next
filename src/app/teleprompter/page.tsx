"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  FlipVertical,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
} from "lucide-react";

type ScriptLine = { text: string; pause: boolean };

// Splits paragraphs into sentences only — breaks happen at full stops
// (. ! ?), never mid-sentence. Each sentence wraps naturally within the
// available width instead of being force-chopped into fixed word counts,
// which keeps line lengths and centering visually even.
function breakIntoLines(raw: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  const paragraphs = raw.split(/\n+/).filter((p) => p.trim().length > 0);

  paragraphs.forEach((para) => {
    // Split into sentences, keeping the ending punctuation.
    const sentences =
      para.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()) ||
      [para.trim()];

    sentences.forEach((sentence) => {
      if (!sentence) return;
      // Every sentence gets the bigger pause gap after it.
      lines.push({ text: sentence, pause: true });
    });
  });

  return lines;
}

export default function Teleprompter() {
  const [script, setScript] = useState("");
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(32); // px
  // Only needed if your monitor/tablet is physically mounted upside-down
  // under the glass (some cheap under-glass rigs).
  const [flippedVertical, setFlippedVertical] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [textAlign, setTextAlign] = useState<"center" | "left">("center");

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

  const lines = useMemo(() => breakIntoLines(script), [script]);

  // The scroll math is identical in both modes — position 0 always lands
  // on the start of the script. The outer flip stage (see JSX below) wraps
  // this scrolling text in a fixed-size mirror, and that mirror is what
  // reverses the on-screen scroll direction when flipped: motion that moves
  // up pre-mirror shows as moving down post-mirror. Adding an extra sign
  // flip here on top of that would cancel the mirror's reversal back out.
  const translateY = `calc(45vh - ${position}px)`;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden flex flex-col">

      {/* Floating text-size / flip controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* Font size controls */}
        <div className="flex items-center gap-1 bg-white/10 rounded-full px-1.5 py-1.5 border border-white/10">
          <button
            onClick={() => setFontSize((s) => Math.max(16, s - 4))}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Decrease text size"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-white/60 font-light w-9 text-center select-none">
            {fontSize}px
          </span>
          <button
            onClick={() => setFontSize((s) => Math.min(96, s + 4))}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Increase text size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Vertical flip toggle (only for upside-down mounted monitors) */}
        <button
          onClick={() => setFlippedVertical((v) => !v)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${
            flippedVertical
              ? "bg-white text-[#0a0a0a] border-white"
              : "bg-white/10 hover:bg-white/20 border-white/10"
          }`}
          aria-label="Toggle vertical flip"
          title="Flip vertically (upside-down mounted monitor only)"
        >
          <FlipVertical className="w-4 h-4" />
        </button>

{/* Text alignment toggle */}
<button
  onClick={() =>
    setTextAlign((prev) => (prev === "center" ? "left" : "center"))
  }
  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${
    textAlign === "left"
      ? "bg-white text-[#0a0a0a] border-white"
      : "bg-white/10 hover:bg-white/20 border-white/10"
  }`}
  aria-label="Toggle text alignment"
  title={
    textAlign === "center"
      ? "Switch to left alignment"
      : "Switch to center alignment"
  }
>
  {textAlign === "center" ? (
    <AlignLeft className="w-4 h-4" />
  ) : (
    <AlignCenter className="w-4 h-4" />
  )}
</button>

      </div>

      {/* Script scroll area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Top fade */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
        {/* Center guide line */}
        <div className="absolute top-1/2 left-0 right-0 border-t border-white/5 z-10 pointer-events-none" />

        {/* Fixed-size flip stage: this box is always exactly the height of
            the visible scroll area, so mirroring it happens around the
            center of the SCREEN, not the center of the (arbitrarily long)
            script. The scrolling text below is positioned the same way in
            both modes; only this outer stage gets mirrored. */}
        <div
          className="absolute inset-0"
          style={{ transform: flippedVertical ? "scaleY(-1)" : undefined }}
        >
          <div
            ref={containerRef}
            className={`absolute w-full px-5 sm:px-12 md:px-24 lg:px-36 flex flex-col ${
              textAlign === "center" ? "items-center text-center" : "items-start text-left"
            }`}
            style={{
              transform: `translateY(${translateY})`,
            }}
          >
            {lines.length === 0 ? (
              <p
                className="font-light tracking-wide"
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                  fontSize: `${fontSize}px`,
                }}
              >
                No script loaded. Go back and generate a script first.
              </p>
            ) : (
              lines.map((line, i) => (
                <p
                  key={i}
                  className="font-light tracking-wide leading-[1.5]"
                  style={{
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
                    fontSize: `${fontSize}px`,
                    marginBottom: line.pause ? "0.9em" : "0.15em",
                  }}
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-xs sm:max-w-lg mx-auto flex items-center gap-3 sm:gap-4">

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