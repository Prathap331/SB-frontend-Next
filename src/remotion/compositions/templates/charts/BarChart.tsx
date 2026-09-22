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

export function BarChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#3b82f6');
  const rows = chartValues(readChartData(data.props)).slice(0, 8);
  const peak = maxAbs(rows);
  const opacity = appearOpacity(clock);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <TitleBlock data={data} color="#f5f5f7" />
        {rows.length === 0 ? (
          <div style={{ height: 220, borderRadius: 16, background: 'rgba(255,255,255,0.04)' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 260 }}>
            {rows.map((row, i) => {
              const t = staggeredProgress(clock, i, 4, 16);
              const h = (Math.abs(row.value) / peak) * 220 * t;
              const color = row.color || paletteColor(i, accent);
              return (
                <div key={`${row.label}-${i}`} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ color: 'rgba(245,245,247,0.8)', fontSize: 14, marginBottom: 8 }}>
                    {formatChartValue(row.value)}
                  </div>
                  <div
                    style={{
                      height: h,
                      borderRadius: '12px 12px 4px 4px',
                      background: color,
                      boxShadow: `0 0 24px ${color}55`,
                    }}
                  />
                  <div style={{ marginTop: 10, color: 'rgba(245,245,247,0.7)', fontSize: 14 }}>{row.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </CardShell>
    </TemplateStage>
  );
}
