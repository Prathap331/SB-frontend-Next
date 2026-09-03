/* eslint-disable no-undef -- Jest globals */
import { textEntrance } from './animation';

const FPS = 30;

describe('backend text_animation_style in Remotion', () => {
  it('ignores a missing or unknown style so layouts keep their own motion', () => {
    expect(textEntrance(undefined, 0, FPS)).toBeNull();
    expect(textEntrance('', 0, FPS)).toBeNull();
    expect(textEntrance('not_a_style', 0, FPS)).toBeNull();
  });

  it('fades in over the same 0.5s the preview CSS uses', () => {
    expect(textEntrance('fade_in', 0, FPS)?.opacity).toBe(0);
    expect(textEntrance('fade_in', 15, FPS)?.opacity).toBe(1);
    expect(textEntrance('fade_in', 60, FPS)?.opacity).toBe(1);
  });

  it('slides in from the left and settles at the layout position', () => {
    const start = textEntrance('slide_in_left', 0, FPS)!;
    const end = textEntrance('slide_in_left', 15, FPS)!;
    expect(start.translateX).toBeLessThan(0);
    expect(start.opacity).toBe(0);
    expect(end.translateX).toBeCloseTo(0);
    expect(end.opacity).toBe(1);
  });

  it('slides in from the right, up and down on the matching axis', () => {
    expect(textEntrance('slide_in_right', 0, FPS)!.translateX).toBeGreaterThan(0);
    expect(textEntrance('slide_up', 0, FPS)!.translateY).toBeGreaterThan(0);
    expect(textEntrance('slide_down', 0, FPS)!.translateY).toBeLessThan(0);
  });

  it('zooms and pops from a smaller scale back to 1', () => {
    expect(textEntrance('zoom_in', 0, FPS)!.scale).toBeCloseTo(0.55);
    expect(textEntrance('zoom_in', 14, FPS)!.scale).toBeCloseTo(1);
    expect(textEntrance('pop', 0, FPS)!.scale).toBeCloseTo(0.5);
    expect(textEntrance('pop', 9, FPS)!.scale).toBeCloseTo(1);
  });

  it('overshoots then settles for bounce', () => {
    const mid = textEntrance('bounce', 9, FPS)!.scale;
    expect(mid).toBeGreaterThan(1);
    expect(textEntrance('bounce', 18, FPS)!.scale).toBeCloseTo(1);
  });

  it('reveals typewriter and wipe left to right via clip-path', () => {
    expect(textEntrance('typewriter', 0, FPS)!.clipPath).toBe('inset(0 100% 0 0)');
    expect(textEntrance('typewriter', 27, FPS)!.clipPath).toBe('inset(0 0% 0 0)');
    expect(textEntrance('wipe', 0, FPS)!.clipPath).toBe('inset(0 100% 0 0)');
    expect(textEntrance('wipe', 21, FPS)!.clipPath).toBe('inset(0 0% 0 0)');
  });

  it('accepts the hyphenated spelling of a style', () => {
    expect(textEntrance('slide-in-left', 0, FPS)?.translateX).toBeLessThan(0);
  });
});
