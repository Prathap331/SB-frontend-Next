/** Languages supported by speech / TTS generation */
import { VOICE_CLONE_LANGUAGES } from '@/lib/voice-clone-languages';

export type SpeechLanguage = {
  name: string;
  code: string;
};

export const SPEECH_SUPPORTED_LANGUAGES: SpeechLanguage[] = VOICE_CLONE_LANGUAGES.map(
  ({ name, code }) => ({ name, code }),
);

