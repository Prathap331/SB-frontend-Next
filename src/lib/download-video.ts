/**
 * Download a rendered video to disk.
 *
 * Fetches the file and saves it through a blob so the browser writes it out instead of
 * navigating to the URL (a cross-origin `download` attribute is ignored). Falls back to
 * opening the link when the fetch is blocked by CORS.
 */

/** Turns a title into a safe mp4 filename, e.g. "My video!" → "my-video.mp4". */
export function videoFileName(title?: string | null): string {
  const safe = (title || 'storio-video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe || 'storio-video'}.mp4`;
}

export async function downloadVideoFile(url: string, title?: string | null): Promise<void> {
  if (!url) return;
  const filename = videoFileName(title);

  const save = (href: string, opts?: { newTab?: boolean }) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    if (opts?.newTab) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.rel = 'noopener';
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  try {
    if (url.startsWith('blob:')) {
      save(url);
      return;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch video file');
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    save(href);
    URL.revokeObjectURL(href);
  } catch {
    save(url, { newTab: true });
  }
}
