'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Tags,
  Volume2,
} from 'lucide-react';
import { unwrapScriptJson } from '@/lib/script-data';
import {
  hasClonedVoice,
  saveClonedVoiceProfile,
} from '@/lib/voice-clone';
import { VoiceCloneModal } from '@/components/studio/VoiceCloneModal';
import { supabase } from '@/lib/supabaseClient';

type VoicePreset = {
  id: string;
  name: string;
  tags: string;
  avatar: string;
};

const VOICE_PRESETS: VoicePreset[] = [
  { id: 'sarah', name: 'Sarah', tags: 'Warm · Clear · Natural', avatar: 'from-rose-300 to-orange-200' },
  { id: 'adrian', name: 'Adrian', tags: 'Deep · Confident · Steady', avatar: 'from-zinc-700 to-zinc-500' },
  { id: 'maya', name: 'Maya', tags: 'Soft · Empathetic · Calm', avatar: 'from-sky-300 to-teal-200' },
  { id: 'kai', name: 'Kai', tags: 'Energetic · Bright · Modern', avatar: 'from-amber-300 to-yellow-200' },
  { id: 'narrator', name: 'Narrator', tags: 'Immersive · Nuanced · Warm', avatar: 'from-stone-400 to-stone-300' },
  { id: 'support', name: 'Support', tags: 'Patient · Reassuring · Knowledgeable', avatar: 'from-emerald-300 to-lime-200' },
];

const YOUR_VOICE: VoicePreset = {
  id: 'cloned',
  name: 'Your voice',
  tags: 'Cloned · Personal · Ready',
  avatar: 'from-[#1d1d1f] to-zinc-600',
};

const SPEECH_TAGS = ['pause', 'emphasis', 'reflective', 'whisper', 'excited'] as const;

const MAX_CHARS = 30_000;

function scriptToSpeechText(raw?: string | null): string {
  if (!raw?.trim()) return '';
  return unwrapScriptJson(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\*\*\*/g, '\n\n')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .trim();
}

export function StudioAudioPanel({
  scriptText,
  isUnlocked = false,
  ideaTitle,
  onGoToScript,
}: {
  scriptText?: string | null;
  isUnlocked?: boolean;
  ideaTitle?: string;
  onGoToScript?: () => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_PRESETS[1].id);
  const [text, setText] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAudioPreview, setHasAudioPreview] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const unlockedScript = useMemo(
    () => (isUnlocked ? scriptToSpeechText(scriptText) : ''),
    [isUnlocked, scriptText],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const id = session?.user?.id ?? null;
      setUserId(id);
      const ready = hasClonedVoice(id);
      setVoiceReady(ready);
      if (ready) setSelectedVoice('cloned');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!unlockedScript) return;
    setText((prev) => (prev.trim() ? prev : unlockedScript.slice(0, MAX_CHARS)));
  }, [unlockedScript]);

  const insertTag = useCallback((tag: string) => {
    const el = textareaRef.current;
    const token = `[${tag}]`;
    if (!el) {
      setText((prev) => `${prev}${prev ? ' ' : ''}${token}`);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${token}${text.slice(end)}`.slice(0, MAX_CHARS);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }, [text]);

  const openCloneModal = useCallback(() => {
    setCloneOpen(true);
  }, []);

  const handleCloned = useCallback(() => {
    if (userId) saveClonedVoiceProfile(userId);
    setVoiceReady(true);
    setSelectedVoice('cloned');
  }, [userId]);

  const handleSelectVoice = useCallback(
    (id: string) => {
      if (id === 'cloned' && !voiceReady) {
        openCloneModal();
        return;
      }
      setSelectedVoice(id);
    },
    [voiceReady, openCloneModal],
  );

  const handleGenerate = useCallback(async () => {
    if (!text.trim()) return;

    // No cloned voice on profile → open popup to record first.
    if (!voiceReady) {
      openCloneModal();
      return;
    }

    // Already cloned → generate (defaults to "Your voice" when clone exists).
    setIsGenerating(true);
    setHasAudioPreview(false);
    setIsPlayingPreview(false);
    await new Promise((r) => setTimeout(r, 1400));
    setIsGenerating(false);
    setHasAudioPreview(true);
  }, [text, voiceReady, openCloneModal]);

  const voiceOptions = useMemo(() => {
    if (!voiceReady) return VOICE_PRESETS;
    return [YOUR_VOICE, ...VOICE_PRESETS];
  }, [voiceReady]);

  const activeVoiceName =
    voiceOptions.find((v) => v.id === selectedVoice)?.name ??
    (selectedVoice === 'cloned' ? 'Your voice' : 'Voice');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-[#6e6e73] uppercase mb-1">
            Audio
          </p>
          <h2
            className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            Turn your script into speech
          </h2>
          <p className="text-sm text-[#6e6e73] mt-1 font-light">
            {isUnlocked && unlockedScript
              ? `Unlocked script${ideaTitle ? ` · ${ideaTitle}` : ''} is ready for voiceover.`
              : 'Unlock a script to auto-fill text, or write your own lines.'}
          </p>
        </div>
        {!isUnlocked && onGoToScript && (
          <button
            type="button"
            onClick={onGoToScript}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
          >
            Unlock script first
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] min-h-[420px]">
          <aside className="border-b lg:border-b-0 lg:border-r border-gray-100 p-4 flex flex-col">
            <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wide mb-3 px-1">
              Voices
            </p>
            <div className="space-y-1 flex-1 overflow-y-auto max-h-64 lg:max-h-none pr-1">
              {voiceOptions.map((v) => {
                const active = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVoice(v.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-all ${
                      active ? 'bg-[#f0eee9]' : 'hover:bg-[#f5f5f7]'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${v.avatar} flex-shrink-0 ring-2 ${
                        active ? 'ring-[#1d1d1f]/20' : 'ring-transparent'
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[#1d1d1f] truncate">
                        {v.name}
                      </span>
                      <span className="block text-[10px] text-[#6e6e73] truncate">{v.tags}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={openCloneModal}
              className="mt-3 text-left text-xs text-[#6e6e73] hover:text-[#1d1d1f] px-1 inline-flex items-center gap-1"
            >
              {voiceReady ? 'Re-clone your voice' : 'Clone your own voice'}
              <ChevronRight className="w-3 h-3" />
            </button>
          </aside>

          <div className="p-5 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm text-[#6e6e73]">Enter your own text</p>
              {unlockedScript && (
                <button
                  type="button"
                  onClick={() => setText(unlockedScript.slice(0, MAX_CHARS))}
                  className="text-[11px] font-medium text-[#1d1d1f] underline underline-offset-2"
                >
                  Use unlocked script
                </button>
              )}
            </div>

            <div className="relative flex-1 min-h-[220px]">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Paste or type the lines you want spoken…"
                className="w-full h-full min-h-[220px] resize-none rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3 text-sm text-[#1d1d1f] leading-relaxed placeholder:text-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15 focus:border-[#1d1d1f]"
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTagsOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:border-gray-300"
                >
                  <Tags className="w-3.5 h-3.5" />
                  Tags
                  <ChevronRight className={`w-3 h-3 transition-transform ${tagsOpen ? 'rotate-90' : ''}`} />
                </button>
                {tagsOpen && (
                  <div className="absolute left-0 bottom-full mb-2 z-10 flex flex-wrap gap-1.5 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg w-56">
                    {SPEECH_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          insertTag(tag);
                          setTagsOpen(false);
                        }}
                        className="rounded-md bg-[#1d1d1f] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-black"
                      >
                        [{tag}]
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="sm:ml-auto text-[11px] text-[#6e6e73]">
                {text.length.toLocaleString()}/{MAX_CHARS.toLocaleString()} characters
              </p>

              <button
                type="button"
                disabled={!text.trim() || isGenerating}
                onClick={handleGenerate}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium px-5 py-2.5 disabled:opacity-50 transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : hasAudioPreview ? (
                  <>
                    <Play className="w-4 h-4" />
                    Regenerate & play
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Generate & play
                  </>
                )}
              </button>
            </div>

            {hasAudioPreview && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-[#f5f5f7] px-4 py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlayingPreview((p) => !p)}
                  className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-gray-300"
                >
                  {isPlayingPreview ? (
                    <Pause className="w-4 h-4 text-[#1d1d1f]" />
                  ) : (
                    <Play className="w-4 h-4 text-[#1d1d1f] ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="h-8 flex items-end gap-[3px]">
                    {Array.from({ length: 48 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full bg-[#1d1d1f]/70 ${
                          isPlayingPreview ? 'animate-pulse' : ''
                        }`}
                        style={{
                          height: `${20 + ((i * 17) % 60)}%`,
                          animationDelay: `${i * 40}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-[#6e6e73] mt-1 truncate">
                    Preview · {activeVoiceName} · frontend demo
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <VoiceCloneModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={handleCloned}
      />
    </div>
  );
}

/** @deprecated import from `@/lib/voice-clone` */
export { VOICE_CLONE_PROMPT } from '@/lib/voice-clone';
