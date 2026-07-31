import React from 'react';

/** Wrap ████ patch runs in a CSS blur so they aren't solid black blocks. */
export function withBlurredPatches(
  text: string,
  keyPrefix = 'p',
): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(█+)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^█+$/.test(part)) {
      return (
        <span
          key={`${keyPrefix}-blk-${i}`}
          className="inline"
          style={{
            filter: 'blur(5px)',
            WebkitFilter: 'blur(5px)',
            color: '#6e6e73',
          }}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>;
  });
}
