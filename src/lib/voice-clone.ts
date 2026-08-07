/** Frontend-only voice-clone profile flag (no backend yet). */

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
  "Nothing compares to the joy of hearing my child laugh. It bubbles up from deep inside them, pure and honest. In those moments, all my worries fade away, replaced by a happiness that fills every part of me. It's the sound of perfect love.";

/** Recording constraints for the clone modal */
export const VOICE_CLONE_MIN_SECONDS = 10;
export const VOICE_CLONE_MAX_SECONDS = 30;

/** Voice cloning is available on Plus and Pro only. */
export function canUseVoiceCloning(tier: string | null | undefined): boolean {
  const t = (tier || '').trim().toLowerCase();
  return t === 'plus' || t === 'pro';
}
