'use client';

import { Volume2, VolumeX } from 'lucide-react';
import type { TimelineTrack } from '@/lib/video-editor/types';
import { trackHeightPx } from './trackLayout';

type Props = {
  track: TimelineTrack;
  width: number;
  onChange: (patch: Partial<TimelineTrack>) => void;
};

export function TrackHeader({ track, width, onChange }: Props) {
  const isAudio = track.type === 'voiceover' || track.type === 'music';
  return (
    <div
      className="flex flex-shrink-0 items-center gap-1.5 border-b border-gray-100 bg-white px-2.5"
      style={{ width, height: trackHeightPx(track) }}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#1d1d1f]">
        {track.name}
      </span>
      <span className="text-[10px] tabular-nums text-[#a1a1a6]">{track.clips.length}</span>
      {isAudio ? (
        <button
          type="button"
          className="rounded p-0.5 text-[#86868b] hover:bg-gray-100"
          title={track.muted ? 'Unmute' : 'Mute'}
          onClick={() => onChange({ muted: !track.muted })}
        >
          {track.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      ) : null}
    </div>
  );
}
