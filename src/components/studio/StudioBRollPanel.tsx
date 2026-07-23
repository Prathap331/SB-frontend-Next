'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Search,
  Loader2,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Film,
  AlertCircle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  User,
  Users,
  Baby,
  Smile,
  PersonStanding,
  Calendar,
  Clock,
  Gauge,
  Monitor,
  X,
} from 'lucide-react';
import {
  ApiService,
  type BrollOrientation,
  type BrollSize,
  type BrollVideo,
} from '@/services/api';
type OrientationFilter = 'any' | BrollOrientation;
type PeopleFilter = 'any' | '0' | '1' | '2' | '3+';
type AgeFilter = 'any' | 'baby' | 'child' | 'teenager' | 'adult' | 'senior';
type FpsFilter = 'any' | '24' | '25' | '30' | '50' | '60+';
type ResolutionFilter = 'any' | '1080p' | '4k' | '8k';
type DateFilter = 'any' | '24h' | 'week' | 'month';

const DURATION_MIN = 5;
const DURATION_MAX = 120; // 2m+

function resolutionToSize(res: ResolutionFilter): BrollSize | '' {
  if (res === '1080p') return 'medium';
  if (res === '4k' || res === '8k') return 'large';
  return '';
}

function formatDuration(seconds: number): string {
  if (seconds >= 120) return '2m+';
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
}

function parseFpsFromLink(link: string): number | null {
  const match = link.match(/(\d+)fps/i);
  return match ? Number(match[1]) : null;
}

function videoFps(video: BrollVideo): number | null {
  for (const file of video.video_files) {
    const fps = parseFpsFromLink(file.link);
    if (fps != null) return fps;
  }
  return null;
}

function matchesFps(video: BrollVideo, fps: FpsFilter): boolean {
  if (fps === 'any') return true;
  const value = videoFps(video);
  if (value == null) return false;
  if (fps === '60+') return value >= 60;
  return value === Number(fps);
}

function matchesDuration(video: BrollVideo, min: number, max: number): boolean {
  if (min <= DURATION_MIN && max >= DURATION_MAX) return true;
  if (max >= DURATION_MAX) return video.duration >= min;
  return video.duration >= min && video.duration <= max;
}

function matchesResolution(video: BrollVideo, res: ResolutionFilter): boolean {
  if (res === 'any') return true;
  const maxDim = Math.max(video.width, video.height);
  if (res === '1080p') return maxDim >= 1080;
  if (res === '4k') return maxDim >= 2160;
  if (res === '8k') return maxDim >= 4320;
  return true;
}

function pickPreviewFile(video: BrollVideo): BrollVideoFileLink | null {
  const files = [...video.video_files].filter((f) => f.link);
  if (!files.length) return null;
  const preferred =
    files.find((f) => f.height === 720 || f.width === 1280) ??
    files.find((f) => (f.height ?? 0) >= 540 && (f.height ?? 0) <= 1080) ??
    files.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
  return preferred ?? null;
}

const PER_PAGE = 15;

/** Build a compact page list like [1, 2, '…', 5, 6, 7, '…', 20] */
function buildPageItems(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>();
  pages.add(1);
  pages.add(total);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | '…'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('…');
    items.push(sorted[i]);
  }
  return items;
}

type BrollVideoFileLink = BrollVideo['video_files'][number];

function FilterChip({
  label,
  selected,
  onClick,
  icon,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? 'border-[#1d1d1f] bg-gray-50 text-[#1d1d1f] font-medium'
          : 'border-gray-200 bg-white text-[#3d3d3a] hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0 pb-4 mb-4 last:mb-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between mb-3"
      >
        <span className="text-sm font-bold text-[#1d1d1f]">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StudioBRollPanel() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<BrollVideo[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [orientation, setOrientation] = useState<OrientationFilter>('any');
  const [people, setPeople] = useState<PeopleFilter>('any');
  const [age, setAge] = useState<AgeFilter>('any');
  const [durationMin, setDurationMin] = useState(DURATION_MIN);
  const [durationMax, setDurationMax] = useState(DURATION_MAX);
  const [fps, setFps] = useState<FpsFilter>('any');
  const [resolution, setResolution] = useState<ResolutionFilter>('any');
  const [date, setDate] = useState<DateFilter>('any');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    orientation: true,
    people: true,
    age: true,
    duration: true,
    fps: true,
    resolution: true,
    date: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const buildQuery = useCallback(() => {
    const parts = [query.trim()].filter(Boolean);
    if (people === '1') parts.push('person');
    if (people === '2') parts.push('couple');
    if (people === '3+') parts.push('group of people');
    if (people === '0') parts.push('no people');
    if (age === 'baby') parts.push('baby');
    if (age === 'child') parts.push('child');
    if (age === 'teenager') parts.push('teenager');
    if (age === 'adult') parts.push('adult');
    if (age === 'senior') parts.push('senior');
    if (date === '24h') parts.push('recent');
    if (date === 'week') parts.push('this week');
    if (date === 'month') parts.push('this month');
    return parts.join(' ') || query.trim();
  }, [query, people, age, date]);

  const search = useCallback(
    async (pageNum = 1) => {
      const q = buildQuery();
      if (!q) {
        setError('Enter a search term to find B-roll.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const orientationParam =
          orientation === 'any' ? '' : orientation;
        const sizeParam = resolutionToSize(resolution);
        const res = await ApiService.searchBroll({
          query: q,
          page: pageNum,
          per_page: PER_PAGE,
          orientation: orientationParam,
          size: sizeParam,
        });
        setVideos(res.videos ?? []);
        setTotalResults(res.total_results ?? 0);
        setPage(res.page ?? pageNum);
      } catch (err) {
        setVideos([]);
        setTotalResults(0);
        setError(err instanceof Error ? err.message : 'Failed to search B-roll.');
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, orientation, resolution],
  );

  const filteredVideos = useMemo(
    () =>
      videos.filter(
        (v) =>
          matchesDuration(v, durationMin, durationMax) &&
          matchesFps(v, fps) &&
          matchesResolution(v, resolution),
      ),
    [videos, durationMin, durationMax, fps, resolution],
  );

  const activeFilterCount = [
    orientation !== 'any',
    people !== 'any',
    age !== 'any',
    !(durationMin <= DURATION_MIN && durationMax >= DURATION_MAX),
    fps !== 'any',
    resolution !== 'any',
    date !== 'any',
  ].filter(Boolean).length;

  const applyFiltersAndSearch = () => {
    setPage(1);
    void search(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / PER_PAGE));
  const pageItems = buildPageItems(page, totalPages);

  const clearFilters = () => {
    setOrientation('any');
    setPeople('any');
    setAge('any');
    setDurationMin(DURATION_MIN);
    setDurationMax(DURATION_MAX);
    setFps('any');
    setResolution('any');
    setDate('any');
  };

  const filtersPanel = (
    <div className="space-y-0">
      <FilterSection
        title="Orientation"
        open={openSections.orientation}
        onToggle={() => toggleSection('orientation')}
      >
        <FilterChip label="Any" selected={orientation === 'any'} onClick={() => setOrientation('any')} />
        <FilterChip
          label="Horizontal"
          selected={orientation === 'landscape'}
          onClick={() => setOrientation('landscape')}
          icon={<RectangleHorizontal className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Vertical"
          selected={orientation === 'portrait'}
          onClick={() => setOrientation('portrait')}
          icon={<RectangleVertical className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Square"
          selected={orientation === 'square'}
          onClick={() => setOrientation('square')}
          icon={<Square className="w-3.5 h-3.5" />}
        />
      </FilterSection>

      <FilterSection title="People" open={openSections.people} onToggle={() => toggleSection('people')}>
        <FilterChip label="Any" selected={people === 'any'} onClick={() => setPeople('any')} />
        <FilterChip label="0" selected={people === '0'} onClick={() => setPeople('0')} />
        <FilterChip
          label="1"
          selected={people === '1'}
          onClick={() => setPeople('1')}
          icon={<User className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="2"
          selected={people === '2'}
          onClick={() => setPeople('2')}
          icon={<Users className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="3+"
          selected={people === '3+'}
          onClick={() => setPeople('3+')}
          icon={<Users className="w-3.5 h-3.5" />}
        />
      </FilterSection>

      <FilterSection title="Age" open={openSections.age} onToggle={() => toggleSection('age')}>
        <FilterChip label="Any" selected={age === 'any'} onClick={() => setAge('any')} />
        <FilterChip
          label="Baby"
          selected={age === 'baby'}
          onClick={() => setAge('baby')}
          icon={<Baby className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Child"
          selected={age === 'child'}
          onClick={() => setAge('child')}
          icon={<Smile className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Teenager"
          selected={age === 'teenager'}
          onClick={() => setAge('teenager')}
          icon={<PersonStanding className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Adult"
          selected={age === 'adult'}
          onClick={() => setAge('adult')}
          icon={<User className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Senior adult"
          selected={age === 'senior'}
          onClick={() => setAge('senior')}
          icon={<User className="w-3.5 h-3.5" />}
        />
      </FilterSection>

      <FilterSection
        title="Duration"
        open={openSections.duration}
        onToggle={() => toggleSection('duration')}
      >
        <div className="w-full space-y-3">
          <div className="relative h-6 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-gray-200" />
            <div
              className="absolute h-1 rounded-full bg-[#1d1d1f]"
              style={{
                left: `${((durationMin - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100}%`,
                right: `${100 - ((durationMax - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100}%`,
              }}
            />
            <input
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              value={durationMin}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDurationMin(Math.min(v, durationMax));
              }}
              className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1d1d1f] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow"
            />
            <input
              type="range"
              min={DURATION_MIN}
              max={DURATION_MAX}
              value={durationMax}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDurationMax(Math.max(v, durationMin));
              }}
              className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#1d1d1f] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-lg border border-gray-200 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                Minimum
              </span>
              <span className="text-sm text-[#1d1d1f]">{formatDuration(durationMin)}</span>
            </label>
            <label className="rounded-lg border border-gray-200 px-3 py-2">
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                Maximum
              </span>
              <span className="text-sm text-[#1d1d1f]">{formatDuration(durationMax)}</span>
            </label>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="Frame rate" open={openSections.fps} onToggle={() => toggleSection('fps')}>
        {(['any', '24', '25', '30', '50', '60+'] as FpsFilter[]).map((value) => (
          <FilterChip
            key={value}
            label={value === 'any' ? 'Any' : value}
            selected={fps === value}
            onClick={() => setFps(value)}
            icon={value !== 'any' ? <Gauge className="w-3.5 h-3.5" /> : undefined}
          />
        ))}
      </FilterSection>

      <FilterSection
        title="Resolution"
        open={openSections.resolution}
        onToggle={() => toggleSection('resolution')}
      >
        <FilterChip label="Any" selected={resolution === 'any'} onClick={() => setResolution('any')} />
        <FilterChip
          label="1080p"
          selected={resolution === '1080p'}
          onClick={() => setResolution('1080p')}
          icon={<Monitor className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="4K"
          selected={resolution === '4k'}
          onClick={() => setResolution('4k')}
          icon={<Monitor className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="8K"
          selected={resolution === '8k'}
          onClick={() => setResolution('8k')}
          icon={<Monitor className="w-3.5 h-3.5" />}
        />
      </FilterSection>

      <FilterSection title="Date" open={openSections.date} onToggle={() => toggleSection('date')}>
        <FilterChip label="Any" selected={date === 'any'} onClick={() => setDate('any')} />
        <FilterChip
          label="Last 24 hours"
          selected={date === '24h'}
          onClick={() => setDate('24h')}
          icon={<Clock className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Last week"
          selected={date === 'week'}
          onClick={() => setDate('week')}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Last month"
          selected={date === 'month'}
          onClick={() => setDate('month')}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
      </FilterSection>

      <button
        type="button"
        onClick={() => {
          applyFiltersAndSearch();
          setFiltersOpen(false);
        }}
        className="mt-2 w-full rounded-xl bg-[#1d1d1f] text-white text-sm font-semibold py-2.5 hover:bg-black transition-colors"
      >
        Apply filters
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyFiltersAndSearch();
              }
            }}
            placeholder="Search B-roll (e.g. aerial city night)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#1d1d1f] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15 focus:border-[#1d1d1f]"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              filtersOpen
                ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                : 'border-gray-200 bg-white text-[#1d1d1f] hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span
                className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
                  filtersOpen ? 'bg-white text-[#1d1d1f]' : 'bg-[#1d1d1f] text-white'
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={applyFiltersAndSearch}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] text-white px-5 py-2.5 text-sm font-semibold hover:bg-black disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>
      </div>

      <div className="relative space-y-4">
        {/* Backdrop + left filter drawer over results */}
        <div
          className={`absolute inset-0 z-30 transition-opacity duration-300 ${
            filtersOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!filtersOpen}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/25"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
          />
          <aside
            className={`absolute left-0 top-0 z-10 flex h-full max-h-[min(100%,calc(100vh-10rem))] w-[min(100%,20rem)] flex-col bg-white border-r border-gray-200 shadow-2xl transition-transform duration-300 ease-out ${
              filtersOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="B-roll filters"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <h3 className="text-sm font-bold text-[#1d1d1f]">Filters</h3>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-gray-500 hover:text-[#1d1d1f] px-2 py-1"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-[#1d1d1f]"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filtersPanel}</div>
          </aside>
        </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && filteredVideos.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Film className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">
                {videos.length > 0 ? 'No matches for these filters' : 'Search B-Roll'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {videos.length > 0
                  ? 'Try widening duration, frame rate, or resolution filters.'
                  : 'Find stock footage for your video. Use filters for orientation, people, duration, frame rate, and resolution.'}
              </p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-white overflow-hidden animate-pulse"
                >
                  <div className="aspect-video bg-gray-100" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredVideos.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  Showing {filteredVideos.length}
                  {totalResults ? ` of ${totalResults.toLocaleString()}` : ''} results
                </span>
                <span>
                  Page {page} of {totalPages}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredVideos.map((video) => {
                  const preview = pickPreviewFile(video);
                  const isPreview = previewId === video.id;
                  return (
                    <div
                      key={video.id}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden group"
                    >
                      <div
                        className="relative aspect-video bg-gray-100 cursor-pointer"
                        onMouseEnter={() => setPreviewId(video.id)}
                        onMouseLeave={() => setPreviewId(null)}
                      >
                        {isPreview && preview ? (
                          <video
                            src={preview.link}
                            poster={video.thumbnail}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={video.thumbnail}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                          {formatDuration(video.duration)}
                        </span>
                        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                          {video.width}×{video.height}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-500 truncate mb-2">
                          by{' '}
                          <a
                            href={video.user.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#1d1d1f] hover:underline"
                          >
                            {video.user.name}
                          </a>
                        </p>
                        <div className="flex items-center gap-2">
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pexels
                          </a>
                          {preview && (
                            <a
                              href={preview.link}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => void search(page - 1)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  {pageItems.map((item, idx) =>
                    item === '…' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-sm text-gray-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        disabled={loading}
                        onClick={() => void search(item)}
                        className={`min-w-10 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
                          item === page
                            ? 'border-[#1d1d1f] bg-[#1d1d1f] text-white'
                            : 'border-gray-200 text-[#1d1d1f] hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    disabled={loading || page >= totalPages}
                    onClick={() => void search(page + 1)}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
