export type CountryCode = {
  name: string;
  iso: string;
  dial: string; // digits only, e.g. "91"
  /** Max subscriber digits after the country code */
  nationalLength: number;
  /** Defaults to nationalLength when the country uses a fixed length */
  nationalMin?: number;
};

/** Common dial codes — India first as default for this product. */
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'India', iso: 'IN', dial: '91', nationalLength: 10 },
  { name: 'United States', iso: 'US', dial: '1', nationalLength: 10 },
  { name: 'United Kingdom', iso: 'GB', dial: '44', nationalLength: 10 },
  { name: 'United Arab Emirates', iso: 'AE', dial: '971', nationalLength: 9 },
  { name: 'Australia', iso: 'AU', dial: '61', nationalLength: 9 },
  { name: 'Canada', iso: 'CA', dial: '1', nationalLength: 10 },
  { name: 'Singapore', iso: 'SG', dial: '65', nationalLength: 8 },
  { name: 'Germany', iso: 'DE', dial: '49', nationalLength: 11, nationalMin: 10 },
  { name: 'France', iso: 'FR', dial: '33', nationalLength: 9 },
  { name: 'Japan', iso: 'JP', dial: '81', nationalLength: 10 },
  { name: 'South Korea', iso: 'KR', dial: '82', nationalLength: 10, nationalMin: 9 },
  { name: 'China', iso: 'CN', dial: '86', nationalLength: 11 },
  { name: 'Hong Kong', iso: 'HK', dial: '852', nationalLength: 8 },
  { name: 'Indonesia', iso: 'ID', dial: '62', nationalLength: 12, nationalMin: 9 },
  { name: 'Malaysia', iso: 'MY', dial: '60', nationalLength: 10, nationalMin: 9 },
  { name: 'Philippines', iso: 'PH', dial: '63', nationalLength: 10 },
  { name: 'Thailand', iso: 'TH', dial: '66', nationalLength: 9 },
  { name: 'Vietnam', iso: 'VN', dial: '84', nationalLength: 9 },
  { name: 'Pakistan', iso: 'PK', dial: '92', nationalLength: 10 },
  { name: 'Bangladesh', iso: 'BD', dial: '880', nationalLength: 10 },
  { name: 'Sri Lanka', iso: 'LK', dial: '94', nationalLength: 9 },
  { name: 'Nepal', iso: 'NP', dial: '977', nationalLength: 10 },
  { name: 'Saudi Arabia', iso: 'SA', dial: '966', nationalLength: 9 },
  { name: 'Qatar', iso: 'QA', dial: '974', nationalLength: 8 },
  { name: 'Kuwait', iso: 'KW', dial: '965', nationalLength: 8 },
  { name: 'Bahrain', iso: 'BH', dial: '973', nationalLength: 8 },
  { name: 'Oman', iso: 'OM', dial: '968', nationalLength: 8 },
  { name: 'South Africa', iso: 'ZA', dial: '27', nationalLength: 9 },
  { name: 'Nigeria', iso: 'NG', dial: '234', nationalLength: 10 },
  { name: 'Kenya', iso: 'KE', dial: '254', nationalLength: 9 },
  { name: 'Brazil', iso: 'BR', dial: '55', nationalLength: 11, nationalMin: 10 },
  { name: 'Mexico', iso: 'MX', dial: '52', nationalLength: 10 },
  { name: 'Spain', iso: 'ES', dial: '34', nationalLength: 9 },
  { name: 'Italy', iso: 'IT', dial: '39', nationalLength: 10, nationalMin: 9 },
  { name: 'Netherlands', iso: 'NL', dial: '31', nationalLength: 9 },
  { name: 'Sweden', iso: 'SE', dial: '46', nationalLength: 9 },
  { name: 'Switzerland', iso: 'CH', dial: '41', nationalLength: 9 },
  { name: 'New Zealand', iso: 'NZ', dial: '64', nationalLength: 10, nationalMin: 8 },
  { name: 'Ireland', iso: 'IE', dial: '353', nationalLength: 9 },
  { name: 'Portugal', iso: 'PT', dial: '351', nationalLength: 9 },
  { name: 'Poland', iso: 'PL', dial: '48', nationalLength: 9 },
  { name: 'Turkey', iso: 'TR', dial: '90', nationalLength: 10 },
  { name: 'Russia', iso: 'RU', dial: '7', nationalLength: 10 },
  { name: 'Egypt', iso: 'EG', dial: '20', nationalLength: 10 },
  { name: 'Israel', iso: 'IL', dial: '972', nationalLength: 9 },
];

export const DEFAULT_COUNTRY_DIAL = '91';

export function nationalDigitLimit(dial: string): number {
  const match = COUNTRY_CODES.find((c) => c.dial === dial.replace(/\D/g, ''));
  if (match) return match.nationalLength;
  const codeLen = dial.replace(/\D/g, '').length;
  return Math.max(6, 15 - codeLen);
}

export function nationalDigitMin(dial: string): number {
  const match = COUNTRY_CODES.find((c) => c.dial === dial.replace(/\D/g, ''));
  return match?.nationalMin ?? match?.nationalLength ?? 6;
}

export function clampNationalDigits(dial: string, national: string): string {
  return national.replace(/\D/g, '').slice(0, nationalDigitLimit(dial));
}

/** Stored format: "+91 9876543210" */
export function formatPhoneWithCountry(dial: string, national: string): string {
  const digits = clampNationalDigits(dial, national);
  const code = dial.replace(/\D/g, '');
  if (!digits) return code ? `+${code}` : '';
  return `+${code} ${digits}`;
}

export function parsePhoneWithCountry(stored: string): { dial: string; national: string } {
  const raw = (stored || '').trim();
  if (!raw) return { dial: DEFAULT_COUNTRY_DIAL, national: '' };

  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return { dial: DEFAULT_COUNTRY_DIAL, national: '' };

  // Prefer matching a known dial code (longest first) when value starts with +
  if (raw.startsWith('+')) {
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (digitsOnly === c.dial || digitsOnly.startsWith(c.dial)) {
        return { dial: c.dial, national: digitsOnly.slice(c.dial.length, c.dial.length + c.nationalLength) };
      }
    }
    // Unknown +code: use first 1–3 digits as dial when a national part remains
    const len = Math.min(3, Math.max(1, digitsOnly.length - 4));
    const dial = digitsOnly.slice(0, len);
    return { dial, national: clampNationalDigits(dial, digitsOnly.slice(len)) };
  }

  // Legacy number without country code — assume default
  return { dial: DEFAULT_COUNTRY_DIAL, national: clampNationalDigits(DEFAULT_COUNTRY_DIAL, digitsOnly) };
}

/** True when the national number matches that country code's digit count. */
export function isCompletePhone(stored: string): boolean {
  const { dial, national } = parsePhoneWithCountry(stored);
  const digits = national.replace(/\D/g, '');
  if (!dial || !digits) return false;
  const min = nationalDigitMin(dial);
  const max = nationalDigitLimit(dial);
  return digits.length >= min && digits.length <= max;
}
