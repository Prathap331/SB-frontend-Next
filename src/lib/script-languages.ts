/** API value (English) + native-script label for /generate-script language picker */
export type ScriptLanguageOption = {
  /** Sent to /generate-script as `language` */
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
