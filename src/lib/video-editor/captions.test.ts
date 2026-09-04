/** @jest-environment node */
import {
  captionStyleForScene,
  captionTextAtTime,
  captionWordsFromTrack,
  captionWordsForScene,
  parseCaptionStyle,
} from './captions';

/* eslint-disable no-undef -- Jest globals */

describe('caption word timing', () => {
  test('converts scene-local startFrame/endFrame to seconds', () => {
    const words = captionWordsFromTrack(
      {
        type: 'caption_word',
        scene_id: 's1',
        words: [
          { word: 'Hello', startFrame: 15, endFrame: 30 },
          { word: 'world', startFrame: 30, endFrame: 48 },
        ],
      },
      30,
      { type: 'audio', scene_id: 's1', startFrame: 0, scene_start_sec: 0 },
      10,
    );
    expect(words).toEqual([
      { word: 'Hello', start: 0.5, end: 1 },
      { word: 'world', start: 1, end: 1.6 },
    ]);
  });

  test('rebases absolute frames using the audio track origin', () => {
    const words = captionWordsFromTrack(
      {
        type: 'caption_word',
        scene_id: 's2',
        words: [
          { word: 'Later', startFrame: 1215, endFrame: 1230 },
        ],
      },
      30,
      { type: 'audio', scene_id: 's2', startFrame: 1200, start_sec: 40, scene_start_sec: 0 },
      12,
    );
    expect(words[0]).toEqual({ word: 'Later', start: 0.5, end: 1 });
  });

  test('prefers caption_word frames over word_segments fallback', () => {
    const words = captionWordsForScene({
      sceneId: 's1',
      fps: 30,
      sceneDuration: 8,
      tracks: [
        {
          type: 'caption_word',
          scene_id: 's1',
          words: [{ word: 'Frame', startFrame: 0, endFrame: 30 }],
        },
      ],
      fallbackWords: [{ word: 'Seconds', start: 2, end: 3 }],
    });
    expect(words).toEqual([{ word: 'Frame', start: 0, end: 1 }]);
  });
});

describe('caption style + on-screen text', () => {
  test('maps position percents onto preview offsets', () => {
    const style = parseCaptionStyle({
      vertical_position: 'bottom',
      margin_bottom_percent: 18,
      horizontal_position: 'center',
      margin_horizontal_percent: 50,
      font_size: 42,
      text_color: '#ffe600',
      outline_color: '#111111',
      animation_type: 'kinetic_caption',
    });
    expect(style.offsetY).toBe(18);
    expect(style.offsetX).toBe(50);
    expect(style.fontSize).toBe(42);
    expect(style.animationType).toBe('kinetic_caption');
    expect(style.backgroundColor).toBeNull();
  });

  test('parses caption background_color', () => {
    const style = parseCaptionStyle({
      background_color: '#112233',
      animation_type: 'word_pop',
    });
    expect(style.backgroundColor).toBe('#112233');
  });

  test('right-aligned captions measure margin from the right edge', () => {
    const style = parseCaptionStyle({
      horizontal_position: 'right',
      margin_horizontal_percent: 10,
      vertical_position: 'top',
    });
    expect(style.offsetX).toBe(90);
    expect(style.offsetY).toBe(82);
  });

  test('reads style from the caption_word track', () => {
    const style = captionStyleForScene({
      sceneId: 's1',
      tracks: [
        {
          type: 'caption_word',
          scene_id: 's1',
          style: { vertical_position: 'middle', margin_bottom_percent: 40, animation_type: 'static_line' },
        },
      ],
    });
    expect(style.offsetY).toBe(40);
    expect(style.animationType).toBe('static_line');
  });

  test('kinetic captions show the current word', () => {
    const words = [
      { word: 'One', start: 0, end: 0.4 },
      { word: 'Two', start: 0.4, end: 0.8 },
    ];
    expect(captionTextAtTime(words, 'kinetic_caption', 0.5)).toBe('Two');
    expect(captionTextAtTime(words, 'static_line', 0.5)).toBe('One Two');
  });
});
