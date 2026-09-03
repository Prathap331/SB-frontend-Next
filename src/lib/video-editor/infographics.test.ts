import {
  EDITOR_FPS,
  framesToSeconds,
  isOverlayGraphicTrack,
  parseRemotionInfographic,
  readInfographicFromEditScene,
  remotionInfographicLabel,
  remotionLocalFrame,
  resolveInfographicStartSeconds,
  sceneLocalOverlayStart,
  seededTextFromOverlayItem,
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

  it('carries overlay id from id / overlay_id', () => {
    expect(parseRemotionInfographic({
      id: 'ov-123',
      animation_type: 'full_screen_title_card',
      duration_frames: 90,
    })?.overlayId).toBe('ov-123');
    expect(parseRemotionInfographic({
      overlay_id: 447,
      animation_type: 'stat_counter_overlay',
      duration_frames: 60,
    })?.overlayId).toBe('447');
  });

  it('uses start/end seconds when duration_frames is omitted', () => {
    const spec = parseRemotionInfographic({
      id: 3,
      scene_id: 's1',
      animation_type: 'icon_pop_in',
      placement: 'top_right',
      color_hint: '#F5A623',
      start: 12.4,
      end: 15.9,
    });
    expect(spec).not.toBeNull();
    expect(spec?.startSeconds).toBe(12.4);
    expect(spec?.durationFrames).toBe(Math.round(3.5 * 30));
    expect(spec?.props.color).toBe('#F5A623');
    expect(spec?.placement).toBe('top_right');
  });

  it('reads display_text + start/end from text_list items', () => {
    const spec = parseRemotionInfographic({
      id: 5,
      animation_type: 'lower_third',
      placement: 'bottom_left',
      display_text: 'Cleopatra, 51 BC',
      color_hint: '#FFFFFF',
      start: 22.1,
      end: 26.0,
    });
    expect(spec?.props.title).toBe('Cleopatra, 51 BC');
    expect(spec?.startSeconds).toBe(22.1);
    expect(spec?.durationFrames).toBe(Math.round(3.9 * 30));
  });

  it('uses startFrame/endFrame at 30fps for animation timing', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_sequence',
      icon_name: 'globe',
      startFrame: 0,
      endFrame: 368,
      start_sec: 84.5,
      end_sec: 87.5,
    });
    expect(spec?.startSeconds).toBe(0);
    expect(spec?.durationFrames).toBe(368);
  });

  it('maps array display_text onto items, not color', () => {
    const spec = parseRemotionInfographic({
      id: 3,
      animation_type: 'icon_pop_in',
      placement: 'top_right',
      display_text: ['Pataliputra', 'Magadha'],
      color_hint: '#4cc9f0',
      start: 12.4,
      end: 15.9,
    });
    expect(spec?.props.items).toEqual(['Pataliputra', 'Magadha']);
    expect(spec?.props.title).toBeUndefined();
    expect(spec?.props.color).toBe('#4cc9f0');
  });

  it('maps a single-item display_text array onto title', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_pop_in',
      display_text: ['Pataliputra'],
      color_hint: '#4cc9f0',
      start: 1,
      end: 3,
    });
    expect(spec?.props.title).toBe('Pataliputra');
    expect(spec?.props.items).toBeUndefined();
  });

  it('parses icon_name array + motion without inventing a title', () => {
    const spec = parseRemotionInfographic({
      track_id: 'anim_s2_s2_beat4',
      scene_id: 's2',
      beat_id: 's2_beat4',
      animation_type: 'icon_sequence',
      placement: 'center_left',
      display_text: null,
      color_hint: '#6F7F93',
      icon_name: ['globe', 'network', 'shield', 'x'],
      icon_layout: 'sequence',
      motion: {
        start_xy_px: [120.0, 390.0],
        end_xy_px: [120.0, 360.0],
        motion_style: 'cascading icon sequence with faint glow and connective motion',
      },
      start_sec: 84.533,
      end_sec: 87.533,
    });
    expect(spec).not.toBeNull();
    expect(spec?.props.title).toBeUndefined();
    expect(spec?.props.icons).toEqual(['globe', 'network', 'shield', 'x']);
    expect(spec?.props.iconLayout).toBe('sequence');
    expect(spec?.props.motion).toEqual({
      startX: 120,
      startY: 390,
      endX: 120,
      endY: 360,
      style: 'cascading icon sequence with faint glow and connective motion',
    });
    expect(spec?.overlayId).toBe('anim_s2_s2_beat4');
    expect(remotionInfographicLabel(spec!)).toBe('globe (+3)');
  });

  it('parses geometry_px and displayText for overlay compositions', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'lower_third',
      display_text: 'Cleopatra',
      color_hint: '#F5A623',
      geometry_px: { x: 80, y: 860, width: 640, height: 140 },
      start: 1,
      end: 3,
    });
    expect(spec?.props.geometryPx).toEqual({ x: 80, y: 860, width: 640, height: 140 });
    expect(spec?.props.displayText).toBe('Cleopatra');
    expect(spec?.props.colorHint).toBe('#F5A623');
    expect(spec?.props.title).toBe('Cleopatra');
  });

  it('does not invent a title for visual-only animation types', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'full_screen_color_wash',
      color_hint: '#111827',
      start: 0,
      end: 1,
    });
    expect(spec?.props.title).toBeUndefined();
    expect(spec?.props.colorHint).toBe('#111827');
  });

  it('parses comma-separated icon_name and does not title icon animations', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_sequence',
      icon_name: 'globe, network, shield, x',
      display_text: null,
      start: 1,
      end: 4,
    });
    expect(spec?.props.icons).toEqual(['globe', 'network', 'shield', 'x']);
    expect(spec?.props.title).toBeUndefined();
  });

  it('treats category full_frame as full_frame placement', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'full_screen_title_card',
      category: 'full_frame',
      placement: 'center',
      display_text: 'The Hidden Ones',
      color_hint: '#E8C547',
      start: 0,
      end: 3,
    });
    expect(spec?.placement).toBe('full_frame');
    expect(spec?.props.color).toBe('#E8C547');
    expect(spec?.props.title).toBe('The Hidden Ones');
  });

  it('does not seed overlay_graphic icon tracks as text', () => {
    expect(
      seededTextFromOverlayItem({
        type: 'animation',
        category: 'overlay_graphic',
        animation_type: 'icon_sequence',
        icon_name: ['globe'],
        display_text: null,
        start_sec: 1,
        end_sec: 3,
      }),
    ).toBeNull();
  });

  it('attaches remotion onto text_list items so they animate like infographics', () => {
    const seeded = seededTextFromOverlayItem({
      id: 5,
      animation_type: 'lower_third',
      placement: 'bottom_left',
      display_text: ['Cleopatra', '51 BC'],
      color_hint: '#FFFFFF',
      motion: {
        start_xy_px: [80, 900],
        end_xy_px: [80, 860],
        motion_style: 'slide_up',
      },
      start: 22.1,
      end: 26.0,
    });
    expect(seeded?.text).toBe('Cleopatra · 51 BC');
    expect(seeded?.remotion?.animationType).toBe('lower_third');
    expect(seeded?.remotion?.props.items).toEqual(['Cleopatra', '51 BC']);
    expect(seeded?.remotion?.props.motion).toMatchObject({ startX: 80, endY: 860, style: 'slide_up' });
  });

  it('rebases project-absolute overlay times onto the scene timeline', () => {
    expect(sceneLocalOverlayStart(84.533, 70, 30)).toBeCloseTo(14.533, 3);
    expect(sceneLocalOverlayStart(12.4, 70, 30)).toBe(12.4);
    expect(sceneLocalOverlayStart(12.4, 0, 40)).toBe(12.4);
    expect(sceneLocalOverlayStart(73.36, 73.36, 30)).toBeCloseTo(0, 5);
    expect(sceneLocalOverlayStart(73.36 + 5, 73.36, 30)).toBeCloseTo(5, 5);
  });

  it('recognizes overlay_graphic animation tracks', () => {
    expect(
      isOverlayGraphicTrack({
        type: 'animation',
        category: 'overlay_graphic',
        animation_type: 'icon_sequence',
        layer: 'foreground',
        icon_name: ['globe'],
      }),
    ).toBe(true);
    expect(
      isOverlayGraphicTrack({
        type: 'animation',
        category: 'transition',
        layer: 'background',
        animation_type: 'ken_burns',
        beat_id: 's1_b1',
      }),
    ).toBe(false);
  });

  it('keeps icon_name and display_text together on infographics', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_sequence',
      icon_name: ['brain-circuit', 'globe', 'shield'],
      display_text: 'Hidden network',
      color_hint: '#6F7F93',
      start: 1,
      end: 4,
    });
    expect(spec?.props.icons).toEqual(['brain-circuit', 'globe', 'shield']);
    expect(spec?.props.title).toBe('Hidden network');
    expect(spec?.props.color).toBe('#6F7F93');
    expect(remotionInfographicLabel(spec!)).toBe('Hidden network');
  });

  it('reads camelCase iconName from remotion props', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_sequence',
      props: { iconName: ['brain-circuit', 'globe'] },
      display_text: 'Hidden network',
      start: 1,
      end: 4,
    });
    expect(spec?.props.icons).toEqual(['brain-circuit', 'globe']);
    expect(remotionInfographicLabel(spec!)).toBe('Hidden network');
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
