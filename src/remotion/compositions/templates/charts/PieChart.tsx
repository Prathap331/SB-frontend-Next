'use client';

import type { TemplateProps } from '../../../types';
import { readChartData, readColor } from '../../../props';
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

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y} Z`;
}

export function PieChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#f59e0b');
  const rows = chartValues(readChartData(data.props)).slice(0, 8);
  const total = rows.reduce((s, r) => s + Math.abs(r.value), 0) || 1;
  const progress = clockProgress(clock, 0, Math.max(20, clock.fps));
  const opacity = appearOpacity(clock);
  let cursor = 0;

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <TitleBlock data={data} color="#f5f5f7" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, i) => (
              <div key={row.label} style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#f5f5f7' }}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: row.color || paletteColor(i, accent) }} />
                <span style={{ fontSize: 16 }}>{row.label}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 14 }}>
                  {formatChartValue(row.value)} · {Math.round((Math.abs(row.value) / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 280 280" width="280" height="280">
          {rows.length === 0 ? (
            <circle cx="140" cy="140" r="110" fill="rgba(255,255,255,0.06)" />
          ) : (
            rows.map((row, i) => {
              const sweep = (Math.abs(row.value) / total) * 360 * progress;
              const start = cursor;
              const end = cursor + sweep;
              cursor += (Math.abs(row.value) / total) * 360;
              return (
                <path
                  key={row.label}
                  d={slicePath(140, 140, 110, start, Math.max(start + 0.2, end))}
                  fill={row.color || paletteColor(i, accent)}
                />
              );
            })
          )}
        </svg>
      </CardShell>
    </TemplateStage>
  );
}
