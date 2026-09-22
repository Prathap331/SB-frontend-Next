'use client';

import type { TemplateProps } from '../../../types';
import { readChartData, readColor, readDisplayText, readNonEmptyString, readNumberProp } from '../../../props';
import { easeOutCubic } from '../../../animation';
import { CardShell, TemplateStage, appearOpacity, chartValues, clockProgress } from '../shared';

export function StatCounter({ data, clock }: TemplateProps) {
  const accent = readColor(data.props, '#F5A623');
  const rows = chartValues(readChartData(data.props));
  const rawText = readDisplayText(data.props);
  const match = rawText.match(/-?\d+(\.\d+)?/);
  const fromProp = readNumberProp(data.props, ['value', 'count', 'number', 'target', 'percent']);
  const target = fromProp ?? rows[0]?.value ?? (match ? Number(match[0]) : 0);
  const prefix = match ? rawText.slice(0, match.index) : readNonEmptyString(data.props, 'prefix') ?? '';
  const suffix =
    (match ? rawText.slice((match.index ?? 0) + match[0].length) : '') ||
    readNonEmptyString(data.props, 'suffix') ||
    readNonEmptyString(data.props, 'unit') ||
    '';
  const t = easeOutCubic(clockProgress(clock, 0, Math.max(12, Math.round(clock.fps * 0.85))));
  const shown = Number.isInteger(target) ? Math.round(target * t) : Number((target * t).toFixed(1));
  const caption =
    readNonEmptyString(data.props, 'caption') ??
    readNonEmptyString(data.props, 'subtitle') ??
    readNonEmptyString(data.props, 'label') ??
    rows[0]?.label;
  const opacity = appearOpacity(clock);

  return (
    <TemplateStage style={{ opacity }}>
      <CardShell style={{ textAlign: 'center', width: 'min(720px, 80%)' }}>
        <div style={{ color: accent, fontSize: 96, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
          {prefix}
          {shown}
          {suffix}
        </div>
        {caption ? (
          <div style={{ marginTop: 18, color: 'rgba(245,245,247,0.75)', fontSize: 28 }}>{caption}</div>
        ) : null}
      </CardShell>
    </TemplateStage>
  );
}
