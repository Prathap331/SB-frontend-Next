"use client";

import { useEffect, useState } from "react";

export default function Teleprompter() {
  const [script, setScript] = useState("");
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const text = sessionStorage.getItem("teleprompter_script");
    if (text) setScript(text);
  }, []);

  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      setPosition((prev) => prev + speed);
    }, 50);

    return () => clearInterval(interval);
  }, [speed, playing]);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      <div
        className="absolute w-full text-3xl leading-loose px-20 text-center"
        style={{ transform: `translateY(-${position}px)` }}
      >
        {script}
      </div>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
        <button onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play"}
        </button>

        <input
          type="range"
          min="1"
          max="5"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </div>
    </div>
  );
}