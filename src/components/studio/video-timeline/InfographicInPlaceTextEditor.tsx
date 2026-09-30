'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

const DESIGN_W = 1920;
const DESIGN_H = 1080;

const SKIP_PATH = /(icon|color|url|image|src|accent line|background)/i;

type Session = {
  path: string;
  groupBase: string;
  lineIndex: number;
  lineTexts: string[];
  value: string;
  original: string;
  box: { left: number; top: number; width: number; height: number };
  style: CSSProperties;
  nowrap: boolean;
};

type Props = {
  enabled: boolean;
  isPlaying: boolean;
  props: Record<string, unknown>;
  onCommit: (path: string, value: string) => void;
  onRequestPause?: () => void;
};

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isLikelyTextValue(key: string, value: string): boolean {
  if (SKIP_PATH.test(key)) return false;
  const t = value.trim();
  if (!t) return false;
  if (t.startsWith('#') && t.length <= 9) return false;
  if (/^https?:\/\//i.test(t)) return false;
  return true;
}

function inferPathFromText(el: HTMLElement, props: Record<string, unknown>): string | null {
  const text = normalize(el.innerText || '');
  if (!text || text.length > 400) return null;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string' && isLikelyTextValue(key, value) && normalize(value) === text) {
      return key;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      const joined = normalize(value.join(' '));
      if (joined === text) return key;
    }
  }
  for (const [key, value] of Object.entries(props)) {
    if (!Array.isArray(value)) continue;
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'string' && isLikelyTextValue(`${key}[]`, item) && normalize(item) === text) {
        return `${key}[${i}]`;
      }
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [childKey, childVal] of Object.entries(item as Record<string, unknown>)) {
          if (
            typeof childVal === 'string' &&
            isLikelyTextValue(childKey, childVal) &&
            normalize(childVal) === text
          ) {
            return `${key}[${i}].${childKey}`;
          }
        }
      }
    }
  }
  return null;
}

function isDecorative(el: HTMLElement): boolean {
  if (el.getAttribute('data-sb-kind') === 'guide') return true;
  if (el.closest('svg')) return true;
  const input = el.getAttribute('data-sb-input') || '';
  if (SKIP_PATH.test(input)) return true;
  return Boolean(el.querySelector('svg, img, canvas, video'));
}

function isDeepestTextMatch(el: HTMLElement, props: Record<string, unknown>): boolean {
  if (!inferPathFromText(el, props)) return false;
  const text = normalize(el.innerText || '');
  return ![...el.children].some((child) => normalize((child as HTMLElement).innerText || '') === text);
}

function groupBaseOf(el: HTMLElement): string {
  return (el.getAttribute('data-sb-group') || '').replace(/-\d+$/, '');
}

function siblingLeaves(layer: HTMLElement, path: string, groupBase: string): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>('[data-sb-input]')].filter((el) => {
    if ((el.getAttribute('data-sb-input') || '') !== path) return false;
    return groupBaseOf(el) === groupBase;
  });
}

function measureInLayer(el: HTMLElement, layer: HTMLElement) {
  const er = el.getBoundingClientRect();
  const lr = layer.getBoundingClientRect();
  const sx = lr.width / DESIGN_W || 1;
  const sy = lr.height / DESIGN_H || 1;
  return {
    left: (er.left - lr.left) / sx,
    top: (er.top - lr.top) / sy,
    width: Math.max(8, el.offsetWidth || er.width / sx),
    height: Math.max(8, el.offsetHeight || er.height / sy),
  };
}

function readFontSize(el: HTMLElement, computed: CSSStyleDeclaration): string {
  const inline = el.style.fontSize?.trim();
  if (inline) return inline.includes('px') || inline.endsWith('em') ? inline : `${inline}px`;
  const px = parseFloat(computed.fontSize);
  return Number.isFinite(px) && px > 0 ? `${px}px` : computed.fontSize;
}

function copyTextStyle(el: HTMLElement, boxHeight: number): CSSProperties {
  const s = getComputedStyle(el);
  const fontSize = readFontSize(el, s);
  const fontPx = parseFloat(fontSize) || boxHeight;
  const nowrap = (s.whiteSpace || 'nowrap') === 'nowrap' || s.whiteSpace === 'pre';
  return {
    fontSize,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontStyle: s.fontStyle,
    letterSpacing: s.letterSpacing,
    lineHeight: nowrap ? `${Math.max(boxHeight, fontPx)}px` : s.lineHeight,
    color: s.color,
    textAlign: s.textAlign as CSSProperties['textAlign'],
    textShadow: s.textShadow === 'none' ? undefined : s.textShadow,
    textTransform: s.textTransform as CSSProperties['textTransform'],
    wordSpacing: s.wordSpacing,
    caretColor: s.color,
  };
}

function resolveLeaf(target: EventTarget | null, layer: HTMLElement, props: Record<string, unknown>): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : (target as Node | null)?.parentElement ?? null;
  while (el && layer.contains(el)) {
    const input = el.getAttribute('data-sb-input');
    if (input && !isDecorative(el)) return el;
    el = el.parentElement;
  }
  el = target instanceof HTMLElement ? target : null;
  while (el && layer.contains(el)) {
    if (!isDecorative(el) && isDeepestTextMatch(el, props)) return el;
    el = el.parentElement;
  }
  return null;
}

function stampInferredInputs(layer: HTMLElement, props: Record<string, unknown>) {
  for (const el of layer.querySelectorAll<HTMLElement>('*')) {
    if (el.getAttribute('data-sb-input') || isDecorative(el)) continue;
    if (!isDeepestTextMatch(el, props)) continue;
    const path = inferPathFromText(el, props);
    if (!path) continue;
    el.setAttribute('data-sb-input', path);
    el.dataset.sbInferred = '1';
  }
}

function fieldText(el: HTMLElement): string {
  return (el.innerText || el.textContent || '').replace(/\u00a0/g, ' ');
}

/**
 * Overlay a same-font/size editor on Storybit `data-sb-input` leaves (and overlay
 * copy that matches a text prop) so preview edits don't jump to a generic textarea.
 */
export function InfographicInPlaceTextEditor({ enabled, isPlaying, props, onCommit, onRequestPause }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const propsRef = useRef(props);
  propsRef.current = props;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const layer = (): HTMLElement | null => hostRef.current?.parentElement ?? null;

  const revealHidden = useCallback(() => {
    const root = layer();
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>('[data-sb-edit-hide]')) {
      el.style.visibility = '';
      delete el.dataset.sbEditHide;
    }
  }, []);

  const closeSession = useCallback((commit: boolean) => {
    const current = sessionRef.current;
    sessionRef.current = null;
    const live = fieldRef.current ? normalize(fieldText(fieldRef.current)) : current?.value;
    if (commit && current) {
      const next = normalize((live ?? current.value).replace(/\u00a0/g, ' '));
      const parts = current.lineTexts.slice();
      if (parts.length > 1) parts[current.lineIndex] = next;
      const joined = parts.length > 1 ? parts.filter(Boolean).join(' ') : next;
      if (normalize(joined) !== normalize(current.original)) {
        onCommitRef.current(current.path, joined);
      }
    }
    revealHidden();
    setSession(null);
  }, [revealHidden]);

  const startSession = useCallback((leaf: HTMLElement) => {
    const root = layer();
    if (!root) return;
    const inferred = leaf.getAttribute('data-sb-input') || inferPathFromText(leaf, propsRef.current);
    if (!inferred) return;
    const groupBase = groupBaseOf(leaf);
    const siblings = siblingLeaves(root, inferred, groupBase);
    const group = siblings.length ? siblings : [leaf];
    const lineIndex = Math.max(0, group.indexOf(leaf));
    const lineTexts = group.map((el) => normalize(el.innerText || ''));
    const box = measureInLayer(leaf, root);
    const computed = getComputedStyle(leaf);
    leaf.dataset.sbEditHide = '1';
    leaf.style.visibility = 'hidden';
    setSession({
      path: inferred,
      groupBase,
      lineIndex: lineIndex === -1 ? 0 : lineIndex,
      lineTexts,
      value: lineTexts[lineIndex] ?? normalize(leaf.innerText || ''),
      original: lineTexts.filter(Boolean).join(' '),
      box,
      style: copyTextStyle(leaf, box.height),
      nowrap: (computed.whiteSpace || 'nowrap') === 'nowrap' || computed.whiteSpace === 'pre',
    });
  }, []);

  useLayoutEffect(() => {
    const root = layer();
    if (!root || !enabled || isPlaying || sessionRef.current) return;
    stampInferredInputs(root, propsRef.current);
  });

  useEffect(() => {
    return () => {
      const current = sessionRef.current;
      sessionRef.current = null;
      const live = fieldRef.current ? fieldText(fieldRef.current) : current?.value;
      if (current && live != null && normalize(live) !== normalize(current.original)) {
        const next = normalize(live.replace(/\u00a0/g, ' '));
        const parts = current.lineTexts.slice();
        if (parts.length > 1) parts[current.lineIndex] = next;
        const joined = parts.length > 1 ? parts.filter(Boolean).join(' ') : next;
        onCommitRef.current(current.path, joined);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!session?.path) return;
    const root = layer();
    if (!root) return;
    const siblings = siblingLeaves(root, session.path, session.groupBase);
    const leaf = siblings[session.lineIndex] ?? siblings[0];
    if (leaf) {
      leaf.dataset.sbEditHide = '1';
      leaf.style.visibility = 'hidden';
    }
    const field = fieldRef.current;
    if (field) field.textContent = session.value;
    field?.focus({ preventScroll: true });
    return () => revealHidden();
  }, [revealHidden, session?.path, session?.groupBase, session?.lineIndex]);

  useEffect(() => {
    const root = layer();
    if (!root || !enabled) return;
    const onPointerDown = (event: PointerEvent) => {
      if (sessionRef.current) {
        const field = fieldRef.current;
        if (field && event.target instanceof Node && field.contains(event.target)) return;
        closeSession(true);
        return;
      }
      const leaf = resolveLeaf(event.target, root, propsRef.current);
      if (!leaf) return;
      event.preventDefault();
      event.stopPropagation();
      if (isPlaying) onRequestPause?.();
      startSession(leaf);
    };
    root.addEventListener('pointerdown', onPointerDown, true);
    return () => root.removeEventListener('pointerdown', onPointerDown, true);
  }, [closeSession, enabled, isPlaying, onRequestPause, startSession]);

  useEffect(() => {
    if (!session) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSession(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSession, session]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 z-[6]">
      <style>{`
        [data-sb-preview-edit] [data-sb-input]:not([data-sb-kind="guide"]) {
          pointer-events: auto !important;
          cursor: text;
        }
        [data-sb-preview-edit] [data-sb-edit-hide] { visibility: hidden !important; }
        [data-sb-live-edit] {
          overflow: hidden !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        [data-sb-live-edit]::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      `}</style>
      {session ? (
        <div
          ref={fieldRef}
          data-sb-live-edit=""
          role="textbox"
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          spellCheck={false}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ');
            document.execCommand('insertText', false, text);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              closeSession(true);
            }
          }}
          onBlur={() => closeSession(true)}
          className="absolute m-0 border-0 bg-transparent p-0 shadow-none outline-none"
          style={{
            left: session.box.left,
            top: session.box.top,
            minWidth: session.box.width,
            width: session.nowrap ? 'max-content' : session.box.width,
            height: session.box.height,
            minHeight: session.box.height,
            maxHeight: session.nowrap ? session.box.height : undefined,
            boxSizing: 'border-box',
            display: 'block',
            pointerEvents: 'auto',
            overflow: 'hidden',
            whiteSpace: session.nowrap ? 'nowrap' : 'pre-wrap',
            ...session.style,
          }}
        />
      ) : null}
    </div>
  );
}
