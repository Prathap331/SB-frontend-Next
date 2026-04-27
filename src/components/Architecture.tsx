import { useEffect, useState } from "react";

// ─── Data ──────────────────────────────────────────────────────────────────
const nodes = [
  {
    id: "input",
    heading: "Topic Synthesis Engine",
    label: "Decodes your idea into a powerful and focused content blueprint, Converts raw inputs into high-impact content directions",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&h=300&fit=crop&q=80",
  },
  {
    id: "engine",
    heading: "StoryBit Intelligence Engine",
    label: "Analyze top-performing content to uncover proven revenue-driving patterns. Break down winning content to reveal  opportunities",
    image: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&h=400&fit=crop&q=80",
  },
  {
    id: "data",
    heading: "StoryBit Knowledge Vault",
    label: "Access deep insights across news, history, books and science,ower your content with rich, multi-domain knowledge intelligence",
    image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=300&h=300&fit=crop&q=80",
  },
  {
    id: "script",
    heading: "Script Agent",
    label: "Convert intelligence into powerful, narrative-driven video scripts instantly. Creates structured, compelling scripts designed for audience retention",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&h=300&fit=crop&q=80",
  },
];

// ─── SVG Connectors ────────────────────────────────────────────────────────

/** Dotted horizontal arrow (left → right) */
function HArrow({
    w = 60,
    arrow = "end", // "end" | "none"
  }: {
    w?: number;
    arrow?: "end" | "none";
  }) {
    const shaft = w - 10;
  
    return (
      <svg width={w} height={16} style={{ overflow: "visible", flexShrink: 0 }}>
        <line
          x1={0}
          y1={8}
          x2={arrow === "end" ? shaft : w}
          y2={8}
          stroke="#6e6e73"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {arrow === "end" && (
          <polygon points={`${shaft},3 ${w},8 ${shaft},13`} fill="#6e6e73" />
        )}
      </svg>
    );
  }

/** Dotted vertical arrow (top → bottom) */
function VArrow({
    h = 48,
    arrow = "end",
  }: {
    h?: number;
    arrow?: "end" | "none";
  }) {
    const shaft = h - 10;
  
    return (
      <svg width={16} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
        <line
          x1={8}
          y1={0}
          x2={8}
          y2={arrow === "end" ? shaft : h}
          stroke="#6e6e73"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {arrow === "end" && (
          <polygon points={`3,${shaft} 13,${shaft} 8,${h}`} fill="#6e6e73" />
        )}
      </svg>
    );
  }

// ─── Circle node ───────────────────────────────────────────────────────────
function Circle({
  node,
  size,
  visible,
  delay,
}: {
  node: (typeof nodes)[0];
  size: number;
  visible: boolean;
  delay: number;
}) {
  return (
    <div
      className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 cursor-pointer shadow-sm"
      style={{
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.88)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      <img
        src={node.image}
        alt={node.id}
        className="w-full h-full object-cover grayscale hover:scale-105 transition-all duration-500"
      />
    </div>
  );
}

function Label({ heading, text, className = "" }: { heading: string; text: string; className?: string }) {
  return (
    <p
      className={`text-[11px] leading-[1.6] text-[#6e6e73] text-center whitespace-pre-wrap font-light ${className}`}
      style={{  maxWidth: 195 }}
    >
      <span className="flex items-center w-full justify-center  gap-1.5 text-[11px] font-medium text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors">{heading}</span>
      {text}
    </p>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function StoryBitPipeline() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-[#f5f5f7] flex flex-col items-center justify-center px-6 py-14 select-none">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
      `}</style>

      {/* Title */}
      {/* <h1
        className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-1 text-center"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
      >
        StoryBit Pipeline
      </h1>
      <p
        className="text-xs tracking-widest text-[#6e6e73] mb-16 text-center font-light uppercase"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        Automated intelligence · Research · Script generation
      </p> */}

      {/* ══════════════════════════════════════════════════════════
          DESKTOP — hidden below md
          Layout:
            [N1]──►[N2]──►[N3 + label-right]
                             │
                             ▼
                          [N4 + label-right]
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex items-start justify-center w-full max-w-[1080px]">

        {/* N1 — top-aligned vertically (circle center at ~70px from top) */}
        <div className="flex flex-col items-center pt-[60px]">
          <Circle node={nodes[0]} size={140} visible={visible} delay={0} />
          <Label heading={nodes[0].heading} text={nodes[0].label} className="text-center mt-3" />
        </div>

        {/* Arrow N1→N2: vertically centered on N1's circle */}
        <div className="flex items-start pt-[130px] mx-3">
          <HArrow w={60} />
        </div>

        {/* N2 */}
        <div className="flex flex-col items-center">
          <Circle node={nodes[1]} size={260} visible={visible} delay={0.2} />

          <Label heading={nodes[1].heading} text={nodes[1].label} className="text-center mt-3" />
        </div>


        <div>

        {/* Arrow N2→N3: centered on N2's circle (height 260, center at 130) */}
        <div className="flex items-start pt-[40px] mx-3">
          <HArrow w={80} />
        </div>

<div className="flex flex-col">
<div className="flex items-start pt-[120px] mx-3">
          <HArrow w={60} arrow="none" />
        </div>

<div className="flex flex-col">

        <div className="flex items-start pt-[0px] ml-16">
          <VArrow h={130} arrow="none"/>
        </div>

        <div className="flex items-start pt-[125px] ml-[75px] absolute">
          <HArrow w={230} />
        </div>
</div>
</div>

        </div>
        {/* Right column: N3 on top, VArrow, N4 below */}
        {/* <div className="flex flex-col items-start"> */}

          {/* N3 row: circle + label on right */}
          <div
            className="flex flex-col items-center gap-4"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "none" : "translateY(18px)",
              transition: "opacity 0.6s 0.4s, transform 0.6s 0.4s",
            }}
          >
            <div
              className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 cursor-pointer shadow-sm"
              style={{ width: 170, height: 170 }}
            >
              <img
                src={nodes[2].image}
                alt="data"
                className="w-full h-full object-cover grayscale  hover:scale-105 transition-all duration-500"
              />
            </div>
            <Label heading={nodes[2].heading} text={nodes[2].label} className="text-left" />
          </div>

          {/* VArrow: aligned to center of N3 circle (85px from left) */}
          <div>
          <div className="flex items-start pt-[90px] ml-2 absolute">
          <HArrow w={120} arrow="none"/>
        </div>
          </div>

          {/* N4 row: circle + label on right */}
          <div className="flex flex-col items-center gap-4" >
          <div
            className="flex flex-col items-center gap-4 opacity-0"
            >
            <div
              className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 cursor-pointer shadow-sm"
              style={{ width: 250, height: 90 }}
              >
              <img
                src={nodes[3].image}
                alt="script"
                className="w-full h-full object-cover grayscale  hover:scale-105 transition-all duration-500"
                />
            </div>
            {/* <Label text={nodes[3].label} className="text-left" /> */}
          </div>

 {/* VArrow: aligned to center of N3 circle (85px from left) */}
 <div className="flex" style={{ paddingLeft: 5 }}>
            <VArrow h={120} />
          </div>

          <div
            className="flex flex-col items-center gap-4 "
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : "translateY(18px)",
                transition: "opacity 0.6s 0.6s, transform 0.6s 0.6s",
            }}
            >
            <div
              className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 cursor-pointer shadow-sm"
              style={{ width: 160, height: 160 }}
              >
              <img
                src={nodes[3].image}
                alt="script"
                className="w-full h-full object-cover grayscale hover:scale-105 transition-all duration-500"
                />
            </div>
            <Label heading={nodes[3].heading} text={nodes[3].label} className="text-left" />
          </div>
                </div>

        {/* </div> */}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE — hidden above md
          Strict vertical flow, alternating left/right alignment:
            N1  (right side, label left)
             ↓
            N2  (center, label below)
             ↓
            N3  (left side, label right)
             ↓
            N4  (right side, label left)
      ══════════════════════════════════════════════════════════ */}
      <div className="flex lg:hidden flex-col items-stretch w-full max-w-[360px] gap-8">

        {/* N1 — right */}
        <div
          className="flex flex-col items-center gap-3 self-end"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(16px)",
            transition: "opacity 0.6s 0s, transform 0.6s 0s",
          }}
        >
          <div
            className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 shadow-sm"
            style={{ width: 145, height: 145 }}
          >
            <img src={nodes[0].image} alt="input" className="w-full h-full object-cover grayscale" />
          </div>
          <Label heading={nodes[0].heading} text={nodes[0].label} className="text-right" />
        </div>

        {/* VArrow — centered */}
        <div className="self-center absolute pt-[70px] mr-[40px]">
          <HArrow w={90} arrow="none"/>
        </div>


        <div className="self-center absolute pt-[85px] mr-[125px]">
          <VArrow h={120} />
        </div>

        {/* N2 — center */}
        <div
          className="flex flex-col items-center self-start"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(16px)",
            transition: "opacity 0.6s 0.2s, transform 0.6s 0.2s",
          }}
        >
          <div
            className="rounded-full border-2 border-neutral-900 overflow-hidden bg-white"
            style={{ width: 240, height: 240 }}
          >
            <img src={nodes[1].image} alt="engine" className="w-full h-full object-cover grayscale" />
          </div>
          <Label heading={nodes[1].heading} text={nodes[1].label} className="text-center mt-3" />
        </div>

        {/* VArrow — centered */}


          <div className="absolute pt-[400px] ml-[230px]">
          <HArrow w={50} arrow="none"/>
          </div>

        <div className="self-center absolute pt-[415px] ml-[220px]">
          <VArrow h={145} />
        </div>


        {/* N3 — left */}
        <div
          className="flex flex-col items-center gap-3 self-end"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(16px)",
            transition: "opacity 0.6s 0.4s, transform 0.6s 0.4s",
          }}
        >
          <div
            className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 shadow-sm"
            style={{ width: 145, height: 145 }}
          >
            <img src={nodes[2].image} alt="data" className="w-full h-full object-cover grayscale" />
          </div>
          <Label heading={nodes[2].heading} text={nodes[2].label} className="text-left" />
        </div>

        {/* VArrow — centered */}
        <div className="absolute pt-[650px] ml-[80px]">
          <HArrow w={120} arrow="none"/>
        </div>

        <div className="absolute pt-[665px] ml-[70px]">
          <VArrow h={150} />
        </div>

        {/* N4 — right */}
        <div
          className="flex flex-col items-center gap-3 self-start"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(16px)",
            transition: "opacity 0.6s 0.6s, transform 0.6s 0.6s",
          }}
        >
          <div
            className="rounded-full border border-gray-200 overflow-hidden bg-white flex-shrink-0 shadow-sm"
            style={{ width: 145, height: 145 }}
          >
            <img src={nodes[3].image} alt="script" className="w-full h-full object-cover grayscale" />
          </div>
          <Label heading={nodes[3].heading} text={nodes[3].label} className="text-right" />
        </div>

      </div>
    </div>
  );
}
