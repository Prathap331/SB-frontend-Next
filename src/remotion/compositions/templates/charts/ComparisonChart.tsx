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

export function ComparisonChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#3b82f6');
  const rows = chartValues(readChartData(data.props)).slice(0, 6);
  const peak = maxAbs(rows);
  const opacity = appearOpacity(clock);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <TitleBlock data={data} color="#f5f5f7" />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, rows.length || 2)}, 1fr)`, gap: 18 }}>
          {(rows.length ? rows : [{ label: 'A', value: 0 }, { label: 'B', value: 0 }]).map((row, i) => {
            const t = staggeredProgress(clock, i, 6, 18);
            const h = (Math.abs(row.value) / peak) * 200 * t;
            const color = row.color || paletteColor(i, accent);
            return (
              <div key={`${row.label}-${i}`} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 20,
                    padding: 16,
                  }}
                >
                  <div style={{ width: '70%', height: h, borderRadius: 16, background: color }} />
                </div>
                <div style={{ marginTop: 12, color: '#fff', fontSize: 22, fontWeight: 700 }}>{row.label}</div>
                <div style={{ color: 'rgba(245,245,247,0.7)', fontSize: 16 }}>{formatChartValue(row.value)}</div>
              </div>
            );
          })}
        </div>
      </CardShell>
    </TemplateStage>
  );
}
