'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Film,
  Image as ImageIcon,
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
  Plus,
} from 'lucide-react';
import {
  ApiService,
  type BrollMediaItem,
  type BrollOrientation,
  type BrollSize,
  type BrollVideoFile,
} from '@/services/api';
import { supabase } from '@/lib/supabaseClient';
import {
  brollMediaToPick,
  clearBrollPickSession,
  enqueuePickedBroll,
  readBrollPickSession,
  type BrollPickSession,
} from '@/lib/video-editor/broll-pick';

type OrientationFilter = 'any' | BrollOrientation;
type MediaTypeFilter = 'any' | 'video' | 'photo';
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

function mediaFps(item: BrollMediaItem): number | null {
  for (const file of item.video_files) {
    const fps = parseFpsFromLink(file.link);
    if (fps != null) return fps;
  }
  return null;
}

function matchesMediaType(item: BrollMediaItem, mediaType: MediaTypeFilter): boolean {
  if (mediaType === 'any') return true;
  return item.kind === mediaType;
}

function matchesFps(item: BrollMediaItem, fps: FpsFilter): boolean {
  if (fps === 'any') return true;
  if (item.kind !== 'video') return true; // photos ignore fps filter
  const value = mediaFps(item);
  if (value == null) return false;
  if (fps === '60+') return value >= 60;
  return value === Number(fps);
}

function matchesDuration(item: BrollMediaItem, min: number, max: number): boolean {
  if (min <= DURATION_MIN && max >= DURATION_MAX) return true;
  if (item.kind !== 'video') return true; // photos ignore duration filter
  const duration = item.duration ?? 0;
  if (max >= DURATION_MAX) return duration >= min;
  return duration >= min && duration <= max;
}

function matchesResolution(item: BrollMediaItem, res: ResolutionFilter): boolean {
  if (res === 'any') return true;
  const maxDim = Math.max(item.width, item.height);
  if (res === '1080p') return maxDim >= 1080;
  if (res === '4k') return maxDim >= 2160;
  if (res === '8k') return maxDim >= 4320;
  return true;
}

const SAMPLE_QUERY = 'cinematic b-roll nature city lifestyle';
const SAMPLE_CACHE_KEY = 'storio_broll_samples_v3';

function pickPreviewFile(item: BrollMediaItem): BrollVideoFile | null {
  if (item.kind !== 'video') return null;
  const files = [...(item.video_files ?? [])].filter((f) => f.link);
  if (!files.length) return null;
  const preferred =
    files.find((f) => f.height === 720 || f.width === 1280) ??
    files.find((f) => (f.height ?? 0) >= 540 && (f.height ?? 0) <= 1080) ??
    files.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
  return preferred ?? null;
}

function isUsableSample(item: BrollMediaItem): boolean {
  if (!item.thumbnail && !item.downloadUrl) return false;
  if (item.kind === 'video') return Boolean(pickPreviewFile(item) || item.thumbnail);
  return true;
}

function readCachedSamples(): BrollMediaItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SAMPLE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.media) ? parsed.media : [];
  } catch {
    return [];
  }
}

function writeCachedSamples(media: BrollMediaItem[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      SAMPLE_CACHE_KEY,
      JSON.stringify({ media, timestamp: Date.now() }),
    );
  } catch { /* ignore */ }
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

export function StudioBRollPanel({
  onReturnToVideoEditing,
}: {
  /** When picking from AI Video Editing, return there after Add. */
  onReturnToVideoEditing?: () => void;
} = {}) {
  const router = useRouter();
  const [pickSession, setPickSession] = useState<BrollPickSession | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [media, setMedia] = useState<BrollMediaItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [orientation, setOrientation] = useState<OrientationFilter>('any');
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('any');
  const [people, setPeople] = useState<PeopleFilter>('any');
  const [age, setAge] = useState<AgeFilter>('any');
  const [durationMin, setDurationMin] = useState(DURATION_MIN);
  const [durationMax, setDurationMax] = useState(DURATION_MAX);
  const [fps, setFps] = useState<FpsFilter>('any');
  const [resolution, setResolution] = useState<ResolutionFilter>('any');
  const [date, setDate] = useState<DateFilter>('any');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    mediaType: true,
    orientation: true,
    people: true,
    age: true,
    duration: true,
    fps: true,
    resolution: true,
    date: true,
  });

  useEffect(() => {
    const session = readBrollPickSession();
    setPickSession(session);
    if (session?.kind === 'video') setMediaType('video');
    if (session?.kind === 'image') setMediaType('photo');
  }, []);

  const handleAddFromVideoEditing = useCallback(
    (item: BrollMediaItem) => {
      const session = pickSession ?? readBrollPickSession();
      if (!session) return;
      const itemKind = item.kind === 'photo' ? 'image' : 'video';
      if (itemKind !== session.kind) return;

      const preview = pickPreviewFile(item);
      const picked = brollMediaToPick(item, session, preview?.link ?? null);
      enqueuePickedBroll(picked);
      clearBrollPickSession();
      setPickSession(null);
      onReturnToVideoEditing?.();
    },
    [pickSession, onReturnToVideoEditing],
  );

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Prefetch Pexels sample videos + images for the empty state grid
  useEffect(() => {
    let cancelled = false;

    const loadSamples = async () => {
      const cached = readCachedSamples();
      if (cached.length > 0) {
        if (!cancelled) {
          setMedia(cached);
          setTotalResults(cached.length);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setMedia([]);
            setTotalResults(0);
            setLoading(false);
          }
          return;
        }

        const res = await ApiService.searchBroll({
          query: SAMPLE_QUERY,
          page: 1,
          per_page: PER_PAGE,
          userId: session.user.id,
        });
        if (cancelled) return;
        const list = (res.media ?? []).filter(isUsableSample);
        setMedia(list);
        setTotalResults(list.length || res.total_results || 0);
        writeCachedSamples(list);
      } catch (err) {
        console.error('[broll samples]', err);
        if (!cancelled) {
          setMedia([]);
          setTotalResults(0);
          setError(err instanceof Error ? err.message : 'Failed to load B-roll samples.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSamples();
    return () => {
      cancelled = true;
    };
  }, []);

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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        try {
          localStorage.setItem('post_auth_redirect', window.location.href);
        } catch { /* ignore */ }
        router.push('/auth');
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
          userId: session.user.id,
        });
        setHasSearched(true);
        setMedia(res.media ?? []);
        setTotalResults(res.total_results ?? 0);
        setPage(res.page ?? pageNum);
      } catch (err) {
        setHasSearched(true);
        setMedia([]);
        setTotalResults(0);
        setError(err instanceof Error ? err.message : 'Failed to search B-roll.');
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, orientation, resolution, router],
  );

  const filteredMedia = useMemo(
    () =>
      media.filter(
        (item) =>
          matchesMediaType(item, mediaType) &&
          matchesDuration(item, durationMin, durationMax) &&
          matchesFps(item, fps) &&
          matchesResolution(item, resolution),
      ),
    [media, mediaType, durationMin, durationMax, fps, resolution],
  );

  const activeFilterCount = [
    mediaType !== 'any',
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
    setMediaType('any');
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
        title="Media type"
        open={openSections.mediaType}
        onToggle={() => toggleSection('mediaType')}
      >
        <FilterChip label="Any" selected={mediaType === 'any'} onClick={() => setMediaType('any')} />
        <FilterChip
          label="Videos"
          selected={mediaType === 'video'}
          onClick={() => setMediaType('video')}
          icon={<Film className="w-3.5 h-3.5" />}
        />
        <FilterChip
          label="Images"
          selected={mediaType === 'photo'}
          onClick={() => setMediaType('photo')}
          icon={<ImageIcon className="w-3.5 h-3.5" />}
        />
      </FilterSection>

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
      {pickSession && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
          <p className="font-medium">
            Picking {pickSession.kind === 'video' ? 'videos' : 'images'} for AI Video Editing
            {pickSession.sceneTitle ? ` · ${pickSession.sceneTitle}` : ''}. Click Add next to Download.
          </p>
          <button
            type="button"
            onClick={() => {
              clearBrollPickSession();
              setPickSession(null);
              onReturnToVideoEditing?.();
            }}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold hover:bg-amber-100"
          >
            Back to editor
          </button>
        </div>
      )}
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
            placeholder="Search videos & images (e.g. aerial city night)"
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

          {!loading && !error && filteredMedia.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Film className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-[#1d1d1f] mb-2">
                {media.length > 0
                  ? 'No matches for these filters'
                  : hasSearched
                    ? 'No B-roll found'
                    : 'No sample media yet'}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {media.length > 0
                  ? 'Try widening duration, frame rate, or resolution filters.'
                  : hasSearched
                    ? 'Try a different search term or filters.'
                    : 'Sign in and open B-roll to load sample videos and images.'}
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

          {!loading && filteredMedia.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>
                  {hasSearched
                    ? <>Showing {filteredMedia.length}{totalResults ? ` of ${totalResults.toLocaleString()}` : ''} results</>
                    : <>Sample videos &amp; images · hover videos to preview · search for more</>}
                </span>
                {hasSearched && (
                  <span>
                    Page {page} of {totalPages}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredMedia.map((item) => {
                  const preview = pickPreviewFile(item);
                  const isPreview = previewKey === item.key && item.kind === 'video';
                  const downloadHref = item.kind === 'video'
                    ? preview?.link || item.downloadUrl
                    : item.downloadUrl || item.thumbnail;
                  return (
                    <div
                      key={item.key}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden group"
                    >
                      <div
                        className="relative aspect-video bg-gray-100 cursor-pointer overflow-hidden"
                        onMouseEnter={() => {
                          if (item.kind === 'video') setPreviewKey(item.key);
                        }}
                        onMouseLeave={() => setPreviewKey(null)}
                      >
                        {isPreview && preview ? (
                          <video
                            key={preview.link}
                            src={preview.link}
                            poster={item.thumbnail}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="auto"
                            onLoadedData={(e) => {
                              void e.currentTarget.play().catch(() => {});
                            }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.thumbnail}
                            alt={item.alt || ''}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute top-2 left-2 rounded-md bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 uppercase tracking-wide">
                          {item.kind === 'video' ? 'Video' : 'Image'}
                        </span>
                        {item.kind === 'video' && item.duration != null && (
                          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                            {formatDuration(item.duration)}
                          </span>
                        )}
                        <span className="absolute bottom-2 left-2 rounded-md bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5">
                          {item.width}×{item.height}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-500 truncate mb-2">
                          by{' '}
                          <a
                            href={item.user.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#1d1d1f] hover:underline"
                          >
                            {item.user.name}
                          </a>
                        </p>
                        {(downloadHref || pickSession) && (
                          <div className="flex items-center gap-2">
                            {downloadHref && (
                              <a
                                href={downloadHref}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50"
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            )}
                            {pickSession &&
                              ((pickSession.kind === 'video' && item.kind === 'video') ||
                                (pickSession.kind === 'image' && item.kind === 'photo')) && (
                              <button
                                type="button"
                                onClick={() => handleAddFromVideoEditing(item)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-[#1d1d1f] border border-[#1d1d1f] rounded-md px-2 py-1 hover:bg-black"
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasSearched && totalPages > 1 && (
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
