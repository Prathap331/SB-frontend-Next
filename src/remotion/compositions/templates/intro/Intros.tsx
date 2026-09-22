'use client';

import type { TemplateProps } from '../../../types';
import { readColor, readDisplayLines, readDisplayText, readItemList, readNonEmptyString, readNumberProp } from '../../../props';
import { clockSpring } from '../../../animation';
import { CardShell, TemplateStage, appearOpacity, clockProgress } from '../shared';

export function ChapterTitle({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayLines(data.props)[0] ?? readDisplayText(data.props);
  const n = readNumberProp(data.props, ['chapter', 'number', 'index']) ?? 1;
  const s = clockSpring(clock.frame, clock.fps);
  return (
    <TemplateStage style={{ background: 'linear-gradient(180deg, #0b0b0f, #16120e)' }}>
      <div style={{ textAlign: 'center', transform: `translateY(${(1 - s) * 24}px)`, opacity: s }}>
        <div style={{ color, letterSpacing: '0.28em', fontSize: 16, marginBottom: 16 }}>CHAPTER {String(n).padStart(2, '0')}</div>
        <div style={{ color: '#fff', fontSize: 64, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</div>
      </div>
    </TemplateStage>
  );
}

export function CinematicTitleIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const sub = readNonEmptyString(data.props, 'subtitle');
  const t = clockProgress(clock);
  const scale = 1.12 - t * 0.12;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#050505' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 90, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: '#000' }} />
      <TemplateStage>
        <div style={{ textAlign: 'center', transform: `scale(${scale})`, opacity: t }}>
          <div style={{ color, fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</div>
          {sub ? <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>{sub}</div> : null}
        </div>
      </TemplateStage>
    </div>
  );
}

export function CountdownIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fff');
  const start = Math.max(1, Math.round(readNumberProp(data.props, ['from', 'seconds', 'value']) ?? 3));
  const remaining = Math.max(0, Math.ceil(start - clock.frame / Math.max(1, clock.fps)));
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  return (
    <TemplateStage style={{ background: '#050505' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color, fontSize: remaining > 0 ? 140 : 56, fontWeight: 800 }}>
          {remaining > 0 ? remaining : title}
        </div>
      </div>
    </TemplateStage>
  );
}

export function CreditsRoll({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const items = readItemList(data.props);
  const title = readNonEmptyString(data.props, 'title') ?? 'Credits';
  const y = 40 - clockProgress(clock) * 120;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#050505' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, textAlign: 'center' }}>
        <div style={{ color, fontSize: 28, letterSpacing: '0.2em', marginBottom: 28 }}>{title}</div>
        {items.map((item) => (
          <div key={item} style={{ color: '#fff', fontSize: 26, marginBottom: 14, fontWeight: 600 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EndCard({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#F5A623');
  const title = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Thanks for watching');
  const sub = readNonEmptyString(data.props, 'subtitle') ?? readNonEmptyString(data.props, 'caption');
  const s = clockSpring(clock.frame, clock.fps);
  return (
    <TemplateStage style={{ background: '#0b0b0f' }}>
      <div style={{ textAlign: 'center', transform: `scale(${0.88 + 0.12 * s})`, opacity: s }}>
        <div style={{ width: 72, height: 4, background: color, margin: '0 auto 24px' }} />
        <div style={{ color: '#fff', fontSize: 56, fontWeight: 800 }}>{title}</div>
        {sub ? <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 22 }}>{sub}</div> : null}
      </div>
    </TemplateStage>
  );
}

export function SubscribeReminder({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#ef4444');
  const title = readNonEmptyString(data.props, 'title') ?? (readDisplayText(data.props) || 'Subscribe');
  const s = clockSpring(clock.frame, clock.fps, 0, { damping: 10, stiffness: 170 });
  return (
    <TemplateStage>
      <div
        style={{
          transform: `translateY(${(1 - s) * 30}px) scale(${s})`,
          background: '#111',
          borderRadius: 999,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: `1px solid ${color}66`,
        }}
      >
        <div style={{ width: 18, height: 18, borderRadius: 4, background: color }} />
        <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{title}</div>
      </div>
    </TemplateStage>
  );
}

export function TitleSplit({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#fff');
  const title = readNonEmptyString(data.props, 'title') ?? readDisplayText(data.props);
  const s = clockSpring(clock.frame, clock.fps);
  const d = (1 - s) * 48;
  return (
    <TemplateStage style={{ opacity: appearOpacity(clock) }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ color, fontSize: 64, fontWeight: 800, transform: `translateY(${-d}px)` }}>{title}</div>
      </div>
      <div style={{ width: 120, height: 3, background: color, marginTop: 16, transform: `scaleX(${s})` }} />
    </TemplateStage>
  );
}

export function QuoteCardIntro({ data, clock }: TemplateProps) {
  const color = readColor(data.props, '#f5f5f7');
  const quote = readNonEmptyString(data.props, 'quote') ?? readDisplayText(data.props);
  const who = readNonEmptyString(data.props, 'attribution');
  const s = clockSpring(clock.frame, clock.fps);
  return (
    <TemplateStage>
      <CardShell style={{ textAlign: 'center', width: 'min(900px, 84%)', transform: `translateY(${(1 - s) * 20}px)`, opacity: s }}>
        <div style={{ fontSize: 72, color: color, opacity: 0.7, lineHeight: 1 }}>“</div>
        <div style={{ color, fontSize: 36, fontFamily: 'Georgia, serif', lineHeight: 1.4 }}>{quote}</div>
        {who ? <div style={{ marginTop: 20, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em' }}>— {who}</div> : null}
      </CardShell>
    </TemplateStage>
  );
}
