'use client';

import { useEffect, useRef } from 'react';

const cats = [
    {label:"Psychology",path:"M13 2c-4 0-8 .5-8 4v9.5C5 17.43 6.57 19 8.5 19L7 20.5v.5h10v-.5L15.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zm0 2c3.71 0 5.1.48 5.7 1H7.3c.6-.52 2-.99 5.7-1zM7 9V7h6v2H7zm10 6.5c0 .83-.67 1.5-1.5 1.5h-7c-.83 0-1.5-.67-1.5-1.5V11h10v4.5zm0-6.5h-3V7h3v2z"},
    {label:"Philosophy",path:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-5h2v2h-2zm1.61-9.96c-2.06-.3-3.88.97-4.43 2.79-.18.58.26 1.17.87 1.17h.2c.41 0 .74-.29.88-.67.32-.89 1.27-1.5 2.3-1.28.95.2 1.65 1.13 1.57 2.1-.1 1.34-1.52 1.69-2.3 2.58-.28.32-.45.73-.45 1.27v.5h2v-.45c0-.28.14-.56.37-.77 1.08-.97 2.76-1.22 2.76-3.27 0-1.94-1.62-3.47-3.77-3.97z"},
    {label:"Knowledge",path:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"},
    {label:"Explainer Videos",path:"M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"},
    {label:"Historical",path:"M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"},
    {label:"Science Facts",path:"M7 2v2h1v14c0 2.21 1.79 4 4 4s4-1.79 4-4V4h1V2H7zm4 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-5h-4V4h4v3z"},
    {label:"Tech Updates",path:"M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"},
    {label:"Book Summaries",path:"M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"},
    {label:"Business Cases",path:"M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z M7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"},
    {label:"Business Lessons",path:"M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"},
    {label:"Personal Finance",path:"M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"},
    {label:"Leadership",path:"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"},
    {label:"Sales & Negotiation",path:"M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 23.46 5H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"},
    {label:"Self Improvement",path:"M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"},
    {label:"Relationships",path:"M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"},
    {label:"Parenting",path:"M11.5 2c-1.38 0-2.5 1.12-2.5 2.5S10.12 7 11.5 7 14 5.88 14 4.5 12.88 2 11.5 2zM18 9h-1.26C16.26 7.83 15.23 7 14 7H9C7.34 7 6 8.34 6 10v6h2v6h3v-6h1v6h3v-6h2V10c0-.35-.07-.68-.18-1H18c.55 0 1 .45 1 1v3h2v-3c0-1.1-.9-2-2-2z"},
    {label:"Persuasion & Influence",path:"M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"},
    {label:"Health & Nutrition",path:"M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"},
    {label:"Motivation",path:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"},
    {label:"Religion & Stories",path:"M6.5 10h-2v7h2v-7zm5 0h-2v7h2v-7zm8.5 9H2v2h18v-2zm-3.5-9h-2v7h2v-7zM11 1L2 6v2h18V6l-9-5z"},
    {label:"Manifestation",path:"M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zm7.5 9.5l-1.25-2.75L15 15l2.75-1.25L19 11l1.25 2.75L23 15l-2.75 1.25L19 19z"},
    {label:"Mythology",path:"M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"},
    {label:"Crime Stories",path:"M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"},
    {label:"Conspiracy & Myths",path:"M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 0 0 9.5 3 6.5 6.5 0 0 0 3 9.5 6.5 6.5 0 0 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm0-7C8.12 7 7 8.12 7 9.5S8.12 12 9.5 12 12 10.88 12 9.5 10.88 7 9.5 7z"},
    {label:"Mental Health",path:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"},
    {label:"Cultural Stories",path:"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"},
    {label:"Biographies",path:"M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"},
    {label:"News",path:"M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"},
    {label:"Geopolitics",path:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"},
    {label:"Policy & Governance",path:"M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"},
    {label:"Legal Breakdowns",path:"M1 21h12v2H1v-2zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828L5.245 8.07zM12.317 1l5.657 5.656-2.83 2.83-5.656-5.66L12.317 1zM3.825 9.485l5.657 5.657-2.828 2.828-5.657-5.657 2.828-2.828z"},
    {label:"Criminal Insights",path:"M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"},
    {label:"Legal Rights",path:"M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 13l-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6z"},
    {label:"Future Tech",path:"M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05 3.14-.29zM11.17 17c-.52 1.34-1.17 2.88-1.17 2.88l-2.83-2.83s1.54-.65 2.88-1.17L11.17 17zm5.48 1.27c0-.01 1.35-3.78.35-7.2l-3.45-3.45C9.92 7.45 6 8.8 6 8.8l8.42 8.42.23.05zM14 10.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5S14 11.33 14 10.5zM5 19c-1.66 0-3-1.34-3-3l1.5 1.5 1.5-1.5 1.5 1.5 1.5-1.5C8 17.66 6.66 19 5 19z M19 2l-1 4-4-1 1.5 1.5-5 5 1.5 1.5 5-5L19 2z"},
    {label:"Science & Tech",path:"M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"}
  ];
const CHIP_W = 140;

export default function CategorySlider() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackRef.current) return;
    const totalShift = -(cats.length * CHIP_W);
    trackRef.current.style.setProperty('--total-shift', `${totalShift}px`);
  }, []);

  const pause = () => {
    if (trackRef.current) trackRef.current.style.animationPlayState = 'paused';
  };
  const resume = () => {
    if (trackRef.current) trackRef.current.style.animationPlayState = 'running';
  };

  const renderChip = (c: any, i: number) => (
    <div
      key={i}
      className="flex flex-col items-center justify-center gap-3 w-[140px] h-[180px] flex-shrink-0 hover:bg-[#f5f5f7] transition"
    >
      <div className="w-[120px] h-[120px] rounded-xl bg-[#ffffff] border border-[#e5e5e7] flex items-center justify-center hover:bg-[#f2f2f2] transition">
        <svg viewBox="0 0 24 24" className="w-14 h-14 fill-[#1d1d1f]">
          <path d={c.path} />
        </svg>
      </div>
  
      <span
  ref={(el) => {
    if (!el) return;

    // delay to ensure layout is calculated
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth) {
        el.classList.add('marquee-text');
      }
    });
  }}
  className="text-sm text-[#6e6e73] text-center max-w-[110px] whitespace-nowrap overflow-hidden block"
>
  <span className="inline-block marquee-inner">
    {c.label}
  </span>
</span>
    </div>
  );

  return (
    <section className="relative w-full bg-white py-4">
      {/* top border */}
      {/* <div className="h-px bg-[#2a2a2a]" /> */}

      <div className="relative overflow-hidden" onMouseEnter={pause} onMouseLeave={resume}>
        {/* fade edges */}
        <div className="absolute left-0 top-0 w-[120px] h-full bg-gradient-to-r from-white to-transparent z-10" />
        <div className="absolute right-0 top-0 w-[120px] h-full bg-gradient-to-l from-white to-transparent z-10" />

        <div
          ref={trackRef}
          className="flex w-max animate-marquee"
        >
          {[...cats, ...cats, ...cats].map(renderChip)}
        </div>
      </div>

      {/* bottom border */}
      {/* <div className="h-px bg-[#2a2a2a]" /> */}

      {/* animation */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(var(--total-shift));
          }
        }

        .animate-marquee {
          animation: marquee 90s linear infinite;
        }

      
@keyframes text-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(calc(-100% + 110px));
  }
}

.marquee-text:hover .marquee-inner {
  animation: text-scroll 4s linear infinite;
}

      `}</style>
    </section>
  );
}