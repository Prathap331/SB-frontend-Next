/** API value (lowercase key in DB) + display label for Translate picker */
export type ScriptLanguageOption = {
  /** Stored as key in script jsonb, e.g. "english", "chinese-simplified" */
  value: string;
  /** Display label (English name) */
  label: string;
  /** Sent to /translate-script — Title Case English; defaults to label */
  apiName?: string;
};

function lang(value: string, label: string, apiName?: string): ScriptLanguageOption {
  return apiName ? { value, label, apiName } : { value, label };
}

export const SCRIPT_LANGUAGES: ScriptLanguageOption[] = [
  lang('english', 'English'),
  lang('hindi', 'Hindi'),
  lang('chinese-simplified', 'Chinese Simplified'),
  lang('spanish', 'Spanish'),
  lang('arabic', 'Arabic'),
  lang('french', 'French'),
  lang('bengali', 'Bengali'),
  lang('portuguese', 'Portuguese'),
  lang('russian', 'Russian'),
  lang('indonesian', 'Indonesian'),
  lang('malay', 'Malay'),
  lang('german', 'German'),
  lang('japanese', 'Japanese'),
  lang('urdu', 'Urdu'),
  lang('turkish', 'Turkish'),
  lang('vietnamese', 'Vietnamese'),
  lang('korean', 'Korean'),
  lang('swahili', 'Swahili'),
  lang('marathi', 'Marathi'),
  lang('telugu', 'Telugu'),
  lang('tamil', 'Tamil'),
  lang('italian', 'Italian'),
  lang('persian', 'Persian'),
  lang('punjabi', 'Punjabi'),
  lang('thai', 'Thai'),
  lang('gujarati', 'Gujarati'),
  lang('filipino', 'Filipino'),
  lang('javanese', 'Javanese'),
  lang('chinese-traditional', 'Chinese Traditional'),
  lang('polish', 'Polish'),
  lang('hausa', 'Hausa'),
  lang('ukrainian', 'Ukrainian'),
  lang('amharic', 'Amharic'),
  lang('bhojpuri', 'Bhojpuri'),
  lang('dutch', 'Dutch'),
  lang('yoruba', 'Yoruba'),
  lang('kannada', 'Kannada'),
  lang('myanmar', 'Myanmar'),
  lang('pashto', 'Pashto'),
  lang('odia', 'Odia / Oriya', 'Odia'),
  lang('oromo', 'Oromo'),
  lang('malayalam', 'Malayalam'),
  lang('maithili', 'Maithili'),
  lang('uzbek', 'Uzbek'),
  lang('nepali', 'Nepali'),
  lang('sundanese', 'Sundanese'),
  lang('igbo', 'Igbo'),
  lang('lao', 'Lao'),
  lang('sindhi', 'Sindhi'),
  lang('zulu', 'Zulu'),
  lang('malagasy', 'Malagasy'),
  lang('romanian', 'Romanian'),
  lang('azerbaijani', 'Azerbaijani'),
  lang('somali', 'Somali'),
  lang('cebuano', 'Cebuano'),
  lang('lingala', 'Lingala'),
  lang('xhosa', 'Xhosa'),
  lang('sinhala', 'Sinhala'),
  lang('khmer', 'Khmer'),
  lang('afrikaans', 'Afrikaans'),
  lang('kurdish-kurmanji', 'Kurdish Kurmanji'),
  lang('assamese', 'Assamese'),
  lang('bambara', 'Bambara'),
  lang('chichewa', 'Chichewa'),
  lang('greek', 'Greek'),
  lang('hungarian', 'Hungarian'),
  lang('kazakh', 'Kazakh'),
  lang('haitian-creole', 'Haitian Creole'),
  lang('kinyarwanda', 'Kinyarwanda'),
  lang('luganda', 'Luganda'),
  lang('uyghur', 'Uyghur'),
  lang('twi', 'Twi'),
  lang('czech', 'Czech'),
  lang('catalan', 'Catalan'),
  lang('swedish', 'Swedish'),
  lang('tigrinya', 'Tigrinya'),
  lang('hebrew', 'Hebrew'),
  lang('ilocano', 'Ilocano'),
  lang('shona', 'Shona'),
  lang('serbian', 'Serbian'),
  lang('tajik', 'Tajik'),
  lang('kurdish-sorani', 'Kurdish Sorani'),
  lang('bulgarian', 'Bulgarian'),
  lang('quechua', 'Quechua'),
  lang('albanian', 'Albanian'),
  lang('turkmen', 'Turkmen'),
  lang('ewe', 'Ewe'),
  lang('armenian', 'Armenian'),
  lang('guarani', 'Guarani'),
  lang('danish', 'Danish'),
  lang('mongolian', 'Mongolian'),
  lang('croatian', 'Croatian'),
  lang('sesotho', 'Sesotho'),
  lang('finnish', 'Finnish'),
  lang('norwegian', 'Norwegian'),
  lang('tatar', 'Tatar'),
  lang('slovak', 'Slovak'),
  lang('belarusian', 'Belarusian'),
];

export const DEFAULT_SCRIPT_LANGUAGE = 'english';

/** ISO-ish codes for /generate-speech langCode (keyed by script jsonb language) */
const SCRIPT_LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  hindi: 'hi',
  'chinese-simplified': 'zh',
  'chinese-traditional': 'zh',
  spanish: 'es',
  arabic: 'ar',
  french: 'fr',
  bengali: 'bn',
  portuguese: 'pt',
  russian: 'ru',
  indonesian: 'id',
  malay: 'ms',
  german: 'de',
  japanese: 'ja',
  urdu: 'ur',
  turkish: 'tr',
  vietnamese: 'vi',
  korean: 'ko',
  swahili: 'sw',
  marathi: 'mr',
  telugu: 'te',
  tamil: 'ta',
  italian: 'it',
  persian: 'fa',
  punjabi: 'pa',
  thai: 'th',
  gujarati: 'gu',
  filipino: 'tl',
  javanese: 'jw',
  polish: 'pl',
  hausa: 'ha',
  ukrainian: 'uk',
  amharic: 'am',
  bhojpuri: 'bho',
  dutch: 'nl',
  yoruba: 'yo',
  kannada: 'kn',
  myanmar: 'my',
  pashto: 'ps',
  odia: 'or',
  oromo: 'om',
  malayalam: 'ml',
  maithili: 'mai',
  uzbek: 'uz',
  nepali: 'ne',
  sundanese: 'su',
  igbo: 'ig',
  lao: 'lo',
  sindhi: 'sd',
  zulu: 'zu',
  malagasy: 'mg',
  romanian: 'ro',
  azerbaijani: 'az',
  somali: 'so',
  cebuano: 'ceb',
  lingala: 'ln',
  xhosa: 'xh',
  sinhala: 'si',
  khmer: 'km',
  afrikaans: 'af',
  'kurdish-kurmanji': 'ku',
  assamese: 'as',
  bambara: 'bm',
  chichewa: 'ny',
  greek: 'el',
  hungarian: 'hu',
  kazakh: 'kk',
  'haitian-creole': 'ht',
  kinyarwanda: 'rw',
  luganda: 'lg',
  uyghur: 'ug',
  twi: 'tw',
  czech: 'cs',
  catalan: 'ca',
  swedish: 'sv',
  tigrinya: 'ti',
  hebrew: 'he',
  ilocano: 'ilo',
  shona: 'sn',
  serbian: 'sr',
  tajik: 'tg',
  'kurdish-sorani': 'ckb',
  bulgarian: 'bg',
  quechua: 'qu',
  albanian: 'sq',
  turkmen: 'tk',
  ewe: 'ee',
  armenian: 'hy',
  guarani: 'gn',
  danish: 'da',
  mongolian: 'mn',
  croatian: 'hr',
  sesotho: 'st',
  finnish: 'fi',
  norwegian: 'no',
  tatar: 'tt',
  slovak: 'sk',
  belarusian: 'be',
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
