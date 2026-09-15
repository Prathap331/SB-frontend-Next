'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, Lock, Mic } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { canUseVoiceCloning, saveClonedVoiceProfile } from '@/lib/voice-clone';
import { VoiceCloneModal } from '@/components/studio/VoiceCloneModal';
import {
  CLONED_VOICE_WASH,
  VoiceCard,
  fetchClonedVoiceFromProfile,
  type VoicePreset,
} from '@/components/studio/StudioAudioPanel';

/**
 * Cloning tab — voice cloning only.
 * Speech generation lives in the AI video editing flow; this tab is just for
 * recording a voice clone and hearing it back.
 */
export function StudioCloningPanel() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const clonedAudioRef = useRef<InstanceType<typeof window.Audio> | null>(null);

  const cloningAllowed = canUseVoiceCloning(userTier);
  const voiceReady = Boolean(clonedAudioUrl);

  const clonedVoice: VoicePreset = useMemo(
    () => ({
      id: 'cloned',
      name: clonedVoiceName || 'Your voice',
      tags: 'Cloned · Personal · Ready',
      wash: CLONED_VOICE_WASH,
    }),
    [clonedVoiceName],
  );

  const loadClonedVoice = useCallback(
    async (id: string, opts?: { fallbackName?: string | null }) => {
      const { audioUrl, name } = await fetchClonedVoiceFromProfile(id);
      setClonedAudioUrl(audioUrl);
      setClonedVoiceName(name || opts?.fallbackName || null);
      if (audioUrl) saveClonedVoiceProfile(id);
      return audioUrl;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const id = session?.user?.id ?? null;
      setUserId(id);
      const metaName =
        session?.user?.user_metadata?.full_name ||
        session?.user?.user_metadata?.name ||
        null;
      if (!id) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_tier')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      setUserTier((profile?.user_tier || 'Free').trim() || 'Free');
      await loadClonedVoice(id, { fallbackName: metaName });
    })();
    return () => {
      cancelled = true;
      clonedAudioRef.current?.pause();
      clonedAudioRef.current = null;
    };
  }, [loadClonedVoice]);

  const openCloneModal = useCallback(() => {
    if (!cloningAllowed) {
      toast.error('Voice cloning is available on Plus and Pro plans', {
        action: {
          label: 'Upgrade',
          onClick: () => router.push('/pricing'),
        },
      });
      return;
    }
    setCloneOpen(true);
  }, [cloningAllowed, router]);

  const handleCloned = useCallback(async () => {
    if (!userId) return;
    saveClonedVoiceProfile(userId);
    // The backend may write audio-url shortly after /save-audio returns.
    let url = await loadClonedVoice(userId);
    if (!url) {
      await new Promise((r) => setTimeout(r, 1000));
      url = await loadClonedVoice(userId);
    }
    if (url) toast.success('Your voice is ready');
  }, [userId, loadClonedVoice]);

  const handlePreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!clonedAudioUrl) return;
      const audio = clonedAudioRef.current ?? new window.Audio();
      clonedAudioRef.current = audio;
      if (isPreviewing) {
        audio.pause();
        audio.currentTime = 0;
        setIsPreviewing(false);
        return;
      }
      audio.src = clonedAudioUrl;
      audio.onended = () => setIsPreviewing(false);
      void audio.play().catch(() => {
        toast.error('Could not play cloned voice sample');
        setIsPreviewing(false);
      });
      setIsPreviewing(true);
    },
    [clonedAudioUrl, isPreviewing],
  );

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-baseline gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">Voice cloning</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6e6e73]">
            Plus &amp; Pro
          </span>
        </div>
        <p className="text-xs text-[#6e6e73] font-light mb-4">
          Record a short sample once. Your cloned voice is then available as a voice option when
          you generate a video.
        </p>

        {cloningAllowed ? (
          <>
            <div className="flex flex-wrap items-stretch gap-3">
              {voiceReady && (
                <div className="w-[150px] sm:w-[168px]">
                  <VoiceCard
                    voice={clonedVoice}
                    active
                    onSelect={() => {}}
                    onPreview={handlePreview}
                    isPreviewing={isPreviewing}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={openCloneModal}
                className="inline-flex items-center gap-2 self-center rounded-md border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#1d1d1f] hover:border-gray-400 hover:bg-[#fafafa] transition-all"
              >
                <Mic className="w-4 h-4 text-[#6e6e73]" />
                {voiceReady ? 'Re-clone your voice' : 'Clone your voice'}
              </button>
            </div>
            {!voiceReady && (
              <p className="text-xs text-[#6e6e73] mt-3 font-light">
                Clone your voice once to use your own sound for voiceovers.
              </p>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-[#fafafa] px-4 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3.5 h-3.5 text-[#6e6e73]" />
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  Upgrade to unlock voice cloning
                </p>
              </div>
              <p className="text-xs text-[#6e6e73] font-light">
                Available on Plus and Pro. Clone your voice and use it for script voiceovers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/pricing')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-xs font-semibold px-4 py-2.5 flex-shrink-0"
            >
              View plans
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      <VoiceCloneModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={handleCloned}
        userId={userId}
      />
    </div>
  );
}
