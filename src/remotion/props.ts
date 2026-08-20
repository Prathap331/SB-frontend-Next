/** Safe readers for backend `props` — never assume a shape. */

export function readString(props: Record<string, unknown>, key: string): string | undefined {
  const v = props[key];
  return typeof v === 'string' ? v : undefined;
}

export function readNonEmptyString(
  props: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = readString(props, key);
  if (!v || !v.trim()) return undefined;
  return v;
}

/** String array from `items`, or any array of strings under a known key. */
export function readStringArray(
  props: Record<string, unknown>,
  key: string,
): string[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === 'string');
}

export function readObjectArray(
  props: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] {
  const v = props[key];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

/** Whether props contain anything a generic layout can show. */
export function propsHaveRenderableContent(props: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && value.trim()) return true;
    if (typeof value === 'number' && Number.isFinite(value)) return true;
    if (Array.isArray(value) && value.length > 0) return true;
    if (value && typeof value === 'object') return true;
    void key;
  }
  return false;
}
