'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Mic,
  Search,
  Square,
  X,
} from 'lucide-react';
import {
  VOICE_CLONE_MAX_LANGUAGES,
  VOICE_CLONE_MAX_SECONDS,
  VOICE_CLONE_MIN_SECONDS,
  VOICE_CLONE_PROMPT,
} from '@/lib/voice-clone';
import {
  VOICE_CLONE_LANGUAGES,
  getVoiceCloneLanguage,
  isVoiceCloneRtl,
} from '@/lib/voice-clone-languages';
import { convertBlobToWav } from '@/lib/audio-wav';
import {
  createNoiseSuppressedStream,
  NOISE_SUPPRESSED_AUDIO_CONSTRAINTS,
  type NoiseSuppressedStream,
} from '@/lib/noise-suppression';
import { ApiService } from '@/services/api';
import { toast } from 'sonner';

type SavedSample = {
  code: string;
  blob: Blob;
  seconds: number;
};

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function languageName(code: string): string {
  return getVoiceCloneLanguage(code)?.name ?? code;
}

export function VoiceCloneModal({
  open,
  onClose,
  onCloned,
  userId,
  title = 'Clone your voice',
}: {
  open: boolean;
  onClose: () => void;
  onCloned: () => void;
  userId?: string | null;
  title?: string;
}) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [savedSamples, setSavedSamples] = useState<SavedSample[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Active RNNoise graph — tearing this down also stops the mic tracks. */
  const suppressionRef = useRef<NoiseSuppressedStream | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});
  const langPickerRef = useRef<HTMLDivElement | null>(null);
  const langSearchRef = useRef<HTMLInputElement | null>(null);

  const selectedLang = selectedCode ? getVoiceCloneLanguage(selectedCode) : undefined;
  const promptText = selectedLang?.prompt ?? VOICE_CLONE_PROMPT;
  const canStop = recordSeconds >= VOICE_CLONE_MIN_SECONDS;
  const currentTakeReady =
    !!recordedBlob && !isRecording && recordSeconds >= VOICE_CLONE_MIN_SECONDS;
  const pickingLanguage =
    !isRecording && !currentTakeReady && (!selectedLang || langMenuOpen);

  const savedCodes = useMemo(
    () => new Set(savedSamples.map((sample) => sample.code)),
    [savedSamples],
  );
  const recordedCount = savedSamples.length + (currentTakeReady ? 1 : 0);
  const canRecordAnotherLanguage =
    currentTakeReady && savedSamples.length < VOICE_CLONE_MAX_LANGUAGES - 1;

  const availableLanguages = useMemo(
    () => VOICE_CLONE_LANGUAGES.filter((lang) => !savedCodes.has(lang.code)),
    [savedCodes],
  );

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return availableLanguages;
    return availableLanguages.filter(
      (lang) =>
        lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q),
    );
  }, [availableLanguages, langSearch]);

  const clearCurrentTake = useCallback(() => {
    setRecordedBlob(null);
    setRecordSeconds(0);
    setMicError(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const cleanupStream = useCallback(() => {
    // Closing the suppression graph stops the mic tracks as well.
    const suppression = suppressionRef.current;
    suppressionRef.current = null;
    if (suppression) void suppression.stop();
    else streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    setSelectedCode(null);
    setLangMenuOpen(false);
    setLangSearch('');
    setSavedSamples([]);
    setIsRecording(false);
    setCloneBusy(false);
    mediaRecorderRef.current = null;
    cleanupStream();
    clearCurrentTake();
  }, [cleanupStream, clearCurrentTake]);

  useEffect(() => {
    if (!open) resetSession();
  }, [open, resetSession]);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [cleanupStream, recordedUrl]);

  useEffect(() => {
    if (!pickingLanguage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedLang) setLangMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => langSearchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickingLanguage, selectedLang]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(async () => {
    setMicError(null);
    setRecordedBlob(null);
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: NOISE_SUPPRESSED_AUDIO_CONSTRAINTS,
      });
      // Record the denoised output, not the raw microphone. Falls back to the mic
      // stream unchanged when the worklet is unavailable.
      const suppression = await createNoiseSuppressedStream(mic);

      console.log(
        '[Storio Voice Clone] RNNoise enabled:',
        suppression.enabled
      );
      
      console.log(
        '[Storio Voice Clone] Recording stream:',
        suppression.stream
      );

      suppressionRef.current = suppression;
      const stream = suppression.stream;
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const active = suppressionRef.current;
        suppressionRef.current = null;
        if (active) void active.stop();
        else stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setRecordedBlob(blob);
        setRecordedUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (next >= VOICE_CLONE_MAX_SECONDS) {
            setTimeout(() => stopRecordingRef.current(), 0);
            return VOICE_CLONE_MAX_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      setMicError('Microphone access is required to clone your voice.');
    }
  }, []);

  const selectLanguage = useCallback(
    (code: string) => {
      if (isRecording || cloneBusy) return;
      setSelectedCode(code);
      setLangMenuOpen(false);
      setLangSearch('');
      clearCurrentTake();
    },
    [isRecording, cloneBusy, clearCurrentTake],
  );

  const collectSamples = useCallback((): SavedSample[] | null => {
    const samples = [...savedSamples];
    if (recordedBlob && selectedCode) {
      if (recordSeconds < VOICE_CLONE_MIN_SECONDS) {
        toast.error(`Please record at least ${VOICE_CLONE_MIN_SECONDS} seconds`);
        return null;
      }
      samples.push({
        code: selectedCode,
        blob: recordedBlob,
        seconds: recordSeconds,
      });
    }
    if (!samples.length) {
      toast.error('Please record at least one language');
      return null;
    }
    return samples;
  }, [savedSamples, recordedBlob, selectedCode, recordSeconds]);

  const handleClone = useCallback(async () => {
    const samples = collectSamples();
    if (!samples) return;
    if (!userId) {
      toast.error('Please sign in to save your voice clone');
      return;
    }

    setCloneBusy(true);
    try {
      const converted = await Promise.all(
        samples.map(async (sample) => ({
          language: sample.code,
          audio: await convertBlobToWav(sample.blob, `voice-clone-${sample.code}.wav`),
        })),
      );
      await ApiService.saveAudio({
        userId,
        samples: converted,
      });
      onCloned();
      onClose();
      toast.success(
        converted.length > 1
          ? `Voice clone saved (${converted.length} languages)`
          : 'Voice clone saved',
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save voice clone';
      toast.error(message);
    } finally {
      setCloneBusy(false);
    }
  }, [collectSamples, userId, onCloned, onClose]);

  const handleSaveAndRecordAnother = useCallback(() => {
    if (!recordedBlob || !selectedCode) return;
    if (recordSeconds < VOICE_CLONE_MIN_SECONDS) {
      toast.error(`Please record at least ${VOICE_CLONE_MIN_SECONDS} seconds`);
      return;
    }
    if (savedSamples.length >= VOICE_CLONE_MAX_LANGUAGES - 1) {
      toast.error(`You can record up to ${VOICE_CLONE_MAX_LANGUAGES} languages.`);
      return;
    }

    setSavedSamples((prev) => [
      ...prev,
      { code: selectedCode, blob: recordedBlob, seconds: recordSeconds },
    ]);
    setSelectedCode(null);
    setLangMenuOpen(true);
    setLangSearch('');
    clearCurrentTake();
  }, [recordedBlob, selectedCode, recordSeconds, savedSamples.length, clearCurrentTake]);

  const canSave =
    !isRecording &&
    !cloneBusy &&
    (currentTakeReady || savedSamples.length > 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      onClick={() => {
        if (!isRecording && !cloneBusy) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-clone-title"
        className="w-full max-w-2xl h-[min(90vh,720px)] bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-[#1d1d1f]" />
            <h2
              id="voice-clone-title"
              className="text-base font-semibold text-[#1d1d1f]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRecording || cloneBusy}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-[#6e6e73] hover:text-[#1d1d1f] hover:border-gray-300 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 sm:px-6 pt-4 pb-3 space-y-2 flex-shrink-0">
          <p className="text-xs font-semibold text-[#1d1d1f]">
            Choose the language to record
          </p>
          <p className="text-[11px] text-[#6e6e73]">
            Record 1 or 2 languages. {recordedCount}/{VOICE_CLONE_MAX_LANGUAGES} saved in this session.
          </p>
          <button
            type="button"
            disabled={isRecording || cloneBusy || currentTakeReady}
            onClick={() => setLangMenuOpen((openMenu) => !openMenu)}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-left flex items-center justify-between gap-2 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-haspopup="listbox"
            aria-expanded={pickingLanguage}
          >
            <span className={selectedLang && !pickingLanguage ? 'text-[#1d1d1f]' : 'text-[#86868b]'}>
              {selectedLang && !pickingLanguage
                ? `${selectedLang.name} (${selectedLang.code})`
                : 'Select a language'}
            </span>
            <ChevronDown className="w-4 h-4 text-[#6e6e73] flex-shrink-0" />
          </button>
          {savedSamples.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedSamples.map((sample) => (
                <span
                  key={sample.code}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-[#fafafa] px-2.5 py-1 text-[11px] text-[#1d1d1f]"
                >
                  Saved · {languageName(sample.code)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 px-5 sm:px-6 pb-3">
          {pickingLanguage ? (
            <div
              ref={langPickerRef}
              className="h-full rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col"
            >
              <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
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
              <ul role="listbox" className="flex-1 min-h-0 overflow-y-auto py-1">
                {filteredLanguages.length === 0 ? (
                  <li className="px-3 py-10 text-center text-sm text-[#6e6e73]">
                    No languages match “{langSearch.trim()}”.
                  </li>
                ) : (
                  filteredLanguages.map((lang) => {
                    const isActive = lang.code === selectedCode;
                    return (
                      <li key={lang.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => selectLanguage(lang.code)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#f5f5f7]"
                        >
                          <span className="text-sm text-[#1d1d1f] font-medium min-w-0 truncate">
                            {lang.name}
                          </span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono text-[#6e6e73] bg-[#f5f5f7] border border-gray-100 rounded-md px-2 py-0.5">
                              {lang.code}
                            </span>
                            {isActive && <Check className="w-4 h-4 text-[#1d1d1f]" />}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-[#86868b] flex-shrink-0">
                {filteredLanguages.length} of {availableLanguages.length} languages
              </div>
            </div>
          ) : selectedLang ? (
            <div className="h-full overflow-y-auto space-y-4 pr-0.5">
              <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-3.5 h-3.5 text-[#1d1d1f]" />
                  <p className="text-xs font-semibold text-[#1d1d1f]">
                    Read this aloud · {selectedLang.name}
                  </p>
                </div>
                <p
                  className="text-sm text-[#1d1d1f] leading-relaxed font-light"
                  dir={isVoiceCloneRtl(selectedLang.code) ? 'rtl' : 'ltr'}
                  lang={selectedLang.code}
                >
                  {promptText}
                </p>
              </div>

              <p className="text-[11px] text-[#6e6e73]">
                Record between {VOICE_CLONE_MIN_SECONDS}–{VOICE_CLONE_MAX_SECONDS} seconds.
                Stop unlocks after {VOICE_CLONE_MIN_SECONDS}s; recording ends at {VOICE_CLONE_MAX_SECONDS}s.
              </p>

              {isRecording ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={!canStop}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-red-600 disabled:cursor-not-allowed"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    {canStop ? 'Stop' : 'Recording'} · {formatTimer(recordSeconds)} / {formatTimer(VOICE_CLONE_MAX_SECONDS)}
                  </button>
                  {!canStop && (
                    <p className="text-[11px] text-[#6e6e73] text-center">
                      Keep reading — stop unlocks in {VOICE_CLONE_MIN_SECONDS - recordSeconds}s
                    </p>
                  )}
                  {canStop && recordSeconds < VOICE_CLONE_MAX_SECONDS && (
                    <p className="text-[11px] text-[#6e6e73] text-center">
                      You can stop now, or keep going until {VOICE_CLONE_MAX_SECONDS}s
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="w-full py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  {recordedUrl ? 'Re-record' : 'Start Recording'}
                </button>
              )}

              {micError && (
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  {micError}
                </p>
              )}

              {recordedUrl && !isRecording && (
                <audio controls src={recordedUrl} className="w-full h-9" />
              )}

              {currentTakeReady && canRecordAnotherLanguage && (
                <button
                  type="button"
                  disabled={cloneBusy}
                  onClick={handleSaveAndRecordAnother}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-[#1d1d1f] hover:border-gray-300 disabled:opacity-40"
                >
                  Save and record another language
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 px-5 sm:px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isRecording || cloneBusy}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-[#1d1d1f] hover:border-gray-300 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void handleClone()}
            className="flex-1 py-2.5 rounded-xl bg-[#1d1d1f] hover:bg-black text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {cloneBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save voice clone'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
