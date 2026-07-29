/** API value (lowercase key in DB) + native-script label for Translate picker */
export type ScriptLanguageOption = {
  /** Stored as key in script jsonb, e.g. "english", "telugu" */
  value: string;
  /** Display label in the language's own script */
  label: string;
};

export const SCRIPT_LANGUAGES: ScriptLanguageOption[] = [
  { value: 'english', label: 'English' },
  { value: 'gujarati', label: 'ગુજરાતી' },
  { value: 'hindi', label: 'हिन्दी' },
  { value: 'kannada', label: 'ಕನ್ನಡ' },
  { value: 'bengali', label: 'বাংলা' },
  { value: 'malayalam', label: 'മലയാളം' },
  { value: 'telugu', label: 'తెలుగు' },
  { value: 'tamil', label: 'தமிழ்' },
  { value: 'marathi', label: 'मराठी' },
  { value: 'odia', label: 'ଓଡ଼ିଆ' },
  { value: 'punjabi', label: 'ਪੰਜਾਬੀ' },
];

export const DEFAULT_SCRIPT_LANGUAGE = 'english';

/** /translate-script expects Title Case, e.g. "English", "Telugu" */
export function scriptLanguageApiName(value: string): string {
  const v = (value || DEFAULT_SCRIPT_LANGUAGE).trim().toLowerCase();
  if (!v) return 'English';
  return v.charAt(0).toUpperCase() + v.slice(1);
}
