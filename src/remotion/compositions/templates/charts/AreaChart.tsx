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
  maxAbs,
  paletteColor,
} from '../shared';

export function AreaChart({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#22c55e');
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
    return { x, y, label: row.label };
  });
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = pts.length
    ? `${line} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`
    : '';
  const length = Math.max(1, pts.length * 90);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell>
        <TitleBlock data={data} color="#f5f5f7" />
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="260">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
            </linearGradient>
            <clipPath id="areaClip">
              <rect x="0" y="0" width={w * progress} height={h} />
            </clipPath>
          </defs>
          <g clipPath="url(#areaClip)">
            <path d={area} fill="url(#areaFill)" />
            <path d={line || 'M 28 232'} fill="none" stroke={accent} strokeWidth="4" />
          </g>
          {pts.map((p) => (
            <text key={p.label} x={p.x} y={h - 6} textAnchor="middle" fill="rgba(245,245,247,0.7)" fontSize="12">
              {p.label}
            </text>
          ))}
          <path
            d={line || 'M 28 232'}
            fill="none"
            stroke={paletteColor(0, accent)}
            strokeWidth="4"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - progress)}
          />
        </svg>
      </CardShell>
    </TemplateStage>
  );
}
