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
  maxAbs,
  paletteColor,
} from '../shared';

export function LineChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#38bdf8');
  const rows = chartValues(readChartData(data.props)).slice(0, 10);
  const peak = maxAbs(rows);
  const progress = clockProgress(clock);
  const opacity = appearOpacity(clock);
  const w = 640;
  const h = 260;
  const pad = 28;
  const pts = rows.map((row, i) => {
    const x = pad + (i / Math.max(1, rows.length - 1)) * (w - pad * 2);
    const y = h - pad - (Math.abs(row.value) / peak) * (h - pad * 2);
    return { x, y, row };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const length = Math.max(1, pts.length * 90);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <TitleBlock data={data} color="#f5f5f7" />
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="260">
          <path
            d={path || 'M 28 232 L 612 232'}
            fill="none"
            stroke={accent}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - progress)}
          />
          {pts.map((p, i) => {
            const shown = progress > i / Math.max(1, pts.length);
            return (
              <g key={p.row.label} opacity={shown ? 1 : 0}>
                <circle cx={p.x} cy={p.y} r="6" fill={p.row.color || paletteColor(i, accent)} />
                <text x={p.x} y={h - 6} textAnchor="middle" fill="rgba(245,245,247,0.7)" fontSize="12">
                  {p.row.label}
                </text>
                <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#fff" fontSize="12">
                  {formatChartValue(p.row.value)}
                </text>
              </g>
            );
          })}
        </svg>
      </CardShell>
    </TemplateStage>
  );
}
