'use client';

import type { TemplateProps } from '../../../types';
import { readChartData, readColor } from '../../../props';
import {
  CardShell,
  TitleBlock,
  TemplateStage,
  appearOpacity,
  chartValues,
  formatChartValue,
  maxAbs,
  paletteColor,
  staggeredProgress,
} from '../shared';

export function ProgressBars({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#3b82f6');
  const rows = chartValues(readChartData(data.props)).slice(0, 8);
  const peak = Math.max(100, maxAbs(rows));
  const opacity = appearOpacity(clock);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <TitleBlock data={data} color="#f5f5f7" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.length === 0 ? (
            <div style={{ height: 16, borderRadius: 99, background: 'rgba(255,255,255,0.08)' }} />
          ) : (
            rows.map((row, i) => {
              const t = staggeredProgress(clock, i, 5, 18);
              const pct = (Math.abs(row.value) / peak) * 100 * t;
              const color = row.color || paletteColor(i, accent);
              return (
                <div key={`${row.label}-${i}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#f5f5f7' }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 14, opacity: 0.75 }}>{formatChartValue(row.value)}</span>
                  </div>
                  <div style={{ height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardShell>
    </TemplateStage>
  );
}
