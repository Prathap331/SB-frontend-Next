'use client';

import { useMemo } from 'react';
import type { RemotionInfographicSpec } from '@/lib/video-editor/infographics';
import { InfographicRenderer } from '@/remotion/InfographicRenderer';
import { specToInfographicData } from '@/remotion/data';

type Props = {
  spec: RemotionInfographicSpec;
  width?: number;
  height?: number;
};

/** Modal / library preview — passes the complete InfographicData into Remotion. */
export function RemotionInfographicPreview({ spec, width = 1920, height = 1080 }: Props) {
  // Stable identity so the autoplaying Player is not handed a new payload each render.
  const data = useMemo(() => specToInfographicData(spec), [spec]);

  if (spec.durationFrames <= 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black px-8 text-center text-white/80">
        <p className="text-sm font-semibold">Invalid infographic duration</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <InfographicRenderer data={data} width={width} height={height} previewMode currentTime={0} />
    </div>
  );
}
