'use client';

import type { TemplateProps } from '../../../types';
import { readChartData, readColor, readDisplayText, readNumberProp } from '../../../props';
import { CardShell, TitleBlock, TemplateStage, appearOpacity, chartValues, clockProgress } from '../shared';

export function CircularProgress({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#22d3ee');
  const rows = chartValues(readChartData(data.props));
  const value = readNumberProp(data.props, ['value', 'percent', 'percentage', 'progress']) ?? rows[0]?.value ?? 0;
  const max = readNumberProp(data.props, ['max', 'total']) ?? 100;
  const t = clockProgress(clock, 0, Math.max(16, clock.fps));
  const pct = Math.max(0, Math.min(1, value / (max || 1))) * t;
  const r = 78;
  const c = 2 * Math.PI * r;
  const opacity = appearOpacity(clock);
  const label = readDisplayText(data.props);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell style={{ textAlign: 'center', width: 'min(560px, 78%)' }}>
        <TitleBlock data={data} color="#f5f5f7" align="center" />
        <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
          <svg viewBox="0 0 200 200" width="240" height="240">
            <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="16" />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={accent}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 42,
              fontWeight: 800,
            }}
          >
            {Math.round(pct * 100)}%
          </div>
        </div>
        {label && !data.props.title ? (
          <div style={{ marginTop: 16, color: 'rgba(245,245,247,0.75)', fontSize: 20 }}>{label}</div>
        ) : null}
      </CardShell>
    </TemplateStage>
  );
}
