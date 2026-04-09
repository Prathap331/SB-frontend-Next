import { Sparkles, ImageIcon, VideoIcon } from 'lucide-react';

const features = [
  {
    icon: ImageIcon,
    title: 'AI Generated Images',
    badge: 'Coming Soon',
    description: 'Visuals that match your script\'s narrative and tone — generated automatically.',
    points: [
      {
        heading: 'Custom Scene Generation',
        body: 'Generate images that perfectly match your script\'s narrative and tone.',
      },
      {
        heading: 'Character Visualization',
        body: 'Bring your characters to life with AI-generated portraits and scenes.',
      },
    ],
  },
  {
    icon: VideoIcon,
    title: 'AI Generated Videos',
    badge: 'Coming Soon',
    description: 'Turn your finished script into a full video with a single click.',
    points: [
      {
        heading: 'Auto Scene Assembly',
        body: 'Automatically assemble video clips that align with each section of your script.',
      },
      {
        heading: 'Voice & Music Sync',
        body: 'AI-generated voiceover with background music that fits your content\'s mood.',
      },
    ],
  },
];

const ComingFeatures = () => {
  return (
    <section className="bg-[#f5f5f7] py-16 sm:py-10 px-5 sm:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 text-[#6e6e73] text-xs font-medium px-3.5 py-1 rounded-full mb-5 shadow-sm">
            <Sparkles className="w-3 h-3 text-purple-500" />
            What&apos;s next
          </div>
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Exciting features
            <br />
            <span className="text-[#6e6e73] font-light">on the horizon.</span>
          </h2>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-[#1d1d1f] rounded-3xl p-8 sm:p-10 flex flex-col gap-6 group hover:scale-[1.01] transition-transform duration-300"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-white bg-white/[0.07] border border-white/10 px-3 py-1 rounded-full tracking-wider uppercase">
                    {feature.badge}
                  </span>
                </div>

                {/* Title + description */}
                <div>
                  <h3
                    className="text-xl sm:text-2xl font-semibold text-white mb-2"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-[#a1a1a6] text-sm leading-relaxed font-light">
                    {feature.description}
                  </p>
                </div>

                {/* Feature points */}
                <div className="space-y-4 border-t border-white/10 pt-6">
                  {feature.points.map((point) => (
                    <div key={point.heading} className="flex gap-3">
                      <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white text-sm font-medium mb-0.5">{point.heading}</p>
                        <p className="text-[#6e6e73] text-sm leading-relaxed font-light">{point.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ComingFeatures;
