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
  return v.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

/** `icon_name` / `iconName` / `icons` as a string, comma list, or string[]. */
export function readIconNames(props: Record<string, unknown>): string[] {
  const fromUnknown = (value: unknown): string[] => {
    if (value == null) return [];
    if (typeof value === 'string') {
      const t = value.trim();
      if (!t) return [];
      if (t.includes(',')) return t.split(',').map((part) => part.trim()).filter(Boolean);
      return [t];
    }
    if (Array.isArray(value)) return value.flatMap(fromUnknown);
    if (value && typeof value === 'object') {
      const rec = value as Record<string, unknown>;
      return fromUnknown(rec.name ?? rec.icon ?? rec.icon_name ?? rec.iconName ?? rec.value);
    }
    return [];
  };
  for (const key of ['icons', 'iconName', 'icon_name', 'icon_names', 'icon']) {
    const list = fromUnknown(props[key]);
    if (list.length) return list;
  }
  return [];
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

export function readAccentColor(
  props: Record<string, unknown>,
  fallback = '#f5f5f7',
): string {
  return (
    readNonEmptyString(props, 'color') ??
    readNonEmptyString(props, 'accent') ??
    readNonEmptyString(props, 'colorHint') ??
    fallback
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
