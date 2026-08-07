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

/** /translate-script expects Title Case English name, e.g. "English", "Chinese Simplified" */
export function scriptLanguageApiName(value: string): string {
  const v = (value || DEFAULT_SCRIPT_LANGUAGE).trim().toLowerCase();
  if (!v) return 'English';
  const found = SCRIPT_LANGUAGES.find((l) => l.value === v);
  if (found) return found.apiName ?? found.label;
  return v
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
