/**
 * Desktop notifications for work that finishes while the user is elsewhere
 * (e.g. a queued video render). Every call is safe on the server and in browsers
 * that don't support or have blocked notifications — callers fall back to a toast.
 */

/** 'default' | 'granted' | 'denied' — spelled out so the lint config's missing browser globals don't matter. */
export type NotifyPermission = 'default' | 'granted' | 'denied';

function notificationApi(): typeof window.Notification | null {
  if (typeof window === 'undefined') return null;
  return 'Notification' in window ? window.Notification : null;
}

export function notificationsSupported(): boolean {
  return notificationApi() != null;
}

/**
 * Ask for permission, ideally from a user gesture (clicking "Render").
 * Resolves to the resulting permission, or 'denied' when unsupported.
 * Never prompts again once the user has answered.
 */
export async function requestNotificationPermission(): Promise<NotifyPermission> {
  const api = notificationApi();
  if (!api) return 'denied';
  if (api.permission !== 'default') return api.permission;
  try {
    return await api.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Show a desktop notification. Returns false when it could not be shown
 * (unsupported, not granted, or the browser refused) so the caller can fall back.
 */
export function notifyUser(title: string, body: string, options?: { tag?: string }): boolean {
  const api = notificationApi();
  if (!api || api.permission !== 'granted') return false;
  try {
    new api(title, { body, ...(options?.tag ? { tag: options.tag } : {}) });
    return true;
  } catch {
    return false;
  }
}
