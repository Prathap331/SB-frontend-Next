'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_DIAL,
  formatPhoneWithCountry,
  parsePhoneWithCountry,
} from '@/lib/country-codes';

type PhoneInputProps = {
  value: string;
  onChange: (fullPhone: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  /** Visual variant to match surrounding forms */
  variant?: 'filled' | 'outline';
  className?: string;
};

export default function PhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = '98765 43210',
  id,
  variant = 'filled',
  className = '',
}: PhoneInputProps) {
  const parsed = useMemo(() => parsePhoneWithCountry(value), [value]);
  const [dial, setDial] = useState(parsed.dial || DEFAULT_COUNTRY_DIAL);
  const [national, setNational] = useState(parsed.national);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync from external value (e.g. loaded profile)
  useEffect(() => {
    const next = parsePhoneWithCountry(value);
    setDial(next.dial || DEFAULT_COUNTRY_DIAL);
    setNational(next.national);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const emit = (nextDial: string, nextNational: string) => {
    onChange(formatPhoneWithCountry(nextDial, nextNational));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        `+${c.dial}`.includes(q),
    );
  }, [search]);

  const selected = COUNTRY_CODES.find(c => c.dial === dial) ?? {
    name: 'Custom',
    iso: '',
    dial,
  };

  const shell =
    variant === 'outline'
      ? 'border border-gray-200 bg-white focus-within:border-[#1d1d1f] focus-within:ring-2 focus-within:ring-[#1d1d1f]/20'
      : 'border border-gray-200 bg-[#f5f5f7] focus-within:border-[#1d1d1f] focus-within:ring-2 focus-within:ring-[#1d1d1f]/20';

  return (
    <div ref={rootRef} className={`relative flex items-stretch rounded-xl overflow-visible ${shell} ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(o => !o);
          setSearch('');
        }}
        className="flex items-center gap-1 pl-3 pr-2 py-2.5 text-sm text-[#1d1d1f] border-r border-gray-200 hover:bg-black/[0.03] transition-colors disabled:opacity-60 shrink-0"
        aria-label="Select country code"
      >
        <span className="font-medium tabular-nums">+{selected.dial}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#6e6e73] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={national}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => {
          const next = e.target.value.replace(/[^\d\s-]/g, '');
          setNational(next);
          emit(dial, next);
        }}
        className="flex-1 min-w-0 px-3 py-2.5 text-sm text-[#1d1d1f] bg-transparent outline-none placeholder-[#a1a1a6] disabled:opacity-60"
      />

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-[#6e6e73] flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search country or code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm text-[#1d1d1f] bg-transparent outline-none placeholder-[#a1a1a6]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map(c => (
                <button
                  key={`${c.iso}-${c.dial}-${c.name}`}
                  type="button"
                  onClick={() => {
                    setDial(c.dial);
                    emit(c.dial, national);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors ${
                    dial === c.dial ? 'bg-[#1d1d1f] text-white' : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className={`tabular-nums shrink-0 ${dial === c.dial ? 'text-white/80' : 'text-[#6e6e73]'}`}>
                    +{c.dial}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-xs text-[#6e6e73]">No countries found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
