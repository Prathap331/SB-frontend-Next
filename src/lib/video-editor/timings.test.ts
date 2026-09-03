import { audioWindowSeconds, frameWindowSeconds, toSceneLocalSeconds } from './timings';
import { EDITOR_FPS } from './fps';

describe('track timing windows', () => {
  it('reads audio start_sec / end_sec as seconds', () => {
    expect(
      audioWindowSeconds({
        type: 'audio',
        start_sec: 0.0,
        end_sec: 28.766666666666666,
      }),
    ).toEqual({
      start: 0,
      end: 28.766666666666666,
      duration: 28.766666666666666,
    });
  });

  it('converts b-roll / animation startFrame / endFrame at 30fps', () => {
    expect(
      frameWindowSeconds({
        type: 'broll',
        startFrame: 0,
        endFrame: 368,
      }),
    ).toEqual({
      start: 0,
      end: 368 / EDITOR_FPS,
      duration: 368 / EDITOR_FPS,
    });
  });

  it('rebases scene 2 project time onto a 0-based scene timeline', () => {
    expect(toSceneLocalSeconds(73.36, 73.36)).toBeCloseTo(0, 5);
    expect(toSceneLocalSeconds(73.36 + 12.2666, 73.36)).toBeCloseTo(12.2666, 3);
    expect(toSceneLocalSeconds(0, 73.36)).toBe(0);
    const win = frameWindowSeconds({
      startFrame: Math.round(73.36 * 30),
      endFrame: Math.round(73.36 * 30) + 368,
    });
    expect(win).not.toBeNull();
    expect(toSceneLocalSeconds(win!.start, 73.36)).toBeCloseTo(0, 1);
  });
});
