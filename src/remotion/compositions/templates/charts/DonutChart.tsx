'use client';

import type { TemplateProps } from '../../../types';
import { readChartData, readColor, readNumberProp } from '../../../props';
import {
  CardShell,
  TitleBlock,
  TemplateStage,
  appearOpacity,
  chartValues,
  clockProgress,
  formatChartValue,
  paletteColor,
} from '../shared';

export function DonutChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#8b5cf6');
  const rows = chartValues(readChartData(data.props)).slice(0, 6);
  const total = rows.reduce((s, r) => s + Math.abs(r.value), 0);
  const explicit = readNumberProp(data.props, ['percent', 'percentage', 'value']);
  const progress = clockProgress(clock, 0, Math.max(18, clock.fps));
  const opacity = appearOpacity(clock);
  const r = 78;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const center =
    explicit != null
      ? `${Math.round(explicit * progress)}${String(data.props.unit ?? '%')}`
      : total
        ? formatChartValue(total * progress)
        : '0';

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell style={{ textAlign: 'center' }}>
        <TitleBlock data={data} color="#f5f5f7" align="center" />
        <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
          <svg viewBox="0 0 200 200" width="240" height="240">
            <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
            {rows.length === 0 ? (
              <circle
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke={accent}
                strokeWidth="18"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - progress)}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            ) : (
              rows.map((row, i) => {
                const frac = Math.abs(row.value) / (total || 1);
                const dash = c * frac * progress;
                const gap = c - dash;
                const rot = offset * 360;
                offset += frac;
                return (
                  <circle
                    key={row.label}
                    cx="100"
                    cy="100"
                    r={r}
                    fill="none"
                    stroke={row.color || paletteColor(i, accent)}
                    strokeWidth="18"
                    strokeDasharray={`${dash} ${gap}`}
                    transform={`rotate(${rot - 90} 100 100)`}
                  />
                );
              })
            )}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            {center}
          </div>
        </div>
      </CardShell>
    </TemplateStage>
  );
}
