'use client';

/** Product credit rates — single source for pricing UI examples */
export const CREDITS_PER_SCRIPT_MINUTE = 3;
export const CREDITS_PER_THUMBNAIL = 20;

const EXAMPLES: Array<{ minutes: number; withThumbnail: boolean }> = [
  { minutes: 5, withThumbnail: false },
  { minutes: 10, withThumbnail: true },
  { minutes: 20, withThumbnail: true },
];

function exampleTotal(minutes: number, withThumbnail: boolean): number {
  return (
    minutes * CREDITS_PER_SCRIPT_MINUTE +
    (withThumbnail ? CREDITS_PER_THUMBNAIL : 0)
  );
}

export default function CreditsHowItWorks() {
  return (
    <section className="mt-10 sm:mt-12 max-w-6xl mx-auto">
      <div className="rounded-3xl border border-gray-200 bg-[#1d1d1f] text-white px-6 sm:px-8 py-8 sm:py-10 shadow-sm">
        <h2
          className="text-xl sm:text-2xl font-semibold tracking-tight mb-2"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          How credits work
        </h2>
        <p className="text-sm sm:text-base text-white/60 font-light max-w-2xl mb-6 leading-relaxed">
          One pool, two actions. Generate a script for however long your video runs, and add a
          thumbnail only if you want one — nothing is bundled or forced.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
            <span className="text-sm font-medium text-white/90 font-mono">Script generation</span>
            <span className="text-sm font-semibold text-white whitespace-nowrap">
              {CREDITS_PER_SCRIPT_MINUTE} credits / min
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5">
            <span className="text-sm font-medium text-white/90 font-mono">Thumbnail (optional)</span>
            <span className="text-sm font-semibold text-white whitespace-nowrap">
              {CREDITS_PER_THUMBNAIL} credits / image
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {EXAMPLES.map(({ minutes, withThumbnail }) => {
            const total = exampleTotal(minutes, withThumbnail);
            const label = withThumbnail
              ? `${minutes} min script + thumbnail`
              : `${minutes} min script`;
            return (
              <div
                key={`${minutes}-${withThumbnail}`}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-mono"
              >
                <span className="text-white/55">{label}</span>
                <span className="text-white/40"> → </span>
                <span className="font-semibold text-white">{total} credits</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
