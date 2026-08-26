'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clapperboard, Loader2, Pause, Play, X } from 'lucide-react';
import StudioShell from '@/components/studio/StudioShell';
import { supabase } from '@/lib/supabaseClient';
import { listUserVideos, type LibraryVideo } from '@/lib/script-persistence';

function VideoPreviewModal({
  video,
  onClose,
}: {
  video: LibraryVideo;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlayback = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={-1}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <p className="truncate text-sm font-semibold text-white">
            {video.title || video.topic || 'Generated video'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="h-full w-full"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onClick={togglePlayback}
          />
          {!playing && (
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute inset-0 flex items-center justify-center"
              aria-label="Play"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                <Play className="ml-0.5 h-6 w-6 fill-current text-[#1d1d1f]" />
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#1d1d1f]"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>
          {video.topic && (
            <span className="truncate text-[11px] font-medium text-white/70">{video.topic}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onOpen }: { video: LibraryVideo; onOpen: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex w-full items-center justify-center overflow-hidden bg-[#1d1d1f]"
        style={{ aspectRatio: '16 / 9' }}
      >
        <video
          src={video.videoUrl}
          preload="metadata"
          muted
          className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-70"
        />
        <span className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-white/90 transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-4 w-4 fill-current text-[#1d1d1f]" />
        </span>
      </button>
      <div className="p-4">
        {video.topic && (
          <span className="mb-2 inline-flex max-w-full items-center rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 line-clamp-1">
            {video.topic}
          </span>
        )}
        <p className="truncate text-sm font-medium text-[#1d1d1f]">
          {video.title || video.topic || 'Untitled video'}
        </p>
      </div>
    </div>
  );
}

export function MyVideosPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openVideo, setOpenVideo] = useState<LibraryVideo | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth');
          return;
        }
        const result = await listUserVideos(session.user.id);
        setVideos(result.videos);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchVideos();
  }, [router]);

  return (
    <div>
      <div className="mb-6">
        <h1
          className={`${embedded ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} font-semibold tracking-tight text-[#1d1d1f] mb-1`}
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          My Video
        </h1>
        <p className={`${embedded ? 'text-base sm:text-lg' : 'text-sm'} text-[#6e6e73] font-light`}>
          Videos rendered from the AI Video Editing tab
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1d1f]">Generated videos</h2>
            <p className="text-[11px] text-[#6e6e73] font-light mt-0.5">
              Rendered videos saved to your account
            </p>
          </div>
          {!isLoading && videos.length > 0 && (
            <span className="text-[10px] font-medium text-[#6e6e73] bg-[#f5f5f7] px-2.5 py-1 rounded-full">
              {videos.length} video{videos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-[#6e6e73]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-light">Loading videos…</span>
            </div>
          ) : videos.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Clapperboard className="w-8 h-8 text-gray-200 mx-auto" />
              <p className="text-sm text-[#6e6e73]">No rendered videos yet.</p>
              <p className="text-[11px] text-[#6e6e73] font-light">
                Render a video from the AI Video Editing tab to see it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} onOpen={() => setOpenVideo(video)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openVideo && <VideoPreviewModal video={openVideo} onClose={() => setOpenVideo(null)} />}
    </div>
  );
}

export default function MyVideosPage() {
  return (
    <StudioShell>
      <MyVideosPanel embedded />
    </StudioShell>
  );
}
