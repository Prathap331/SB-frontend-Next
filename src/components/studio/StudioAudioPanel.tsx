'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Globe2,
  Loader2,
  Lock,
  Mic,
  Pause,
  Play,
  Search,
  Volume2,
  X,
} from 'lucide-react';
import {
  getScriptTextFromMap,
  parseScriptLanguageMap,
  unwrapScriptJson,
  wrapEnglishScript,
  type ScriptLanguageMap,
} from '@/lib/script-data';
import {
  DEFAULT_SCRIPT_LANGUAGE,
  scriptLanguageCode,
  scriptLanguageLabel,
} from '@/lib/script-languages';
import { canUseVoiceCloning, saveClonedVoiceProfile } from '@/lib/voice-clone';
import { appendScriptAudioUrl } from '@/lib/script-persistence';
import { SPEECH_SUPPORTED_LANGUAGES } from '@/lib/speech-languages';
import { VoiceCloneModal } from '@/components/studio/VoiceCloneModal';
import { supabase } from '@/lib/supabaseClient';
import { ApiService } from '@/services/api';
import { toast } from 'sonner';

type VoicePreset = {
  /** Row id from pre-made-voices (string) or "cloned" */
  id: string;
  name: string;
  tags: string;
  /** Soft card wash — warm earth tones like the reference */
  wash: string;
  /** Preview sample URL from pre-made-voices.audio */
  audioUrl?: string | null;
  /** Model id from pre-made-voices."reference-Id" → /generate-speech reference_id */
  referenceId?: string | null;
};

const VOICE_WASHES = [
  'from-[#f0d9c8] via-[#e8c4a8] to-[#d4a88a]',
  'from-[#e8ddd0] via-[#d4c4b0] to-[#b8a090]',
  'from-[#f5e6d8] via-[#edd4c0] to-[#c9a88a]',
  'from-[#efe0d0] via-[#e0c8b0] to-[#c4a078]',
  'from-[#f2e4d4] via-[#e8d0b8] to-[#d0b090]',
  'from-[#ebe0d4] via-[#dcc8b4] to-[#c4a892]',
  'from-[#f0e6dc] via-[#e2d0c0] to-[#c8b09a]',
] as const;

const CLONED_VOICE_WASH = 'from-[#e8e4df] via-[#d4cfc8] to-[#b8b2a8]';

type PreMadeVoiceRow = {
  id: number | string;
  name?: string | null;
  audio?: string | null;
  description?: string | null;
  'reference-Id'?: string | null;
  reference_id?: string | null;
};

function mapPreMadeVoice(row: PreMadeVoiceRow, index: number): VoicePreset | null {
  const referenceId = String(row['reference-Id'] ?? row.reference_id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!referenceId || !name) return null;
  return {
    id: String(row.id),
    name,
    tags: String(row.description ?? '').trim() || 'Premade voice',
    wash: VOICE_WASHES[index % VOICE_WASHES.length],
    audioUrl: String(row.audio ?? '').trim() || null,
    referenceId,
  };
}

async function fetchPreMadeVoices(): Promise<VoicePreset[]> {
  const attempts = [
    'id, name, audio, description, "reference-Id"',
    'id, name, audio, description, reference_id',
  ] as const;

  for (const select of attempts) {
    const { data, error } = await supabase
      .from('pre-made-voices')
      .select(select)
      .order('id', { ascending: true });
    if (error || !data) continue;
    const mapped = (data as PreMadeVoiceRow[])
      .map((row, i) => mapPreMadeVoice(row, i))
      .filter((v): v is VoicePreset => Boolean(v));
    if (mapped.length) return mapped;
  }
  return [];
}

/** Load cloned voice URL + display name from user_profiles. */
async function fetchClonedVoiceFromProfile(userId: string): Promise<{
  audioUrl: string | null;
  name: string | null;
}> {
  // Column may be stored as audio-url or audio_url depending on schema.
  const attempts = ['full_name, "audio-url"', 'full_name, audio_url'] as const;
  let row: Record<string, unknown> | null = null;

  for (const select of attempts) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(select)
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      row = data as Record<string, unknown>;
      break;
    }
  }

  const audioUrl = String(row?.audio_url ?? row?.['audio-url'] ?? '').trim();
  const name = String(row?.full_name ?? '').trim();
  return {
    audioUrl: audioUrl || null,
    name: name || null,
  };
}

function VoiceWaveform({ className = '' }: { className?: string }) {
  const bars = [3, 8, 12, 16, 11, 18, 9, 14, 7, 16, 5, 12, 15, 9, 6, 11, 4];
  return (
    <div className={`flex items-center justify-center gap-[2.5px] ${className}`} aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-[#3d3d3a]/55"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function VoiceCard({
  voice,
  active,
  onSelect,
  onPreview,
  isPreviewing,
}: {
  voice: VoicePreset;
  active: boolean;
  onSelect: () => void;
  onPreview: (e: React.MouseEvent) => void;
  isPreviewing: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`relative w-full h-[148px] rounded-2xl overflow-hidden text-left cursor-pointer transition-all ${
        active
          ? 'ring-2 ring-[#1d1d1f] ring-offset-2 shadow-md'
          : 'ring-1 ring-black/5 hover:ring-black/15 shadow-sm'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${voice.wash}`} />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.55) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(120,80,50,0.18) 0%, transparent 45%)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-3 pt-2.5 pb-2">
        <p className="text-[12px] font-semibold text-[#1d1d1f]/90 tracking-tight truncate">
          {voice.name}
        </p>

        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-h-0">
          <button
            type="button"
            onClick={onPreview}
            className="w-9 h-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
            aria-label={isPreviewing ? `Pause ${voice.name}` : `Preview ${voice.name}`}
          >
            {isPreviewing ? (
              <Pause className="w-3.5 h-3.5 text-[#1d1d1f]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#1d1d1f] ml-0.5" />
            )}
          </button>
          <VoiceWaveform />
        </div>

        {/* Frosted tag bar — rectangular; full tags visible */}
        <div className="rounded-md bg-white/45 backdrop-blur-md border border-white/50 px-2 py-1.5 shadow-sm">
          <p className="text-[10px] sm:text-[11px] font-medium text-[#1d1d1f]/85 leading-snug text-center">
            {voice.tags}
          </p>
        </div>
      </div>
    </div>
  );
}

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
  scriptsByLanguage,
  initialLanguage = DEFAULT_SCRIPT_LANGUAGE,
  isUnlocked = false,
  ideaTitle,
  scriptAudio,
  scriptRowId,
  freeform = false,
  onGoToScript,
  onScriptAudioChange,
  onLanguageChange,
}: {
  scriptText?: string | null;
  /** Multilingual map from scripts_assigned.script jsonb */
  scriptsByLanguage?: ScriptLanguageMap | null;
  /** Language selected on Script tab when navigating here */
  initialLanguage?: string;
  isUnlocked?: boolean;
  ideaTitle?: string;
  /** Saved speech URLs from scripts_assigned.script_audio */
  scriptAudio?: string[] | null;
  /** scripts_assigned row id used to persist new speech URLs */
  scriptRowId?: string | number | null;
  /** No topic / unlocked script — empty box, user can type anything */
  freeform?: boolean;
  onGoToScript?: () => void;
  onScriptAudioChange?: (urls: string[]) => void;
  onLanguageChange?: (language: string, script: string) => void;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  const [clonedAudioUrl, setClonedAudioUrl] = useState<string | null>(null);
  const [clonedVoiceName, setClonedVoiceName] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsReady, setTagsReady] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [taggedScript, setTaggedScript] = useState<string | null>(null);
  const [savedAudioUrls, setSavedAudioUrls] = useState<string[]>([]);
  const [playingSavedUrl, setPlayingSavedUrl] = useState<string | null>(null);
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [languageMap, setLanguageMap] = useState<ScriptLanguageMap>({});
  const [selectedLang, setSelectedLang] = useState(
    (initialLanguage || DEFAULT_SCRIPT_LANGUAGE).toLowerCase(),
  );
  const [scriptLangMenuOpen, setScriptLangMenuOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const clonedAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const savedAudioRef = useRef<HTMLAudioElement | null>(null);
  const langSearchRef = useRef<HTMLInputElement | null>(null);
  const scriptLangMenuRef = useRef<HTMLDivElement | null>(null);
  const appliedLangKeyRef = useRef<string>('');

  const voiceReady = Boolean(clonedAudioUrl);
  const cloningAllowed = canUseVoiceCloning(userTier);
  const clonedVoice: VoicePreset = useMemo(
    () => ({
      id: 'cloned',
      name: clonedVoiceName || 'Your voice',
      tags: 'Cloned · Personal · Ready',
      wash: CLONED_VOICE_WASH,
    }),
    [clonedVoiceName],
  );

  const availableScriptLangs = useMemo(() => {
    const keys = Object.keys(languageMap).filter((k) => languageMap[k]?.trim());
    return keys.sort((a, b) => {
      if (a === DEFAULT_SCRIPT_LANGUAGE) return -1;
      if (b === DEFAULT_SCRIPT_LANGUAGE) return 1;
      return scriptLanguageLabel(a).localeCompare(scriptLanguageLabel(b));
    });
  }, [languageMap]);

  const unlockedScript = useMemo(() => {
    if (!isUnlocked) return '';
    const fromMap = getScriptTextFromMap(languageMap, selectedLang);
    return scriptToSpeechText(fromMap || scriptText);
  }, [isUnlocked, languageMap, selectedLang, scriptText]);

  const loadClonedVoice = useCallback(async (
    id: string,
    opts?: { fallbackName?: string | null; selectIfReady?: boolean },
  ) => {
    const { audioUrl, name } = await fetchClonedVoiceFromProfile(id);
    setClonedAudioUrl(audioUrl);
    setClonedVoiceName(name || opts?.fallbackName || null);
    if (audioUrl) {
      saveClonedVoiceProfile(id);
      if (opts?.selectIfReady !== false) {
        setSelectedVoice('cloned');
      }
    }
    return audioUrl;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setVoicesLoading(true);
      try {
        const voices = await fetchPreMadeVoices();
        if (cancelled) return;
        setVoicePresets(voices);
        setSelectedVoice((prev) => {
          if (prev === 'cloned') return prev;
          if (prev && voices.some((v) => v.id === prev)) return prev;
          return voices[0]?.id ?? '';
        });
      } catch (err) {
        console.error('[pre-made-voices]', err);
        if (!cancelled) toast.error('Could not load voices');
      } finally {
        if (!cancelled) setVoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const tier = (profile?.user_tier || 'Free').trim() || 'Free';
      setUserTier(tier);

      await loadClonedVoice(id, {
        fallbackName: metaName,
        selectIfReady: canUseVoiceCloning(tier),
      });
    })();
    return () => {
      cancelled = true;
      clonedAudioRef.current?.pause();
      clonedAudioRef.current = null;
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      savedAudioRef.current?.pause();
      savedAudioRef.current = null;
    };
  }, [loadClonedVoice]);

  // Load multilingual script from scripts_assigned.script (jsonb) when Audio opens
  useEffect(() => {
    if (freeform || !isUnlocked) {
      setLanguageMap({});
      return;
    }

    let cancelled = false;

    const pickLang = (map: ScriptLanguageMap, preferred?: string) => {
      const want = (preferred || DEFAULT_SCRIPT_LANGUAGE).toLowerCase();
      if (map[want]?.trim()) return want;
      if (map[DEFAULT_SCRIPT_LANGUAGE]?.trim()) return DEFAULT_SCRIPT_LANGUAGE;
      const first = Object.keys(map).find((k) => map[k]?.trim());
      return first || DEFAULT_SCRIPT_LANGUAGE;
    };

    const applyMap = (map: ScriptLanguageMap) => {
      if (cancelled) return;
      setLanguageMap(map);
      const lang = pickLang(map, initialLanguage);
      setSelectedLang(lang);
    };

    (async () => {
      let map: ScriptLanguageMap = {};

      if (scriptRowId) {
        const { data, error } = await supabase
          .from('scripts_assigned')
          .select('script')
          .eq('id', scriptRowId)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data?.script != null) {
          map = parseScriptLanguageMap(data.script);
        }
      }

      if (!Object.keys(map).length && scriptsByLanguage && Object.keys(scriptsByLanguage).length) {
        map = { ...scriptsByLanguage };
      }
      if (!Object.keys(map).length && scriptText?.trim()) {
        map = wrapEnglishScript(scriptText);
      }

      applyMap(map);
    })();

    return () => {
      cancelled = true;
    };
    // Remounts when switching to Audio tab; re-fetch for latest translations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeform, isUnlocked, scriptRowId]);

  // Keep selected language in sync when Script tab language changes before remount
  useEffect(() => {
    if (freeform || !isUnlocked) return;
    const lang = (initialLanguage || DEFAULT_SCRIPT_LANGUAGE).toLowerCase();
    if (languageMap[lang]?.trim()) {
      setSelectedLang(lang);
    }
  }, [initialLanguage, languageMap, freeform, isUnlocked]);

  // Fill textarea with the selected language script
  useEffect(() => {
    if (freeform || !isUnlocked) return;
    if (!unlockedScript) return;
    const key = `${selectedLang}:${unlockedScript.slice(0, 80)}:${unlockedScript.length}`;
    if (appliedLangKeyRef.current === key) return;
    appliedLangKeyRef.current = key;
    setText(unlockedScript.slice(0, MAX_CHARS));
  }, [unlockedScript, selectedLang, freeform, isUnlocked]);

  useEffect(() => {
    const urls = Array.isArray(scriptAudio)
      ? scriptAudio.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
      : [];
    setSavedAudioUrls(urls);
  }, [scriptAudio]);

  useEffect(() => {
    if (!languagesOpen) {
      setLangSearch('');
      return;
    }
    const focusTimer = window.setTimeout(() => langSearchRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLanguagesOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
    };
  }, [languagesOpen]);

  useEffect(() => {
    if (!scriptLangMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!scriptLangMenuRef.current?.contains(e.target as Node)) {
        setScriptLangMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScriptLangMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [scriptLangMenuOpen]);

  const filteredSpeechLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return SPEECH_SUPPORTED_LANGUAGES;
    return SPEECH_SUPPORTED_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  }, [langSearch]);

  const selectScriptLanguage = useCallback(
    (lang: string) => {
      const key = lang.toLowerCase();
      setScriptLangMenuOpen(false);
      if (!languageMap[key]?.trim()) return;
      setSelectedLang(key);
      const next = scriptToSpeechText(languageMap[key]).slice(0, MAX_CHARS);
      appliedLangKeyRef.current = `${key}:${next.slice(0, 80)}:${next.length}`;
      setText(next);
      onLanguageChange?.(key, next);
    },
    [languageMap, onLanguageChange],
  );

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
    // Backend may write audio-url shortly after /save-audio returns.
    let url = await loadClonedVoice(userId, { selectIfReady: true });
    if (!url) {
      await new Promise((r) => setTimeout(r, 1000));
      url = await loadClonedVoice(userId, { selectIfReady: true });
    }
    if (url) setSelectedVoice('cloned');
  }, [userId, loadClonedVoice]);

  const handleSelectVoice = useCallback((id: string) => {
    setSelectedVoice(id);
  }, []);

  const stopAllPreviews = useCallback(() => {
    if (clonedAudioRef.current) {
      clonedAudioRef.current.pause();
      clonedAudioRef.current.currentTime = 0;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
  }, []);

  const selectedPreset = useMemo(
    () => voicePresets.find((v) => v.id === selectedVoice) ?? null,
    [voicePresets, selectedVoice],
  );

  const handlePreviewVoice = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedVoice(id);

    if (previewVoiceId === id) {
      stopAllPreviews();
      setPreviewVoiceId(null);
      return;
    }

    stopAllPreviews();

    if (id === 'cloned' && clonedAudioUrl) {
      const audio = clonedAudioRef.current ?? new Audio();
      audio.src = clonedAudioUrl;
      audio.onended = () => setPreviewVoiceId(null);
      clonedAudioRef.current = audio;
      void audio.play().catch(() => {
        toast.error('Could not play cloned voice sample');
        setPreviewVoiceId(null);
      });
      setPreviewVoiceId('cloned');
      return;
    }

    const preset = voicePresets.find((v) => v.id === id);
    const sampleUrl = preset?.audioUrl?.trim();
    if (!sampleUrl) {
      toast.error('No preview available for this voice');
      return;
    }

    const audio = previewAudioRef.current ?? new Audio();
    audio.src = sampleUrl;
    audio.onended = () => setPreviewVoiceId(null);
    previewAudioRef.current = audio;
    void audio.play().catch(() => {
      toast.error('Could not play voice sample');
      setPreviewVoiceId(null);
    });
    setPreviewVoiceId(id);
  }, [clonedAudioUrl, previewVoiceId, stopAllPreviews, voicePresets]);

  const activeVoiceName =
    selectedVoice === 'cloned'
      ? clonedVoice.name
      : selectedPreset?.name ?? 'Voice';

  const voiceSelected = Boolean(selectedVoice);
  const scriptReady = Boolean(text.trim());
  const canGenerate = voiceSelected && scriptReady;

  const speechVoiceValue = useCallback(() => {
    if (selectedVoice === 'cloned') return 'user';
    return (selectedPreset?.name || 'voice').trim().toLowerCase() || 'voice';
  }, [selectedVoice, selectedPreset]);

  const speechReferenceId = useCallback(() => {
    if (selectedVoice === 'cloned') return null;
    return selectedPreset?.referenceId?.trim() || null;
  }, [selectedVoice, selectedPreset]);

  const openConfirm = useCallback(async () => {
    if (tagsLoading || isGenerating) return;
    if (!canGenerate) return;
    if (!userId) {
      toast.error('Please sign in to generate audio');
      return;
    }

    setConfirmOpen(true);
    setTagsReady(false);
    setTagsError(null);
    setTaggedScript(null);
    setTagsLoading(true);

    try {
      const result = await ApiService.addScriptTags({
        userId,
        script: text.trim(),
      });
      setTaggedScript(result.tagged_script);
      setTagsReady(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to prepare script for audio';
      setTagsError(message);
      setTagsReady(false);
      setTaggedScript(null);
      toast.error(message);
    } finally {
      setTagsLoading(false);
    }
  }, [canGenerate, tagsLoading, isGenerating, userId, text]);

  const runGenerate = useCallback(async () => {
    if (!canGenerate || !tagsReady || !taggedScript || tagsLoading || isGenerating) return;
    if (!userId) {
      toast.error('Please sign in to generate audio');
      return;
    }

    setIsGenerating(true);
    try {
      const { audioUrl, raw } = await ApiService.generateSpeech({
        userId,
        script: taggedScript,
        voice: speechVoiceValue(),
        langCode: freeform ? 'en' : scriptLanguageCode(selectedLang),
        reference_id: speechReferenceId(),
      });

      setConfirmOpen(false);

      // Prefer parsed URL; fall back to deep scan of raw response
      const resolvedUrl = (() => {
        if (typeof audioUrl === 'string' && /^https?:\/\//i.test(audioUrl.trim())) {
          return audioUrl.trim();
        }
        const scan = (v: unknown, depth = 0): string | null => {
          if (depth > 4 || v == null) return null;
          if (typeof v === 'string') {
            const t = v.trim();
            return /^https?:\/\//i.test(t) ? t : null;
          }
          if (Array.isArray(v)) {
            for (const item of v) {
              const found = scan(item, depth + 1);
              if (found) return found;
            }
            return null;
          }
          if (typeof v === 'object') {
            for (const val of Object.values(v as Record<string, unknown>)) {
              const found = scan(val, depth + 1);
              if (found) return found;
            }
          }
          return null;
        };
        return scan(raw);
      })();

      if (!resolvedUrl) {
        toast.success('Speech generated');
        return;
      }

      const isPublicUrl = /^https?:\/\//i.test(resolvedUrl);
      let nextUrls = savedAudioUrls.includes(resolvedUrl)
        ? savedAudioUrls
        : [...savedAudioUrls, resolvedUrl];

      const rowId = scriptRowId != null && scriptRowId !== '' ? String(scriptRowId) : '';
      if (isPublicUrl && rowId) {
        const save = await appendScriptAudioUrl({
          scriptRowId: rowId,
          userId,
          audioUrl: resolvedUrl,
        });
        if (!save.ok) {
          toast.error(save.error || 'Speech generated, but failed to save');
        } else if (save.urls) {
          nextUrls = save.urls;
        }
      } else if (isPublicUrl && !rowId && !freeform) {
        toast.error('Speech generated, but no unlocked script to save it on');
      } else if (!isPublicUrl) {
        toast.error('Speech generated, but URL is not saveable yet');
      }

      setSavedAudioUrls(nextUrls);
      onScriptAudioChange?.(nextUrls);

      // Auto-play the newest clip in the generated list
      const audio = savedAudioRef.current ?? new Audio();
      audio.src = resolvedUrl;
      audio.onended = () => setPlayingSavedUrl(null);
      savedAudioRef.current = audio;
      void audio.play().then(() => setPlayingSavedUrl(resolvedUrl)).catch(() => {
        setPlayingSavedUrl(null);
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate speech';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    tagsReady,
    taggedScript,
    tagsLoading,
    isGenerating,
    userId,
    speechVoiceValue,
    speechReferenceId,
    savedAudioUrls,
    scriptRowId,
    freeform,
    selectedLang,
    onScriptAudioChange,
  ]);

  const closeConfirm = useCallback(() => {
    if (tagsLoading || isGenerating) return;
    setConfirmOpen(false);
  }, [tagsLoading, isGenerating]);

  const downloadAudioUrl = useCallback(async (url: string, index?: number) => {
    if (!url) {
      toast.error('No audio available to download');
      return;
    }

    const safeName = (activeVoiceName || 'voice')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const ext = url.toLowerCase().includes('.mp3') ? 'mp3' : 'wav';
    const filename = `storio-speech-${safeName || 'audio'}${
      typeof index === 'number' ? `-${index + 1}` : ''
    }.${ext}`;

    try {
      let href = url;
      let revokeAfter: string | null = null;

      if (!url.startsWith('blob:')) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch audio file');
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
        revokeAfter = href;
      }

      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (revokeAfter) URL.revokeObjectURL(revokeAfter);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [activeVoiceName]);

  const toggleSavedPlayback = useCallback((url: string) => {
    if (playingSavedUrl === url) {
      savedAudioRef.current?.pause();
      setPlayingSavedUrl(null);
      return;
    }

    const audio = savedAudioRef.current ?? new Audio();
    audio.src = url;
    audio.onended = () => setPlayingSavedUrl(null);
    savedAudioRef.current = audio;
    void audio.play().then(() => {
      setPlayingSavedUrl(url);
    }).catch(() => {
      setPlayingSavedUrl(null);
      toast.error('Could not play saved audio');
    });
  }, [playingSavedUrl]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[#6e6e73] uppercase mb-1">
            Audio
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2
              className="text-xl sm:text-2xl font-semibold text-[#1d1d1f] tracking-tight"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
            >
              Turn your script into speech
            </h2>
            <button
              type="button"
              onClick={() => setLanguagesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 px-3 py-1 text-[11px] font-semibold transition-colors"
            >
              <Globe2 className="w-3.5 h-3.5" />
              Supported languages
            </button>
          </div>
          <p className="text-sm text-[#6e6e73] mt-1 font-light">
            {freeform
              ? 'Write anything below and generate speech — no topic required.'
              : isUnlocked && unlockedScript
                ? `Unlocked script${ideaTitle ? ` · ${ideaTitle}` : ''} is ready for voiceover.`
                : 'Unlock a script to auto-fill text, or write your own lines.'}
          </p>
        </div>
        {!freeform && !isUnlocked && onGoToScript && (
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

      {/* Voices */}
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
            Voices
          </h3>
          <span className="text-xs text-[#6e6e73] font-medium">
            {voicesLoading ? 'Loading…' : `${voicePresets.length} voices`}
          </span>
        </div>
        {voicesLoading ? (
          <div className="flex items-center justify-center py-10 text-[#6e6e73]">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : voicePresets.length === 0 ? (
          <p className="text-sm text-[#6e6e73] py-6 text-center">
            No premade voices available yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {voicePresets.map((v) => (
              <VoiceCard
                key={v.id}
                voice={v}
                active={selectedVoice === v.id}
                onSelect={() => handleSelectVoice(v.id)}
                onPreview={(e) => handlePreviewVoice(e, v.id)}
                isPreviewing={previewVoiceId === v.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Voice cloning — Plus / Pro only */}
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-baseline gap-2 mb-4">
          <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
            Voice cloning
          </h3>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6e6e73]">
            Plus &amp; Pro
          </span>
        </div>

        {cloningAllowed ? (
          <>
            <div className="flex flex-wrap items-stretch gap-3">
              {voiceReady && (
                <div className="w-[150px] sm:w-[168px]">
                  <VoiceCard
                    voice={clonedVoice}
                    active={selectedVoice === 'cloned'}
                    onSelect={() => handleSelectVoice('cloned')}
                    onPreview={(e) => handlePreviewVoice(e, 'cloned')}
                    isPreviewing={previewVoiceId === 'cloned'}
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
                Clone your voice once to generate speech with your own sound.
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

      {/* Script */}
      <section className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
              Script
            </h3>
            {selectedVoice && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold truncate max-w-[140px]">
                {activeVoiceName}
              </span>
            )}
            {!freeform && isUnlocked && availableScriptLangs.length > 0 && (
              <div className="relative" ref={scriptLangMenuRef}>
                <button
                  type="button"
                  onClick={() => setScriptLangMenuOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={scriptLangMenuOpen}
                  className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] hover:bg-gray-200 text-[#1d1d1f] border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold transition-colors"
                >
                  <Globe2 className="w-3 h-3 text-[#6e6e73]" />
                  {scriptLanguageLabel(selectedLang)}
                  <ChevronDown
                    className={`w-3 h-3 text-[#6e6e73] transition-transform ${
                      scriptLangMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {scriptLangMenuOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full mt-1.5 z-30 min-w-[160px] max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg py-1"
                  >
                    {availableScriptLangs.map((lang) => {
                      const active = lang === selectedLang;
                      return (
                        <li key={lang}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => selectScriptLanguage(lang)}
                            className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                              active
                                ? 'bg-[#1d1d1f] text-white'
                                : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                            }`}
                          >
                            {scriptLanguageLabel(lang)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          {!freeform && unlockedScript && (
            <button
              type="button"
              onClick={() => setText(unlockedScript.slice(0, MAX_CHARS))}
              className="text-[11px] font-medium text-[#1d1d1f] underline underline-offset-2 flex-shrink-0"
            >
              Use unlocked script
            </button>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder={
            freeform
              ? 'Write or paste anything you want spoken…'
              : 'Paste or type the lines you want spoken…'
          }
          className="w-full min-h-[240px] resize-none rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3 text-sm text-[#1d1d1f] leading-relaxed placeholder:text-[#a1a1a6] focus:outline-none focus:ring-2 focus:ring-[#1d1d1f]/15 focus:border-[#1d1d1f]"
        />

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-[11px] text-[#6e6e73] sm:mr-auto">
            {text.length.toLocaleString()}/{MAX_CHARS.toLocaleString()} characters
          </p>

          <button
            type="button"
            disabled={!canGenerate || tagsLoading || isGenerating}
            onClick={() => void openConfirm()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium px-5 py-2.5 disabled:opacity-50 transition-all"
          >
            {tagsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing…
              </>
            ) : savedAudioUrls.length > 0 ? (
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

        {savedAudioUrls.length > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-baseline gap-2 mb-3">
              <h4 className="text-sm font-semibold text-[#1d1d1f] tracking-tight">
                Generated speech
              </h4>
              <span className="text-xs text-[#6e6e73] font-medium">
                {savedAudioUrls.length} clip{savedAudioUrls.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="space-y-2">
              {[...savedAudioUrls].reverse().map((url, reversedIndex) => {
                const index = savedAudioUrls.length - 1 - reversedIndex;
                const playing = playingSavedUrl === url;
                return (
                  <li
                    key={`${url}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#fafafa] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSavedPlayback(url)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:border-gray-300 flex-shrink-0"
                      aria-label={playing ? `Pause speech ${index + 1}` : `Play speech ${index + 1}`}
                    >
                      {playing ? (
                        <Pause className="w-3.5 h-3.5 text-[#1d1d1f]" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-[#1d1d1f] ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#1d1d1f]">
                        Speech {index + 1}
                      </p>
                      <p className="text-[10px] text-[#6e6e73] truncate">
                        {url.split('/').pop() || url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void downloadAudioUrl(url, index)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1d1d1f] hover:bg-gray-50 flex-shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Confirm generate */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            disabled={tagsLoading || isGenerating}
            onClick={closeConfirm}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audio-confirm-title"
            className="relative w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3
                  id="audio-confirm-title"
                  className="text-base font-semibold text-[#1d1d1f] tracking-tight"
                >
                  Ready to generate?
                </h3>
                <p className="text-xs text-[#6e6e73] mt-1 font-light">
                  Check that your voice and script are selected correctly.
                </p>
              </div>
              <button
                type="button"
                disabled={tagsLoading || isGenerating}
                onClick={closeConfirm}
                className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              >
                <X className="w-4 h-4 text-[#1d1d1f]" />
              </button>
            </div>

            <ul className="space-y-2.5 mb-5">
              <li className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-[#fafafa] px-3.5 py-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    voiceSelected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {voiceSelected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1d1d1f]">Voice</p>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5">
                    {voiceSelected ? activeVoiceName : 'No voice selected'}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-[#fafafa] px-3.5 py-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    scriptReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {scriptReady ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1d1d1f]">Script</p>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5">
                    {scriptReady
                      ? `${text.trim().length.toLocaleString()} characters ready`
                      : 'Script is empty — add text to generate'}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-[#fafafa] px-3.5 py-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tagsReady
                      ? 'bg-emerald-100 text-emerald-700'
                      : tagsError
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-[#6e6e73]'
                  }`}
                >
                  {tagsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : tagsReady ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1d1d1f]">Script tags</p>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5">
                    {tagsLoading
                      ? 'Preparing script tags…'
                      : tagsReady
                        ? 'Script tags ready'
                        : tagsError || 'Waiting to prepare script tags'}
                  </p>
                </div>
              </li>
            </ul>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                disabled={tagsLoading || isGenerating}
                onClick={closeConfirm}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !canGenerate ||
                  !tagsReady ||
                  !taggedScript ||
                  tagsLoading ||
                  isGenerating
                }
                onClick={() => void runGenerate()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium px-4 py-2.5 disabled:opacity-40"
              >
                {tagsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing…
                  </>
                ) : isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Yes, generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supported languages */}
      {languagesOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setLanguagesOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="speech-languages-title"
            className="relative w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[min(80vh,560px)]"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h3
                  id="speech-languages-title"
                  className="text-base font-semibold text-[#1d1d1f] tracking-tight"
                >
                  Supported languages
                </h3>
                <p className="text-xs text-[#6e6e73] mt-1 font-light">
                  Speech generation works with these languages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLanguagesOpen(false)}
                className="w-8 h-8 rounded-full bg-[#f5f5f7] hover:bg-gray-200 flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4 text-[#1d1d1f]" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b] pointer-events-none" />
                <input
                  ref={langSearchRef}
                  type="search"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Search language or code…"
                  className="w-full rounded-xl border border-gray-200 bg-[#fafafa] pl-9 pr-3 py-2.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-gray-300 focus:bg-white"
                />
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto px-2 py-2">
              {filteredSpeechLanguages.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-[#6e6e73]">
                  No languages match “{langSearch.trim()}”.
                </li>
              ) : (
                filteredSpeechLanguages.map((lang) => (
                  <li
                    key={lang.code}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[#f5f5f7]"
                  >
                    <span className="text-sm text-[#1d1d1f] font-medium min-w-0 truncate">
                      {lang.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#6e6e73] bg-[#f5f5f7] border border-gray-100 rounded-md px-2 py-0.5 flex-shrink-0">
                      {lang.code}
                    </span>
                  </li>
                ))
              )}
            </ul>

            <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-[#86868b]">
              {filteredSpeechLanguages.length} of {SPEECH_SUPPORTED_LANGUAGES.length} languages
            </div>
          </div>
        </div>
      )}

      <VoiceCloneModal
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        onCloned={handleCloned}
        userId={userId}
      />
    </div>
  );
}

/** @deprecated import from `@/lib/voice-clone` */
export { VOICE_CLONE_PROMPT } from '@/lib/voice-clone';
