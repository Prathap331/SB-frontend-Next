// Shared config for user thumbnail photos (facial expressions)
// Used by onboarding (auth/callback) and the profile page.

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const THUMBNAIL_BUCKET = 'thumbnail-images';

export const EXPRESSIONS = [
  { key: 'happy',     label: 'Happy',     emoji: '😄' },
  { key: 'sad',       label: 'Sad',       emoji: '😢' },
  { key: 'angry',     label: 'Angry',     emoji: '😠' },
  { key: 'surprised', label: 'Surprised', emoji: '😲' },
  { key: 'thinking',  label: 'Thinking',  emoji: '🤔' },
  { key: 'neutral',   label: 'Neutral',   emoji: '😐' },
] as const;

export type ExpressionKey = (typeof EXPRESSIONS)[number]['key'];
