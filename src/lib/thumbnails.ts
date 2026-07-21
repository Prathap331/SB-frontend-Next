// Shared config for user thumbnail photos (2 HD photos of the user)
// Used by onboarding (auth/callback), the profile page and the search page popup.

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const THUMBNAIL_BUCKET = 'thumbnail-images';

export const PHOTO_SLOTS = [
  { key: 'photo1', label: 'Photo 1' },
  { key: 'photo2', label: 'Photo 2' },
] as const;

export type PhotoKey = (typeof PHOTO_SLOTS)[number]['key'];

/** Shape persisted to user_profiles.thumbnail_images: { photo1: "", photo2: "" } */
export type ThumbnailImages = Record<PhotoKey, string>;
