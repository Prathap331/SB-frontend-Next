import {
  EDITOR_FPS,
  framesToSeconds,
  parseRemotionInfographic,
  readInfographicFromEditScene,
  remotionLocalFrame,
  resolveInfographicStartSeconds,
} from './infographics';

describe('remotion infographic timing', () => {
  it('treats duration_frames as frames at EDITOR_FPS', () => {
    expect(EDITOR_FPS).toBe(30);
    expect(framesToSeconds(120, 30)).toBe(4);
  });

  it('places scene_start at the scene start time', () => {
    expect(resolveInfographicStartSeconds('scene_start', 5)).toBe(5);
    expect(resolveInfographicStartSeconds('scene_start', 0)).toBe(0);
  });

  it('maps editor currentTime to local Remotion frames (not global*fps)', () => {
    const start = 5;
    const durationFrames = 120;
    const fps = 30;

    expect(remotionLocalFrame(5.0, start, durationFrames, fps)).toBe(0);
    expect(remotionLocalFrame(5.5, start, durationFrames, fps)).toBe(15);
    expect(remotionLocalFrame(6.0, start, durationFrames, fps)).toBe(30);
    expect(remotionLocalFrame(7.0, start, durationFrames, fps)).toBe(60);
    expect(remotionLocalFrame(8.0, start, durationFrames, fps)).toBe(90);
    expect(remotionLocalFrame(9.0, start, durationFrames, fps)).toBe(119);
  });

  it('parses the backend TitleCard payload safely', () => {
    const spec = parseRemotionInfographic({
      composition_id: 'TitleCard',
      animation_type: 'full_screen_title_card',
      props: {
        title: "Assassin's Creed Origins",
        subtitle: '',
      },
      duration_frames: 120,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });

    expect(spec).not.toBeNull();
    expect(spec?.compositionId).toBe('TitleCard');
    expect(spec?.durationFrames).toBe(120);
    expect(spec?.props.title).toBe("Assassin's Creed Origins");
    expect(framesToSeconds(spec!.durationFrames)).toBe(4);

    const start = resolveInfographicStartSeconds(spec!.trigger, 5);
    expect(start).toBe(5);
    expect(start + framesToSeconds(spec!.durationFrames)).toBe(9);
  });

  it('rejects invalid duration_frames without throwing', () => {
    expect(parseRemotionInfographic({ composition_id: 'TitleCard', duration_frames: 0 })).toBeNull();
    expect(parseRemotionInfographic({ composition_id: 'TitleCard', duration_frames: -1 })).toBeNull();
    expect(parseRemotionInfographic(null)).toBeNull();
  });

  it('hides section when backend sets infographics: null', () => {
    expect(
      readInfographicFromEditScene({
        infographics: null,
        animation: { animation_type: 'lower_third', duration_frames: 90 },
      }),
    ).toBeNull();
  });
});
