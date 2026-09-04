/* eslint-disable no-undef -- Jest globals */
import { brollDisplayName, clipMediaKind, firstKeyword } from './mediaNames';

describe('b-roll display names', () => {
  it('never falls back to a beat id', () => {
    expect(brollDisplayName({ mediaKind: 'video', index: 0 })).toBe('Video 1');
    expect(brollDisplayName({ mediaKind: 'image', index: 2 })).toBe('Image 3');
    expect(brollDisplayName({})).toBe('Video 1');
  });

  it('uses the first keyword, capitalized', () => {
    expect(brollDisplayName({ keywords: ['city skyline', 'dusk'] })).toBe('City skyline');
    expect(brollDisplayName({ keywords: 'courtroom' })).toBe('Courtroom');
  });

  it('prefers an explicit name or title over keywords', () => {
    expect(brollDisplayName({ name: 'Opening shot', keywords: ['city'] })).toBe('Opening shot');
    expect(brollDisplayName({ title: 'Aerial pan', keywords: ['city'] })).toBe('Aerial pan');
  });

  it('skips blank keyword entries', () => {
    expect(firstKeyword(['', '   ', 'harbour'])).toBe('harbour');
    expect(firstKeyword([])).toBe('');
    expect(firstKeyword(undefined)).toBe('');
    expect(brollDisplayName({ keywords: ['', ' '], mediaKind: 'image', index: 0 })).toBe('Image 1');
  });
});

describe('clip media kind', () => {
  it('trusts an explicit mediaKind', () => {
    expect(clipMediaKind({ mediaKind: 'image', sourceUrl: 'https://x/y.mp4' })).toBe('image');
    expect(clipMediaKind({ mediaKind: 'video', sourceUrl: 'https://x/y.png' })).toBe('video');
  });

  it('falls back to the URL, defaulting to video', () => {
    expect(clipMediaKind({ sourceUrl: 'https://x/photo.jpg?auto=compress' })).toBe('image');
    expect(clipMediaKind({ sourceUrl: 'https://images.pexels.com/photos/123/x' })).toBe('image');
    expect(clipMediaKind({ sourceUrl: 'https://videos.pexels.com/video-files/1/a.mp4' })).toBe('video');
    expect(clipMediaKind({})).toBe('video');
    expect(clipMediaKind(null)).toBe('video');
  });
});
