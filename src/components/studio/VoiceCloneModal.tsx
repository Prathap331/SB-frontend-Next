'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Info, Loader2, Mic, Square, X } from 'lucide-react';
import {
  VOICE_CLONE_MAX_SECONDS,
  VOICE_CLONE_MIN_SECONDS,
  VOICE_CLONE_PROMPT,
} from '@/lib/voice-clone';
import { convertBlobToWav } from '@/lib/audio-wav';
import { ApiService } from '@/services/api';
import { toast } from 'sonner';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  const stopRecordingRef = useRef<() => void>(() => {});

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setIsRecording(false);
      setRecordSeconds(0);
      setMicError(null);
      setCloneBusy(false);
      setRecordedBlob(null);
      mediaRecorderRef.current = null;
      cleanupStream();
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open, cleanupStream]);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [cleanupStream, recordedUrl]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        stream.getTracks().forEach((t) => t.stop());
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

  const handleClone = useCallback(async () => {
    if (!recordedBlob) return;
    if (recordSeconds < VOICE_CLONE_MIN_SECONDS) {
      toast.error(`Please record at least ${VOICE_CLONE_MIN_SECONDS} seconds`);
      return;
    }
    if (!userId) {
      toast.error('Please sign in to save your voice clone');
      return;
    }

    setCloneBusy(true);
    try {
      // Browsers record webm/opus; backend only accepts WAV (and similar).
      const wavFile = await convertBlobToWav(recordedBlob);
      await ApiService.saveAudio({
        userId,
        audio: wavFile,
      });
      onCloned();
      onClose();
      toast.success('Voice clone saved');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save voice clone';
      toast.error(message);
    } finally {
      setCloneBusy(false);
    }
  }, [recordedBlob, recordSeconds, userId, onCloned, onClose]);

  const canStop = recordSeconds >= VOICE_CLONE_MIN_SECONDS;

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
        className="w-full max-w-lg bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100">
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

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-3.5 h-3.5 text-[#1d1d1f]" />
              <p className="text-xs font-semibold text-[#1d1d1f]">Read this aloud</p>
            </div>
            <p className="text-sm text-[#1d1d1f] leading-relaxed font-light">
              {VOICE_CLONE_PROMPT}
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
              onClick={startRecording}
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

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
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
              disabled={
                !recordedBlob ||
                isRecording ||
                cloneBusy ||
                recordSeconds < VOICE_CLONE_MIN_SECONDS
              }
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
    </div>
  );
}
