import catalogJson from './storybitEditorCatalog.json';
import { resolveAnimationType } from '@/remotion/animationTypes';

export type StorybitEditorField = {
  path: string;
  type: string;
  required?: boolean;
  fills?: string;
  limits?: string;
  values?: string[];
  default?: string | number;
  fallback?: string;
  hint?: string;
};

export type StorybitEditorSpec = {
  name: string;
  placement?: string;
  inputs: StorybitEditorField[];
};

export type StorybitFieldGroup =
  | { kind: 'scalar'; field: StorybitEditorField }
  | { kind: 'list'; key: string; listField: StorybitEditorField; itemFields: StorybitEditorField[] };

const CATALOG = catalogJson as Record<string, StorybitEditorSpec>;

/** Lucide kebab-case names that resolve through the Storybit icon map. */
export const LUCIDE_ICON_OPTIONS = [
  'activity',
  'alert-triangle',
  'anchor',
  'archive',
  'arrow-right',
  'atom',
  'award',
  'banknote',
  'bar-chart',
  'bar-chart-3',
  'battery',
  'bell',
  'bird',
  'book',
  'brain',
  'brain-circuit',
  'briefcase',
  'bug',
  'building',
  'building-2',
  'bus',
  'calendar',
  'camera',
  'car',
  'castle',
  'cat',
  'chart-column',
  'chart-line',
  'chart-pie',
  'check',
  'church',
  'circle',
  'clapperboard',
  'clock',
  'code',
  'coffee',
  'coins',
  'compass',
  'cpu',
  'credit-card',
  'cross',
  'crown',
  'database',
  'dna',
  'dog',
  'dollar-sign',
  'drama',
  'dumbbell',
  'factory',
  'file-text',
  'film',
  'fingerprint',
  'fish',
  'flag',
  'flame',
  'flask-conical',
  'folder',
  'gauge',
  'gavel',
  'globe',
  'graduation-cap',
  'handshake',
  'heart',
  'heart-handshake',
  'infinity',
  'key',
  'landmark',
  'laptop',
  'leaf',
  'library',
  'lightbulb',
  'line-chart',
  'lock',
  'luggage',
  'map',
  'map-pin',
  'map-pinned',
  'medal',
  'megaphone',
  'message-circle',
  'mic',
  'microscope',
  'moon',
  'moon-star',
  'mountain',
  'music',
  'network',
  'newspaper',
  'orbit',
  'paintbrush',
  'palette',
  'pen',
  'pencil',
  'pie-chart',
  'piggy-bank',
  'pill',
  'pizza',
  'plane',
  'podcast',
  'puzzle',
  'quote',
  'radio',
  'receipt',
  'ribbon',
  'rocket',
  'rss',
  'satellite',
  'scale',
  'scroll',
  'search',
  'server',
  'shield',
  'ship',
  'shirt',
  'smartphone',
  'snowflake',
  'sparkles',
  'sprout',
  'star',
  'stethoscope',
  'sun',
  'sword',
  'target',
  'telescope',
  'tent',
  'terminal',
  'theater',
  'thermometer',
  'timer',
  'train',
  'trending-down',
  'trending-up',
  'trophy',
  'tv',
  'umbrella',
  'user',
  'users',
  'users-round',
  'utensils',
  'vote',
  'wallet',
  'waves',
  'wifi',
  'wind',
  'x',
  'zap',
  'cloud-rain',
  'indian-rupee',
  'mail',
  'qr-code',
  'store',
  'tag',
  'truck',
  'paperclip',
  'box',
  'route',
  'cloud',
  'repeat',
  'thumbs-up',
  'thumbs-down',
  'home',
  'info',
  'chevrons-left-right',
] as const;

export function getStorybitEditorSpec(animationType: string | undefined | null): StorybitEditorSpec | null {
  if (!animationType) return null;
  return CATALOG[resolveAnimationType(animationType)] ?? null;
}

type PathToken = string | number;

/** `steps[].title` + index 2 → `['steps', 2, 'title']`. Trailing `[]` after the first array is a nested list key. */
export function pathTokens(path: string, index?: number): PathToken[] {
  const tokens: PathToken[] = [];
  let firstArrayConsumed = false;
  const re = /([^.\[\]]+)(?:\[(\d*)\])?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    tokens.push(match[1]);
    if (!match[0].includes('[')) continue;
    if (match[2]) {
      tokens.push(Number(match[2]));
      continue;
    }
    if (!firstArrayConsumed && index != null) {
      tokens.push(index);
      firstArrayConsumed = true;
    }
  }
  return tokens;
}

export function getByPath(root: unknown, path: string, index?: number): unknown {
  let current = root;
  for (const token of pathTokens(path, index)) {
    if (current == null) return undefined;
    if (typeof token === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
      continue;
    }
    if (typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function setTokens(current: unknown, tokens: PathToken[], value: unknown): unknown {
  if (!tokens.length) return value;
  const [head, ...rest] = tokens;
  if (typeof head === 'number') {
    const arr = Array.isArray(current) ? current.slice() : [];
    while (arr.length <= head) arr.push(rest.length ? {} : '');
    arr[head] = setTokens(arr[head], rest, value);
    return arr;
  }
  const obj =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  obj[head] = setTokens(obj[head], rest, value);
  return obj;
}

export function setByPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
  index?: number,
): Record<string, unknown> {
  return setTokens(root, pathTokens(path, index), value) as Record<string, unknown>;
}

export function listKeyFromPath(path: string): string | null {
  const match = path.match(/^([^[\].]+)\[\]/);
  return match?.[1] ?? null;
}

export function itemFieldKey(path: string): string {
  const after = path.includes('].') ? path.slice(path.indexOf('].') + 2) : path.replace(/^[^[\]]+\[\]$/, '');
  return after.replace(/\[\]$/, '');
}

export function groupStorybitFields(inputs: StorybitEditorField[]): {
  content: StorybitFieldGroup[];
  appearance: StorybitEditorField[];
} {
  const lists = new Map<string, { list?: StorybitEditorField; items: StorybitEditorField[] }>();
  const listOrder: string[] = [];
  const contentScalars: StorybitEditorField[] = [];
  const appearance: StorybitEditorField[] = [];

  for (const field of inputs) {
    const key = listKeyFromPath(field.path);
    if (key) {
      if (!lists.has(key)) {
        lists.set(key, { items: [] });
        listOrder.push(key);
      }
      const group = lists.get(key)!;
      if (field.path === `${key}[]`) group.list = field;
      else group.items.push(field);
      continue;
    }
    if (field.path.startsWith('style.')) appearance.push(field);
    else contentScalars.push(field);
  }

  const content: StorybitFieldGroup[] = [
    ...contentScalars.map((field) => ({ kind: 'scalar' as const, field })),
    ...listOrder.map((key) => {
      const group = lists.get(key)!;
      return {
        kind: 'list' as const,
        key,
        listField: group.list ?? { path: `${key}[]`, type: 'list', fills: key },
        itemFields: group.items,
      };
    }),
  ];
  return { content, appearance };
}

export function listBounds(limits?: string): { min: number; max: number } {
  const match = limits?.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  return { min: 0, max: 12 };
}

export function emptyListItem(itemFields: StorybitEditorField[]): unknown {
  if (!itemFields.length) return '';
  const obj: Record<string, unknown> = {};
  for (const field of itemFields) {
    const key = itemFieldKey(field.path);
    if (!key) continue;
    if (field.type === 'number') obj[key] = 0;
    else if (field.type === 'array') obj[key] = [];
    else if (field.type === 'icon') obj[key] = field.fallback && field.fallback !== 'number' ? field.fallback : 'circle';
    else obj[key] = '';
  }
  return obj;
}

export function fieldLabel(field: StorybitEditorField): string {
  if (field.fills?.trim()) return field.fills.trim();
  const last = field.path.split('.').pop() ?? field.path;
  return last.replace(/\[\]/g, '').replace(/_/g, ' ');
}

export function isPlaceholderDefault(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim().toLowerCase();
  if (!s) return true;
  if (s === 'derived' || s.includes('or the') || s.includes('default')) return true;
  return /\s/.test(s) && s.includes('theme');
}

export function isMultilineField(field: StorybitEditorField): boolean {
  const limits = field.limits ?? '';
  const lines = Number(limits.match(/max (\d+) lines/i)?.[1] ?? 0);
  if (lines > 1) return true;
  const maxChars = Number(limits.match(/(\d+)\s*[–-]\s*(\d+)\s*chars/i)?.[2] ?? 0);
  return maxChars > 48;
}

export { storybitHeadline, syncStorybitEditorProps, templatePropsFromRemotionProps } from './storybitPropSync';

export function formatArrayField(value: unknown): string {
  if (!Array.isArray(value)) return typeof value === 'string' ? value : '';
  return value
    .map((entry) => (entry == null ? '' : String(entry)))
    .join(', ');
}

export function parseArrayField(raw: string, numeric: boolean): unknown[] {
  return raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (!numeric) return part;
      const n = Number(part);
      return Number.isFinite(n) ? n : part;
    });
}

export function colorToInputValue(value: unknown, fallback = '#ffffff'): string {
  if (typeof value !== 'string') return fallback;
  const hex = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex.slice(0, 7);
  return fallback;
}
