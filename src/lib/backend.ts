/**
 * Backend API base URL from env (no trailing slash).
 * Set NEXT_PUBLIC_API_URL in .env — e.g. https://storybit-backend.onrender.com
 */
export function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is not set. Add it to your .env file.');
  }
  return url.replace(/\/$/, '');
}

/** Same as getBackendUrl but returns empty string instead of throwing (for optional checks). */
export function backendUrlOrEmpty(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');
}
