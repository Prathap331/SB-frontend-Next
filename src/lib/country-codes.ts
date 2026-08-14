export type CountryCode = {
  name: string;
  iso: string;
  dial: string; // digits only, e.g. "91"
};

/** Common dial codes — India first as default for this product. */
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'India', iso: 'IN', dial: '91' },
  { name: 'United States', iso: 'US', dial: '1' },
  { name: 'United Kingdom', iso: 'GB', dial: '44' },
  { name: 'United Arab Emirates', iso: 'AE', dial: '971' },
  { name: 'Australia', iso: 'AU', dial: '61' },
  { name: 'Canada', iso: 'CA', dial: '1' },
  { name: 'Singapore', iso: 'SG', dial: '65' },
  { name: 'Germany', iso: 'DE', dial: '49' },
  { name: 'France', iso: 'FR', dial: '33' },
  { name: 'Japan', iso: 'JP', dial: '81' },
  { name: 'South Korea', iso: 'KR', dial: '82' },
  { name: 'China', iso: 'CN', dial: '86' },
  { name: 'Hong Kong', iso: 'HK', dial: '852' },
  { name: 'Indonesia', iso: 'ID', dial: '62' },
  { name: 'Malaysia', iso: 'MY', dial: '60' },
  { name: 'Philippines', iso: 'PH', dial: '63' },
  { name: 'Thailand', iso: 'TH', dial: '66' },
  { name: 'Vietnam', iso: 'VN', dial: '84' },
  { name: 'Pakistan', iso: 'PK', dial: '92' },
  { name: 'Bangladesh', iso: 'BD', dial: '880' },
  { name: 'Sri Lanka', iso: 'LK', dial: '94' },
  { name: 'Nepal', iso: 'NP', dial: '977' },
  { name: 'Saudi Arabia', iso: 'SA', dial: '966' },
  { name: 'Qatar', iso: 'QA', dial: '974' },
  { name: 'Kuwait', iso: 'KW', dial: '965' },
  { name: 'Bahrain', iso: 'BH', dial: '973' },
  { name: 'Oman', iso: 'OM', dial: '968' },
  { name: 'South Africa', iso: 'ZA', dial: '27' },
  { name: 'Nigeria', iso: 'NG', dial: '234' },
  { name: 'Kenya', iso: 'KE', dial: '254' },
  { name: 'Brazil', iso: 'BR', dial: '55' },
  { name: 'Mexico', iso: 'MX', dial: '52' },
  { name: 'Spain', iso: 'ES', dial: '34' },
  { name: 'Italy', iso: 'IT', dial: '39' },
  { name: 'Netherlands', iso: 'NL', dial: '31' },
  { name: 'Sweden', iso: 'SE', dial: '46' },
  { name: 'Switzerland', iso: 'CH', dial: '41' },
  { name: 'New Zealand', iso: 'NZ', dial: '64' },
  { name: 'Ireland', iso: 'IE', dial: '353' },
  { name: 'Portugal', iso: 'PT', dial: '351' },
  { name: 'Poland', iso: 'PL', dial: '48' },
  { name: 'Turkey', iso: 'TR', dial: '90' },
  { name: 'Russia', iso: 'RU', dial: '7' },
  { name: 'Egypt', iso: 'EG', dial: '20' },
  { name: 'Israel', iso: 'IL', dial: '972' },
];

export const DEFAULT_COUNTRY_DIAL = '91';

/** Stored format: "+91 9876543210" */
export function formatPhoneWithCountry(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '');
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
      if (digitsOnly.startsWith(c.dial) && digitsOnly.length > c.dial.length) {
        return { dial: c.dial, national: digitsOnly.slice(c.dial.length) };
      }
    }
    // Unknown +code: use first 1–3 digits as dial when a national part remains
    const len = Math.min(3, Math.max(1, digitsOnly.length - 4));
    return { dial: digitsOnly.slice(0, len), national: digitsOnly.slice(len) };
  }

  // Legacy number without country code — assume default
  return { dial: DEFAULT_COUNTRY_DIAL, national: digitsOnly };
}

/** True when dial + national number are both present. */
export function isCompletePhone(stored: string): boolean {
  const { dial, national } = parsePhoneWithCountry(stored);
  return Boolean(dial) && national.replace(/\D/g, '').length >= 6;
}
