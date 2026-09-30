const HEADLINE_KEYS = [
  'title',
  'quote',
  'word',
  'question',
  'label',
  'kicker',
  'name',
  'headline',
  'doc_title',
  'statement',
] as const;

export function storybitHeadline(props: Record<string, unknown>): string | undefined {
  for (const key of HEADLINE_KEYS) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** Keep overlay aliases in sync so preview + beat PATCH still see icon / colour. */
export function syncStorybitEditorProps(props: Record<string, unknown>): Record<string, unknown> {
  const next = { ...props };
  if (typeof next.icon === 'string' && next.icon.trim()) {
    next.icon_name = next.icon;
    next.iconName = next.icon;
  }
  const style = next.style;
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    const textColor = (style as Record<string, unknown>).text_color;
    if (typeof textColor === 'string' && textColor.trim()) {
      next.colorHint = textColor;
      next.color = textColor;
    }
  }
  return next;
}

const EDITOR_ONLY_PROP_KEYS = new Set([
  'geometryPx',
  'motion',
  'displayText',
  'display_text',
  'colorHint',
  'color',
  'fontSize',
  'font_size',
  'placement',
  'contentBinding',
  'content_binding',
  'highlightTargetText',
  'highlight_target_text',
  'backgroundColorHint',
  'background_color_hint',
  'iconName',
  'iconLayout',
  'icon_layout',
  'textAnimationStyle',
  'text_animation_style',
  'icons',
]);

export function templatePropsFromRemotionProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (EDITOR_ONLY_PROP_KEYS.has(key) || value === undefined) continue;
    out[key] = value;
  }
  return out;
}
