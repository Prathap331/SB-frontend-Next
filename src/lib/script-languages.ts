/** API value (lowercase key in DB) + display label for Translate picker */
import { VOICE_CLONE_LANGUAGES } from '@/lib/voice-clone-languages';

export type ScriptLanguageOption = {
  /** Stored as key in script jsonb, e.g. "english", "chinese-simplified" */
  value: string;
  /** Display label (English name) */
  label: string;
  /** Sent to /translate-script — Title Case English; defaults to label */
  apiName?: string;
};

/** Stored jsonb keys that differ from the display-name slug. */
const SCRIPT_VALUE_OVERRIDES: Record<string, string> = {
  zh: 'chinese-simplified',
};

function scriptValueFromCloneLang(code: string, name: string): string {
  if (SCRIPT_VALUE_OVERRIDES[code]) return SCRIPT_VALUE_OVERRIDES[code];
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Same 20 languages as voice cloning — 10 global plus 10 Indian. */
export const SCRIPT_LANGUAGES: ScriptLanguageOption[] = VOICE_CLONE_LANGUAGES.map((lang) => ({
  value: scriptValueFromCloneLang(lang.code, lang.name),
  label: lang.name,
}));

export const DEFAULT_SCRIPT_LANGUAGE = 'english';

/** ISO-ish codes for /generate-speech langCode (keyed by script jsonb language) */
const SCRIPT_LANGUAGE_CODES: Record<string, string> = {
  ...Object.fromEntries(
    VOICE_CLONE_LANGUAGES.map((lang) => [
      scriptValueFromCloneLang(lang.code, lang.name),
      lang.code,
    ]),
  ),
  // Legacy stored keys still resolve after the picker was reduced to 84 languages.
  'chinese-traditional': 'zh',
  hausa: 'ha',
  bhojpuri: 'bho',
  odia: 'or',
  oromo: 'om',
  maithili: 'mai',
  uzbek: 'uz',
  sundanese: 'su',
  igbo: 'ig',
  lao: 'lo',
  zulu: 'zu',
  malagasy: 'mg',
  somali: 'so',
  cebuano: 'ceb',
  lingala: 'ln',
  xhosa: 'xh',
  'kurdish-kurmanji': 'ku',
  bambara: 'bm',
  chichewa: 'ny',
  kinyarwanda: 'rw',
  luganda: 'lg',
  uyghur: 'ug',
  twi: 'tw',
  tigrinya: 'ti',
  ilocano: 'ilo',
  tajik: 'tg',
  'kurdish-sorani': 'ckb',
  quechua: 'qu',
  turkmen: 'tk',
  ewe: 'ee',
  guarani: 'gn',
  sesotho: 'st',
  tatar: 'tt',
};

/** Language code for /generate-speech, e.g. "telugu" → "te" */
export function scriptLanguageCode(value: string): string {
  const v = (value || DEFAULT_SCRIPT_LANGUAGE).trim().toLowerCase();
  if (!v) return 'en';
  if (SCRIPT_LANGUAGE_CODES[v]) return SCRIPT_LANGUAGE_CODES[v];
  // Already a short code (e.g. "en", "te")
  if (/^[a-z]{2,3}$/i.test(v)) return v.toLowerCase();
  return 'en';
}

/** Display label for a stored language key, e.g. "telugu" → "Telugu" */
export function scriptLanguageLabel(value: string): string {
  const v = (value || DEFAULT_SCRIPT_LANGUAGE).trim().toLowerCase();
  if (!v) return 'English';
  const found = SCRIPT_LANGUAGES.find((l) => l.value === v);
  if (found) return found.label;
  return v
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** /translate-script expects Title Case English name, e.g. "English", "Chinese Simplified" */
export function scriptLanguageApiName(value: string): string {
  const v = (value || DEFAULT_SCRIPT_LANGUAGE).trim().toLowerCase();
  if (!v) return 'English';
  const found = SCRIPT_LANGUAGES.find((l) => l.value === v);
  if (found) return found.apiName ?? found.label;
  return scriptLanguageLabel(v);
}
