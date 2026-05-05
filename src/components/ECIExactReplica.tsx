"use client";

import React from "react";

interface Props {
  data: any; // your ECIResponse
}



const formatNumber = (n?: number) => {
    if (!n && n !== 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

export default function ECIExactReplica({ data }: Props) {
  const g = data?.google_data || {};
  const yt = data?.youtube_data || {};
  const rv = yt?.revenue_potential || {};
  const cl = yt?.content_longevity || {};
  const ad = yt?.audience_depth || {};
  const cd = yt?.competition_density || {};
  const ap = yt?.audience_profile || {};

  const demand = Math.round(g.demand_score || 0);
  const youtube = Math.round(yt.youtube_score || 0);

  const overall = Math.round((demand + youtube) / 2);

  const DIMENSIONS = [
    {
      name: "Demand",
      value: demand,
      color: "#1D4ED8",
      bg: "#EEF3FF",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#1D4ED8" strokeWidth="1.8">
          <polyline points="2,12 6,7 9,9 14,3" />
        </svg>
      ),
    },
    {
      name: "Depth",
      value: ad.score,
      color: "#7C3AED",
      bg: "#F5F0FF",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#7C3AED" strokeWidth="1.8">
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="3" />
        </svg>
      ),
    },
    {
      name: "Landscape",
      value: 60,
      color: "#0F766E",
      bg: "#EFFAF9",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0F766E" strokeWidth="1.8">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      ),
    },
    {
      name: "Competition",
      value: cd.score,
      color: "#B45309",
      bg: "#FFFBEB",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B45309" strokeWidth="1.8">
          <path d="M8 2L14 14H2Z" />
        </svg>
      ),
    },
    {
      name: "Revenue",
      value: rv.revenue_score,
      color: "#15803D",
      bg: "#F0FDF4",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.8">
          <circle cx="8" cy="8" r="6" />
          <line x1="8" y1="5" x2="8" y2="11" />
          <line x1="5.5" y1="7" x2="10.5" y2="7" />
        </svg>
      ),
    },
    {
      name: "Audience",
      value: ap.score,
      color: "#BE185D",
      bg: "#FDF2F8",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#BE185D" strokeWidth="1.8">
          <circle cx="8" cy="6" r="3" />
          <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6" />
        </svg>
      ),
    },
    {
      name: "Longevity",
      value: cl.longevity_score,
      color: "#0369A1",
      bg: "#EFF6FF",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0369A1" strokeWidth="1.8">
          <circle cx="8" cy="8" r="6" />
          <polyline points="8,5 8,8 10,10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="bg-[#F6F5F1] p-6 rounded-xl">

      {/* HERO */}
      <div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden mb-4">

        <div className="flex justify-between items-center px-6 py-4 border-b border-[#EEECE7]">
          <div>
            <p className="text-[10px] tracking-widest text-[#A8A49D] uppercase">
              Opportunity score · YouTube data only
            </p>
            <p className="text-lg font-semibold text-green-700">
              Strong opportunity
            </p>
          </div>

          <div className="text-right">
            <p className="text-4xl font-bold text-green-700 leading-none">
              {overall} <span className="text-lg text-gray-400">/ 100</span>
            </p>
            <p className="text-xs text-gray-400">7 dimensions · YouTube signals only</p>
          </div>
        </div>

        {/* 7 DIMENSIONS */}
        <div className="grid grid-cols-7">
          {DIMENSIONS.map((d) => (
            <div key={d.name} className="p-3 border-r last:border-r-0">
               <div
    className="w-8 h-8 rounded-[4px] flex items-center justify-center mb-1"
    style={{ background: d.bg }}
  >
    {d.icon}
  </div>

              <p className="text-[10px] uppercase text-gray-400">
                {d.name}
              </p>

              <p
                className="text-lg font-mono font-bold"
                style={{ color: d.color }}
              >
                {Math.round(d.value || 0)}
              </p>

              <div className="h-1 bg-gray-200 rounded mt-1">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${d.value || 0}%`,
                    background: d.color,
                  }}
                />
              </div>

              <p className="text-[10px] text-gray-400 mt-1 truncate">
                — 
              </p>
            </div>
          ))}
        </div>
      </div>

    
      {/* ───────── SUSTAINED DEMAND CARD ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden mb-4">

<div className="h-[2px] bg-[#1D4ED8]" />


{/* HEADER */}
<div className="px-5 py-4 border-b border-[#EEECE7] flex items-start justify-between">

  <div className="flex items-start gap-3">
    {/* ICON */}
    <div className="w-6 h-6 rounded-md bg-[#EEF3FF] flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#1D4ED8" strokeWidth="1.8">
        <polyline points="2,12 6,7 9,9 14,3"/>
      </svg>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#1C1A17]">
        Sustained Demand
      </p>
      <p className="text-[11px] text-[#A8A49D]">
        pytrends gprop="youtube" · 24m + 5yr · geo + related queries
      </p>
    </div>
  </div>

  {/* BADGE */}
  <span className="text-[11px] font-medium px-2 py-[2px] rounded-full bg-[#EEF3FF] text-[#1D4ED8]">
    {g.lifecycle}
  </span>
</div>

{/* SCORE */}
<div className="px-5 py-4">

  <div className="flex items-end gap-2 mb-2">
    <span className="text-3xl font-semibold text-[#1D4ED8] leading-none">
      {demand}
    </span>
    <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
  </div>

  {/* PROGRESS BAR */}
  <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
    <div
      className="h-full bg-[#1D4ED8] rounded-full transition-all duration-500"
      style={{ width: `${demand}%` }}
    />
  </div>
</div>



{/* METRICS GRID */}
<div className="grid grid-cols-4 text-sm">

  {/* ROW 1 */}
  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">YT Index now</p>
    <p className="font-semibold text-[#1C1A17]">{g.index_now}</p>
    <p className="text-[11px] text-green-600">YouTube search index</p>
  </div>

  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">24M avg index</p>
    <p className="font-semibold text-[#1C1A17]">{g.avg_index_24m}</p>
    <p className="text-[11px] text-[#A8A49D]">trimmed mean baseline</p>
  </div>

  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Stability</p>
    <p className="font-semibold text-[#1C1A17]">{g.stability}</p>
    <p className="text-[11px] text-green-600">1.0 = perfectly stable</p>
  </div>

  <div className="p-4 border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Lifecycle</p>
    <p className="font-semibold text-[#1C1A17]">{g.lifecycle}</p>
    <p className="text-[11px] text-[#A8A49D]">5yr shape</p>
  </div>

  {/* ROW 2 */}
  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Search intent</p>
    <p className="font-semibold text-[#1C1A17]">{g.search_intent.learning_pct}% learning </p>
    <p className="text-[11px] text-[#A8A49D]">YouTube related queries</p>
  </div>

  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Best month</p>
    <p className="font-semibold text-[#1C1A17]">{g.best_month}</p>
    <p className="text-[11px] text-[#A8A49D]">peak YouTube search</p>
  </div>

  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Top geographies</p>
    <p className="font-semibold text-[#1C1A17]">{g.top_geographies.join(', ')}</p>
    <p className="text-[11px] text-[#A8A49D]">YT search by region</p>
  </div>

  <div className="p-4">
    <p className="text-[10px] text-[#A8A49D] uppercase">Data source</p>
    <p className="font-semibold text-[#1C1A17]">YouTube only</p>
    <p className="text-[11px] text-[#A8A49D]">gprop="youtube  no web search"</p>
  </div>

</div>
</div>


      {/* GRID SECTION */}
      <div className="grid grid-cols-2 gap-4">

        {/* Audience Depth */}
        {/* ───────── AUDIENCE DEPTH ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden">

{/* TOP BORDER */}
<div className="h-[2px] bg-[#7C3AED]" />

{/* HEADER */}
<div className="px-5 py-4 flex justify-between items-start border-b border-[#EEECE7]">

  <div className="flex gap-3">
    {/* ICON */}
    <div className="w-6 h-6 rounded-md bg-[#F5F0FF] flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#7C3AED" strokeWidth="1.8">
        <circle cx="8" cy="8" r="6"/>
        <circle cx="8" cy="8" r="3"/>
      </svg>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#1C1A17]">
        Audience Depth
      </p>
      <p className="text-[11px] text-[#A8A49D]">
        YouTube API · top 30 all-time · 148 quota units
      </p>
    </div>
  </div>
</div>

{/* SCORE */}
<div className="px-5 py-4">
  <div className="flex items-end gap-2 mb-2">
    <span className="text-3xl font-semibold text-[#7C3AED]">
      {ad.score}
    </span>
    <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
  </div>

  <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
    <div
      className="h-full bg-[#7C3AED]"
      style={{ width: `${ad.score}%` }}
    />
  </div>
</div>

{/* GRID */}
<div className="grid grid-cols-3 text-sm">

  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Like rate</p>
    <p className="font-semibold">{ad.like_rate_pct}%</p>
    <p className="text-[11px] text-green-600">avg across top 30</p>
  </div>

  <div className="p-4 border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Comment rate</p>
    <p className="font-semibold">{ad.comment_rate_pct}%</p>
    <p className="text-[11px] text-green-600">avg across top 30</p>
  </div>

  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Avg video length</p>
    <p className="font-semibold">{ad.avg_length_min} min avg</p>
    <p className="text-[11px] text-[#A8A49D]">audience-validated</p>
  </div>

  <div className="p-4 border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Oldest top video</p>
    <p className="font-semibold">{ad.oldest_top_months} months</p>
    <p className="text-[11px] text-green-600">still ranking</p>
  </div>

  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Comment sentiment</p>
    <p className="font-semibold">{ad.question_pct}% Questions, {ad.complaint_pct} Complaints</p>
    <p className="text-[11px] text-[#A8A49D]">classified from YT comments</p>
  </div>

  <div className="p-4">
    <p className="text-[10px] text-[#A8A49D] uppercase">Engagement score</p>
    <p className="font-semibold">{ad.score} / 100</p>
    <p className="text-[11px] text-green-600">like + comment weighted</p>
  </div>

</div>
</div>

        {/* Competition */}
        {/* ───────── COMPETITION ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden">

{/* TOP BORDER */}
<div className="h-[2px] bg-[#B45309]" />

{/* HEADER */}
<div className="px-5 py-4 flex justify-between items-start border-b border-[#EEECE7]">

  <div className="flex gap-3">
    <div className="w-6 h-6 rounded-md bg-[#FFFBEB] flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#B45309" strokeWidth="1.8">
        <path d="M8 2L14 14H2Z"/>
      </svg>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#1C1A17]">
        Competition Density
      </p>
      <p className="text-[11px] text-[#A8A49D]">
        YouTube channels.list · view distribution · Gini
      </p>
    </div>
  </div>

  {/* BADGE */}
  <span className="text-[11px] px-2 py-[2px] rounded-full bg-[#FFFBEB] text-[#B45309]">
    {cd.label || "Competitive"}
  </span>
</div>

{/* SCORE */}
<div className="px-5 py-4">
  <div className="flex items-end gap-2 mb-2">
    <span className="text-3xl font-semibold text-[#B45309]">
      {cd.score}
    </span>
    <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
  </div>

  <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
    <div
      className="h-full bg-[#B45309]"
      style={{ width: `${cd.score}%` }}
    />
  </div>
</div>

{/* GRID */}
<div className="grid grid-cols-2 text-sm">

  <div className="p-4 border-r border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Avg channel subs</p>
    <p className="font-semibold">{formatNumber(cd.avg_channel_subs)}</p>
    <p className="text-[11px] text-orange-600">top 10 channels</p>
  </div>

  <div className="p-4 border-b border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">View gini</p>
    <p className="font-semibold">{cd.view_gini}</p>
    <p className="text-[11px] text-[#A8A49D]">0 = spread · 1 = concentrated</p>
  </div>

  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">Small creator share</p>
    <p className="font-semibold">{cd.small_creator_share}%</p>
    <p className="text-[11px] text-orange-600">of top 30 views</p>
  </div>

  <div className="p-4">
    <p className="text-[10px] text-[#A8A49D] uppercase">Total videos</p>
    <p className="font-semibold">{formatNumber(cd.total_videos_est)}</p>
    <p className="text-[11px] text-[#A8A49D]">YouTube search estimate</p>
  </div>

</div>
</div>
      </div>


      <div className="grid grid-cols-2 gap-4 mt-4">

{/* ───────── REVENUE POTENTIAL ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden">

  {/* TOP BORDER */}
  <div className="h-[2px] bg-[#15803D]" />

  {/* HEADER */}
  <div className="px-5 py-4 flex justify-between items-start border-b border-[#EEECE7]">

    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-md bg-[#F0FDF4] flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#15803D" strokeWidth="1.8">
          <circle cx="8" cy="8" r="6"/>
          <line x1="8" y1="5" x2="8" y2="11"/>
          <line x1="5.5" y1="7" x2="10.5" y2="7"/>
        </svg>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#1C1A17]">
          Revenue Potential
        </p>
        <p className="text-[11px] text-[#A8A49D]">
          YouTube category · RPM benchmarks · engagement multiplier
        </p>
      </div>
    </div>

    {/* BADGE */}
    <span className="text-[11px] px-2 py-[2px] rounded-full bg-[#F0FDF4] text-[#15803D]">
      • YouTube-derived
    </span>
  </div>

  {/* SCORE */}
  <div className="px-5 py-4">
    <div className="flex items-end gap-2 mb-2">
      <span className="text-3xl font-semibold text-[#15803D]">
        {rv.revenue_score}
      </span>
      <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
    </div>

    <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#15803D]"
        style={{ width: `${rv.revenue_score}%` }}
      />
    </div>
  </div>

  {/* GRID */}
  <div className="grid grid-cols-2 text-sm">

    <div className="p-4 border-r border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Est. creator RPM</p>
      <p className="font-semibold">${rv.est_rpm}</p>
      <p className="text-[11px] text-green-600">engagement-adjusted</p>
    </div>

    <div className="p-4 border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">RPM range</p>
      <p className="font-semibold">
        ${rv.rpm_low}–${rv.rpm_high}
      </p>
      <p className="text-[11px] text-[#A8A49D]">category benchmark</p>
    </div>

    <div className="p-4 border-r border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Brand deal est.</p>
      <p className="font-semibold">${rv.brand_deal_est_mo}/mo</p>
      <p className="text-[11px] text-[#A8A49D]">category-based</p>
    </div>

    <div className="p-4 border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Total est./mo</p>
      <p className="font-semibold">${rv.total_est_mo}/mo</p>
      <p className="text-[11px] text-green-600">{rv.views_basis}</p>
    </div>

    <div className="p-4 border-r border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">RPM source</p>
      <p className="font-semibold">YT category benchmark</p>
      <p className="text-[11px] text-[#A8A49D]">no Keyword Planner</p>
    </div>

    <div className="p-4">
      <p className="text-[10px] text-[#A8A49D] uppercase">Engagement adj.</p>
      <p className="font-semibold">{ad.like_rate_pct}% like rate</p>
      <p className="text-[11px] text-green-600">multiplies base RPM</p>
    </div>

  </div>
</div>


{/* ───────── AUDIENCE PROFILE ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden">

  {/* TOP BORDER */}
  <div className="h-[2px] bg-[#BE185D]" />

  {/* HEADER */}
  <div className="px-5 py-4 border-b border-[#EEECE7]">

    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-md bg-[#FDF2F8] flex items-center justify-center">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#BE185D" strokeWidth="1.8">
          <circle cx="8" cy="6" r="3"/>
          <path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
        </svg>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#1C1A17]">
          Audience Profile
        </p>
        <p className="text-[11px] text-[#A8A49D]">
          YT related queries (D1) + YT comments (D2) · no external data
        </p>
      </div>
    </div>
  </div>

  {/* SCORE */}
  <div className="px-5 py-4">
    <div className="flex items-end gap-2 mb-2">
      <span className="text-3xl font-semibold text-[#BE185D]">
        {ap.score}
      </span>
      <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
    </div>

    <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#BE185D]"
        style={{ width: `${ap.score}%` }}
      />
    </div>
  </div>

  {/* GRID */}
  <div className="grid grid-cols-2 text-sm">

    <div className="p-4 border-r border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Primary audience</p>
      <p className="font-semibold">{ap.primary_audience}</p>
      <p className="text-[11px] text-[#A8A49D]">from YT related queries</p>
    </div>

    <div className="p-4 border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Dominant emotion</p>
      <p className="font-semibold">{ap.dominant_emotion}</p>
      <p className="text-[11px] text-[#A8A49D]">from YT comment analysis</p>
    </div>

    <div className="p-4 border-r border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Experience level</p>
      <p className="font-semibold">{ap.experience_level}</p>
      <p className="text-[11px] text-[#A8A49D]">beginner vs advanced queries</p>
    </div>

    <div className="p-4 border-b border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Purchase intent</p>
      <p className="font-semibold">{ap.purchase_intent}</p>
      <p className="text-[11px] text-[#A8A49D]">RPM + engagement signal</p>
    </div>

    <div className="p-4 border-r border-[#EEECE7]">
      <p className="text-[10px] text-[#A8A49D] uppercase">Shareability</p>
      <p className="font-semibold">{ap.shareability}/100</p>
      <p className="text-[11px] text-[#A8A49D]">awe + explorer + engagement</p>
    </div>

    <div className="p-4">
      <p className="text-[10px] text-[#A8A49D] uppercase">Data sources</p>
      <p className="font-semibold">YouTube only</p>
      <p className="text-[11px] text-[#A8A49D]">no KP / no Google web search</p>
    </div>

  </div>
</div>

</div>


      {/* ───────── CONTENT LONGEVITY ───────── */}
<div className="bg-white border border-[#E2DED6] rounded-xl overflow-hidden mt-4">

{/* TOP BORDER */}
<div className="h-[2px] bg-[#0369A1]" />

{/* HEADER */}
<div className="px-5 py-4 border-b border-[#EEECE7] flex justify-between items-start">

  <div className="flex gap-3">
    {/* ICON */}
    <div className="w-6 h-6 rounded-md bg-[#EFF6FF] flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#0369A1" strokeWidth="1.8">
        <circle cx="8" cy="8" r="6"/>
        <polyline points="8,5 8,8 10,10"/>
      </svg>
    </div>

    <div>
      <p className="text-sm font-semibold text-[#1C1A17]">
        Content Longevity
      </p>
      <p className="text-[11px] text-[#A8A49D]">
        YouTube video titles (D2) · view decay · comment complaints
      </p>
    </div>
  </div>

  {/* BADGE */}
  <span className="text-[11px] px-2 py-[2px] rounded-full bg-[#EFF6FF] text-[#0369A1]">
    • {cl.shelf_life_label || "Multi-year shelf life"}
  </span>
</div>

{/* SCORE */}
<div className="px-5 py-4">
  <div className="flex items-end gap-2 mb-2">
    <span className="text-3xl font-semibold text-[#0369A1]">
      {cl.longevity_score}
    </span>
    <span className="text-sm text-[#A8A49D] mb-1">/ 100</span>
  </div>

  {/* PROGRESS BAR */}
  <div className="w-full h-[3px] bg-[#EEECE7] rounded-full overflow-hidden">
    <div
      className="h-full bg-[#0369A1]"
      style={{ width: `${cl.longevity_score}%` }}
    />
  </div>
</div>

{/* METRICS GRID */}
<div className="grid grid-cols-4 text-sm">

  {/* VERSION SENSITIVITY */}
  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">
      Version sensitivity
    </p>
    <p className="font-semibold">
      {cl.version_sensitivity_label} ({cl.version_sensitivity})
    </p>
    <p className="text-[11px] text-green-600">
      from video titles (D2)
    </p>
  </div>

  {/* OLD → NEW VIEW RATIO */}
  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">
      Old-to-new view ratio
    </p>
    <p className="font-semibold">
      {cl.old_to_new_ratio}
    </p>
    <p className="text-[11px] text-green-600">
      YouTube view decay signal
    </p>
  </div>

  {/* FOUNDATIONAL STABILITY */}
  <div className="p-4 border-r border-[#EEECE7]">
    <p className="text-[10px] text-[#A8A49D] uppercase">
      Foundational stability
    </p>
    <p className="font-semibold">
      {cl.foundational_stability ? "Yes" : "No"}
    </p>
    <p className="text-[11px] text-[#A8A49D]">
      category-based lookup
    </p>
  </div>

  {/* INCUMBENT DECAY */}
  <div className="p-4">
    <p className="text-[10px] text-[#A8A49D] uppercase">
      Incumbent decay
    </p>
    <p className="font-semibold">
      {cl.incumbent_decay_pct}%
    </p>
    <p className="text-[11px] text-green-600">
      complaint rate (D2 comments)
    </p>
  </div>

</div>
</div>

    </div>
  );
}