'use client';

/**
 * UI-06 · News Headline Card  (animation_type: "ui_news_headline")
 * Narration cites a news report: publication, headline, date and an optional article picture —
 * as 1–3 stacked headline cards, or as a "breaking news" band along the bottom (over footage).
 * Only real, published headlines, with their publication and date. Generic styling, no real logos.
 *
 * Inputs (full list, limits and JSON Schema: UI06NewsHeadline.inputs.json):
 *   items[] { publication, headline, date, image_url } · label · image_url · look · background
 *   style{fonts, colours} · font_sizes{…} · animations{…} · cue_times [headline 1, 2, 3]
 * Timing: 3–8s from clock.durationInFrames.
 */
import { Img } from './core/remotionSafe';
import type { TemplateProps } from '../../../types';
import { readImageUrl, readNonEmptyString } from '../../../props';
import { BACKGROUND_IMAGE, applySizes, normaliseText, readAnim, type TemplateSpec } from './core/contentSpec';
import { measureFor } from './core/measure';
import { blockHeight, fitText, linesAt, sharedFont, words, type Line, type Measure } from './core/fit';
import { cardStyle, exitStyle, progress, shapeState, textAnimFrames } from './core/motion';
import { MIN_HOLD, exitFrames, planTimeline, readCues, type Plan, type Unit } from './core/timeline';
import { SafeArea, SAFE_H, SAFE_W } from './core/safeArea';
import { fontFor, readStyle, styleVars, withAlpha } from './core/style';
import { AnimatedText, StoryBackground, leaf, readBgMode, readFirst } from './core/shared';
import { withAutoFit } from './core/autofit';

export const UI06_SPEC: TemplateSpec = {
  id: 'UI-06',
  animationType: 'ui_news_headline',
  name: 'News Headline Card',
  pickWhen: 'Narration cites a news report or several headlines about the same story.',
  placement: 'both',
  image: BACKGROUND_IMAGE,
  duration: { min: 90, default: 150, max: 240 },
  text: {
    label: { label: 'Band label', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 3, maxWordChars: 14, maxLines: 1, fontMax: 30, fontMin: 22, weight: 800, lineHeight: 1.2, hint: 'Band look only; default "Breaking news".', fills: 'Label box on the band', example: 'Breaking news' },
  },
  lists: {
    items: {
      label: 'Headline',
      fills: 'Headlines, newest first (the band look shows the first one)',
      minItems: 1,
      maxItems: 3,
      image: { required: false, fills: 'Article picture (left of the headline)' },
      fields: {
        publication: { label: 'Publication', required: true, minChars: 2, maxChars: 30, minWords: 1, maxWords: 5, maxWordChars: 18, maxLines: 1, fontMax: 26, fontMin: 18, weight: 800, lineHeight: 1.2, hint: 'Newspaper / site name as printed.', fills: 'Publication name' },
        headline: { label: 'Headline', required: true, minChars: 10, maxChars: 100, minWords: 3, maxWords: 18, maxWordChars: 18, maxLines: 3, fontMax: 56, fontMin: 28, weight: 700, lineHeight: 1.18, hint: 'The real headline, word for word.', fills: 'Headline' },
        date: { label: 'Date', required: false, minChars: 2, maxChars: 20, minWords: 1, maxWords: 4, maxWordChars: 12, maxLines: 1, fontMax: 24, fontMin: 18, weight: 500, lineHeight: 1.2, hint: '"12 March 2025".', fills: 'Publication date' },
      },
    },
  },
  options: {
    look: { label: 'Look', values: ['cards', 'band'], default: 'cards', fills: 'Headline cards in the centre, or a breaking-news band along the bottom' },
    background: { label: 'Background', values: ['theme', 'image', 'transparent'], default: 'theme', fills: 'theme gradient, image_url, or transparent over footage (the band look is usually transparent)' },
  },
  animations: {
    cards: { label: 'Cards / band', kind: 'card', target: 'each headline card (or the band)', default: 'slide_up' },
    publication: { label: 'Publication', kind: 'text', target: 'publication line', default: 'fade' },
    headline: { label: 'Headline', kind: 'text', target: 'headline text', default: 'word_fade' },
    label_box: { label: 'Band label', kind: 'shape', target: 'label box on the band', default: 'grow' },
    image_motion: { label: 'Background image motion', kind: 'image_motion', target: 'background image', default: 'push_in' },
    image_entry: { label: 'Background entry', kind: 'image_entry', target: 'background (first 12 frames)', default: 'fade' },
    exit: { label: 'Exit', kind: 'exit', target: 'all foreground content', default: 'fade_up' },
  },
  cues: { description: 'One cue per headline, when the narrator reads or mentions it.', units: ['headline 1', 'headline 2', 'headline 3'] },
  colors: ['card', 'card_border', 'negative'],
  example: { items: [{ publication: 'The Example Times', headline: 'UPI crosses 18 billion transactions in a single month', date: 'DD Month YYYY' }], look: 'cards', background: 'theme' },
};

export type NewsItem = { publication: string; headline: string; date?: string; image?: string };
export const CARD_PAD = 34;
export const CARD_GAP = 24;
export type NewsLayout = { look: 'cards' | 'band'; labelW: number; cardW: number; cardH: number; img: number; pubs: Line[]; heads: Line[][]; dates: (Line | undefined)[]; label?: Line; bandH: number };

export function layoutNews(input: { items: NewsItem[]; look: 'cards' | 'band'; label: string }, measure: Measure, spec: TemplateSpec = UI06_SPEC): NewsLayout {
  const F = spec.lists.items.fields;
  const n = Math.max(1, input.items.length);
  if (input.look === 'band') {
    const it = input.items[0];
    const label = fitText(input.label.toLocaleUpperCase(), spec.text.label, 400, measure, false).lines[0];
    // rendered in capitals with 0.06em letter spacing: measure it that way
    const labelW = Math.ceil(measure(label.text, label.size, 800) + label.size * 0.06 * label.text.length + 48);
    const textW = SAFE_W - labelW - 40 - 48;
    const head = fitText(it.headline, { ...F.headline, maxLines: 2, fontMax: 44 }, textW, measure).lines;
    const pub = fitText([it.publication, it.date].filter(Boolean).join('  ·  '), F.publication, textW, measure, false).lines[0];
    const bandH = Math.round(blockHeight(head, F.headline.lineHeight) + pub.size * 1.2 + 10 + 40);
    return { look: 'band', labelW, cardW: SAFE_W, cardH: bandH, img: 0, pubs: [pub], heads: [head], dates: [], label, bandH };
  }
  const cardW = n === 1 ? 1400 : 1500;
  const cardH = Math.floor((SAFE_H - CARD_GAP * (n - 1)) / n);
  const hasImg = input.items.some((i) => i.image);
  const img = hasImg ? Math.min(n === 1 ? 460 : 300, Math.round((cardH - CARD_PAD * 2) * 16 / 9)) : 0;
  const textW = cardW - CARD_PAD * 2 - (img ? img + 32 : 0);
  const maxLines = n === 1 ? 3 : n === 2 ? 3 : 2;
  let cap = n === 1 ? F.headline.fontMax : n === 2 ? 44 : 36;
  for (;;) {
    const hs = { ...F.headline, maxLines };
    const hf = sharedFont(input.items.map((i) => i.headline), hs, textW, measure, cap);
    const heads = input.items.map((i) => linesAt(i.headline, hf, hs, textW, measure));
    const pubs = input.items.map((i) => fitText(i.publication, F.publication, textW * 0.6, measure, false).lines[0]);
    const dates = input.items.map((i) => (i.date ? fitText(i.date, F.date, textW * 0.35, measure, false).lines[0] : undefined));
    const need = Math.max(...heads.map((h, k) => blockHeight(h, F.headline.lineHeight) + pubs[k].size * 1.2 + 14)) + CARD_PAD * 2;
    if (need <= (n === 1 ? SAFE_H * 0.7 : cardH) || cap <= F.headline.fontMin) {
      // cards hug their content (no empty band under short headlines); a picture keeps its 16:9 height
      const hug = Math.max(need, img ? Math.round(img * 9 / 16) + CARD_PAD * 2 : 0);
      // …and their width hugs the widest line too, so short headlines do not leave an empty band on the right
      const textUsed = Math.max(
        ...heads.map((h) => Math.max(...h.map((l) => measure(l.text, l.size, F.headline.weight)))),
        ...pubs.map((p, k) => measure(p.text.toLocaleUpperCase(), p.size, 800) * 1.1 + (dates[k] ? 18 + measure(dates[k]!.text, dates[k]!.size, 500) : 0)),
      );
      const hugW = Math.min(cardW, Math.max(560, Math.ceil(textUsed) + CARD_PAD * 2 + (img ? img + 32 : 0) + 8));
      return { look: 'cards', labelW: 0, cardW: hugW, cardH: n === 1 ? hug : Math.min(cardH, hug), img, pubs, heads, dates, bandH: 0 };
    }
    cap -= 2;
  }
}

export function planNews(L: NewsLayout, anim: string, duration: number, cueTimes?: number[]): Plan {
  const n = L.heads.length;
  const budget = duration - exitFrames(duration) - MIN_HOLD;
  const gap = n > 1 ? Math.max(8, Math.min(40, Math.floor((budget - 8 - 40) / (n - 1)))) : 0;
  const units: Unit[] = [];
  L.heads.forEach((h, i) => {
    const t = h.map((l) => l.text).join(' ');
    const s0 = 8 + i * gap;
    units.push({ key: `card${i}`, label: `Headline ${i + 1} card`, start: s0, dur: 14, cue: i });
    units.push({ key: `pub${i}`, label: `Headline ${i + 1} publication`, start: s0 + 6, dur: 12, follows: { key: `card${i}`, offset: 6 } });
    units.push({ key: `head${i}`, label: `Headline ${i + 1} text`, start: s0 + 10, dur: textAnimFrames(anim, words(t).length, t.length, 18), follows: { key: `card${i}`, offset: 10 } });
  });
  if (L.label) units.push({ key: 'label', label: 'Band label', start: 4, dur: 12, follows: { key: 'card0', offset: -4 } });
  return planTimeline(duration, units, cueTimes);
}

const opt = <T extends string>(props: Record<string, unknown>, key: string, allowed: readonly T[], fallback: T): T => {
  const v = readNonEmptyString(props, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

export function prepareUI06(props: Record<string, unknown>, durationInFrames: number) {
  const F = UI06_SPEC.lists.items.fields;
  const A = (k: string) => readAnim(props, UI06_SPEC, k);
  const style = readStyle(props);
  const sized = applySizes(UI06_SPEC, props);
  const measure = measureFor(style);
  const s = (o: Record<string, unknown>, k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : undefined);
  const items: NewsItem[] = (Array.isArray(props.items) ? props.items : [])
    .map((x): NewsItem | null => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const publication = normaliseText(s(o, 'publication'), F.publication);
      const headline = normaliseText(s(o, 'headline'), F.headline);
      return publication && headline ? { publication, headline, date: normaliseText(s(o, 'date'), F.date) || undefined, image: s(o, 'image_url') } : null;
    })
    .filter((x): x is NewsItem => x !== null)
    .slice(0, 3);
  const look = opt(props, 'look', ['cards', 'band'] as const, 'cards');
  const L = layoutNews({ items: items.length ? items : [{ publication: '—', headline: '—' }], look, label: normaliseText(readFirst(props, ['label']), UI06_SPEC.text.label) || 'Breaking news' }, measure, sized.spec);
  const plan = planNews(L, A('headline'), durationInFrames, readCues(props));
  const imageUrl = readImageUrl(props);
  return { style, sized, A, items, L, plan, imageUrl, bg: readBgMode(props, imageUrl), debug: props.show_safe_area === true };
}

function UI06NewsHeadlineBase({ data, clock }: TemplateProps) {
  const props = data.props ?? {};
  const { frame, durationInFrames } = clock;
  const { style, A, items, L, plan, imageUrl, bg, debug } = prepareUI06(props, durationInFrames);
  const w = plan.windows;
  const F = UI06_SPEC.lists.items.fields;
  const accent = style.colors.accent;
  const exit = exitStyle(A('exit'), progress(frame, plan.exit.start, plan.exit.dur));
  const paper = style.custom.has('card') ? style.colors.card : '#FBFAF7';
  const ink = style.custom.has('card') ? style.colors.text : '#15161A';
  const inkMuted = style.custom.has('card') ? style.colors.muted : '#5B5F6B';
  if (L.look === 'band') {
    const lab = shapeState(A('label_box'), progress(frame, w.label?.start ?? 0, w.label?.dur ?? 1));
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
        {bg !== 'transparent' && <StoryBackground mode={bg} imageUrl={imageUrl} align="left" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />}
        <SafeArea debug={debug}>
          <div style={{ position: 'absolute', left: 0, bottom: 0, width: SAFE_W, height: L.bandH, display: 'flex', ...exit, ...cardStyle(A('cards'), progress(frame, w.card0.start, w.card0.dur)) }}>
            <div style={{ height: '100%', width: L.labelW, boxSizing: 'border-box', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 24px', background: style.colors.negative, borderRadius: '14px 0 0 14px', transform: `scaleX(${lab.length})`, transformOrigin: 'left', ...lab.style }}>
              {L.label && <span {...leaf('label', 'label')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.label.size, lineHeight: 1.2, color: '#FFFFFF', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{L.label.text}</span>}
            </div>
            <div style={{ flex: 1, height: '100%', background: withAlpha(style.colors.scrim, 0.88), borderRadius: '0 14px 14px 0', padding: '20px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
              <AnimatedText lines={L.heads[0]} anim={A('headline')} start={w.head0.start} dur={w.head0.dur} frame={frame} weight={F.headline.weight} lineHeight={F.headline.lineHeight} color="#FFFFFF" shadow="none" group="head-0" input="items[0].headline" />
              <span {...leaf('pub-0', 'items[0].publication · date')} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.pubs[0].size, lineHeight: 1.2, color: accent, whiteSpace: 'nowrap', opacity: progress(frame, w.pub0.start, w.pub0.dur) }}>{L.pubs[0].text}</span>
            </div>
          </div>
        </SafeArea>
      </div>
    );
  }
  const n = items.length || 1;
  const totalH = n * L.cardH + (n - 1) * CARD_GAP;
  const top0 = (SAFE_H - totalH) / 2;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...styleVars(style) }}>
      <StoryBackground mode={bg} imageUrl={imageUrl} align="center" accent={accent} frame={frame} durationInFrames={durationInFrames} colors={style.colors} motion={A('image_motion')} entry={A('image_entry')} />
      <SafeArea debug={debug}>
        <div style={{ position: 'absolute', inset: 0, ...exit }}>
          {items.map((it, i) => {
            const top = top0 + i * (L.cardH + CARD_GAP);
            const imgH = Math.round(Math.min(L.cardH - CARD_PAD * 2, (L.img * 9) / 16));
            return (
              <div key={i} style={{ position: 'absolute', left: (SAFE_W - L.cardW) / 2, top, width: L.cardW, height: L.cardH, boxSizing: 'border-box', padding: CARD_PAD, borderRadius: 18, background: paper, borderTop: `8px solid ${accent}`, display: 'flex', alignItems: 'center', gap: 32, ...cardStyle(A('cards'), progress(frame, w[`card${i}`].start, w[`card${i}`].dur)) }}>
                {L.img > 0 && it.image && (
                  <div {...leaf(`img-${i}`, `items[${i}].image_url`)} style={{ width: L.img, height: imgH, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                    <Img src={it.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                {L.img > 0 && !it.image && <div style={{ width: L.img, flexShrink: 0 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', opacity: progress(frame, w[`pub${i}`].start, w[`pub${i}`].dur) }}>
                    <span {...leaf(`pub-${i}`, `items[${i}].publication`)} style={{ fontFamily: fontFor(800), fontWeight: 800, fontSize: L.pubs[i].size, lineHeight: 1.2, color: ink, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{L.pubs[i].text}</span>
                    {L.dates[i] && <span {...leaf(`date-${i}`, `items[${i}].date`)} style={{ fontFamily: fontFor(500), fontWeight: 500, fontSize: L.dates[i]!.size, lineHeight: 1.2, color: inkMuted, whiteSpace: 'nowrap' }}>{L.dates[i]!.text}</span>}
                  </div>
                  <AnimatedText lines={L.heads[i]} anim={A('headline')} start={w[`head${i}`].start} dur={w[`head${i}`].dur} frame={frame} weight={F.headline.weight} lineHeight={F.headline.lineHeight} color={ink} shadow="none" group={`head-${i}`} input={`items[${i}].headline`} />
                </div>
              </div>
            );
          })}
        </div>
      </SafeArea>
    </div>
  );
}

/** Grows to fill the safe box when the content is small (core/autofit.tsx). */
export const UI06NewsHeadline = withAutoFit(UI06NewsHeadlineBase);
