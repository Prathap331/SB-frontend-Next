/** Frontend-only voice-clone profile flag (no backend yet). */

import { getVoiceCloneLanguage } from '@/lib/voice-clone-languages';

const KEY_PREFIX = 'storio_voice_clone_v1:';

export type ClonedVoiceProfile = {
  ready: boolean;
  updatedAt: string;
};

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function readClonedVoiceProfile(userId: string | null | undefined): ClonedVoiceProfile | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClonedVoiceProfile;
    if (!parsed?.ready) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasClonedVoice(userId: string | null | undefined): boolean {
  return !!readClonedVoiceProfile(userId)?.ready;
}

export function saveClonedVoiceProfile(userId: string): ClonedVoiceProfile {
  const profile: ClonedVoiceProfile = {
    ready: true,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(profile));
    } catch { /* ignore quota */ }
  }
  return profile;
}

export function clearClonedVoiceProfile(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch { /* ignore */ }
}

export const VOICE_CLONE_PROMPT =
  getVoiceCloneLanguage('en')?.prompt ??
  "Nothing compares to the joy of hearing my child laugh. It bubbles up from deep inside them, pure and honest. In those moments, all my worries fade away, replaced by a happiness that fills every part of me. It's the sound of perfect love.";

/** Recording constraints for the clone modal */
export const VOICE_CLONE_MIN_SECONDS = 10;
export const VOICE_CLONE_MAX_SECONDS = 30;
/** Max languages the user can record in one clone session */
export const VOICE_CLONE_MAX_LANGUAGES = 2;

export type ClonedVoiceTrack = {
  code: string;
  url: string;
};

export function clonedVoiceId(code: string): string {
  return `cloned:${code}`;
}

export function isClonedVoiceId(id: string | null | undefined): boolean {
  return !!id && (id === 'cloned' || id.startsWith('cloned:'));
}

export function firstNameFromFullName(fullName: string | null | undefined): string {
  const n = (fullName || '').trim();
  if (!n) return 'Your voice';
  return n.split(/\s+/)[0];
}

function pushTrack(tracks: ClonedVoiceTrack[], code: string, url: unknown) {
  if (typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed) return;
  const key = (code || 'en').trim().toLowerCase() || 'en';
  if (tracks.some((t) => t.code === key)) return;
  tracks.push({ code: key, url: trimmed });
}

/** Parse user_profiles.audio_url — array of { en: url }, a map, JSON text, or a legacy single URL. */
export function parseClonedVoiceTracks(raw: unknown): ClonedVoiceTrack[] {
  if (raw == null || raw === '') return [];

  let value: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        return /^https?:\/\//i.test(trimmed) ? [{ code: 'en', url: trimmed }] : [];
      }
    } else if (/^https?:\/\//i.test(trimmed)) {
      return [{ code: 'en', url: trimmed }];
    } else {
      return [];
    }
  }

  const tracks: ClonedVoiceTrack[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') {
        pushTrack(tracks, 'en', item);
        continue;
      }
      if (item && typeof item === 'object') {
        for (const [code, url] of Object.entries(item as Record<string, unknown>)) {
          pushTrack(tracks, code, url);
        }
      }
    }
    return tracks;
  }

  if (value && typeof value === 'object') {
    for (const [code, url] of Object.entries(value as Record<string, unknown>)) {
      pushTrack(tracks, code, url);
    }
  }
  return tracks;
}

/** Voice cloning is available on Plus and Pro only. */
export function canUseVoiceCloning(tier: string | null | undefined): boolean {
  const t = (tier || '').trim().toLowerCase();
  return t === 'plus' || t === 'pro';
}
