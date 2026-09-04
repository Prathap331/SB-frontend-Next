import {
  EDITOR_FPS,
  buildBeatAnimationUpdate,
  collectSceneGraphicsOverlays,
  enrichRemotionFromSpecs,
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
import { remotionPayloadFromSpec } from './infographics';
import { clipRemotionToInfographicData, specToInfographicData } from '@/remotion/data';

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

  it('keeps icon_pop_in display_text, icon, placement, and geometry', () => {
    const spec = parseRemotionInfographic({
      track_id: 'anim_s1_s1_beat1',
      scene_id: 's1',
      beat_id: 's1_beat1',
      type: 'animation',
      layer: 'foreground',
      animation_type: 'icon_pop_in',
      category: 'overlay_graphic',
      placement: 'top_right',
      geometry_px: { x: 1696, y: 64, width: 160, height: 160 },
      motion: {
        start_xy_px: [1696.0, 44.0],
        end_xy_px: [1696.0, 64.0],
        motion_style: 'pop-in with slight bounce, scale 80% to 100%',
      },
      icon_name: 'arrow-right',
      icon_layout: null,
      display_text: 'Show a cinema exterior',
      color_hint: '#F5A623',
      startFrame: 0,
      endFrame: 90,
      start_sec: 0.0,
      end_sec: 3.0,
      duration_frames: 90,
    });
    expect(spec).not.toBeNull();
    expect(spec?.placement).toBe('top_right');
    expect(spec?.props.placement).toBe('top_right');
    expect(spec?.props.icon_name).toBe('arrow-right');
    expect(spec?.props.displayText).toBe('Show a cinema exterior');
    expect(spec?.props.title).toBe('Show a cinema exterior');
    expect(spec?.props.geometryPx).toEqual({ x: 1696, y: 64, width: 160, height: 160 });
    expect(spec?.props.motion).toEqual({
      startX: 1696,
      startY: 44,
      endX: 1696,
      endY: 64,
      style: 'pop-in with slight bounce, scale 80% to 100%',
    });
    expect(spec?.props.color).toBe('#F5A623');
    expect(spec?.startSeconds).toBe(0);
    expect(spec?.durationFrames).toBe(90);
    expect(remotionInfographicLabel(spec!)).toBe('Show a cinema exterior');
    expect(isOverlayGraphicTrack({
      animation_type: 'icon_pop_in',
      category: 'overlay_graphic',
    })).toBe(true);
  });

  it('recovers icon_name from content_binding fallback_icon', () => {
    const spec = parseRemotionInfographic({
      animation_type: 'icon_pop_in',
      placement: 'top_right',
      display_text: 'Show a cinema exterior',
      content_binding: 'fallback_icon:arrow-right',
      startFrame: 0,
      endFrame: 90,
    });
    expect(spec?.props.icon_name).toBe('arrow-right');
    expect(spec?.props.icons).toEqual(['arrow-right']);
  });

  it('keeps icon_name from the timeline track when the list item omitted it', () => {
    const map = collectSceneGraphicsOverlays(
      [
        {
          id: 'anim_s3',
          scene_id: 's3',
          beat_id: 's3_beat1',
          animation_type: 'icon_sequence',
          display_text: ['dead child', 'living world', 'reckoning'],
          startFrame: 0,
          endFrame: 210,
        },
      ],
      [
        {
          track_id: 'anim_s3',
          scene_id: 's3',
          beat_id: 's3_beat1',
          animation_type: 'icon_sequence',
          category: 'overlay_graphic',
          icon_name: ['heart', 'users', 'sparkles'],
          display_text: ['dead child', 'living world', 'reckoning'],
          startFrame: 0,
          endFrame: 210,
        },
      ],
    );
    expect(map.s3?.[0]?.props.icon_name).toEqual(['heart', 'users', 'sparkles']);
    expect(map.s3?.[0]?.props.icons).toEqual(['heart', 'users', 'sparkles']);
  });

  it('copies library icon_name onto a timeline remotion payload that dropped it', () => {
    const spec = parseRemotionInfographic({
      track_id: 'anim_s3',
      animation_type: 'icon_sequence',
      icon_name: ['heart', 'users', 'sparkles'],
      display_text: ['dead child', 'living world', 'reckoning'],
      startFrame: 0,
      endFrame: 210,
    })!;
    const remotion = remotionPayloadFromSpec({
      ...spec,
      props: { ...spec.props, icon_name: undefined, icons: undefined, iconName: undefined },
    });
    const enriched = enrichRemotionFromSpecs(remotion, [spec], {
      overlayId: spec.overlayId,
      remotion,
    });
    expect(enriched.props.icon_name).toEqual(['heart', 'users', 'sparkles']);
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

describe('library preview and video preview parity', () => {
  const item = {
    id: 'ov-1',
    animation_type: 'callout_textbox',
    display_text: 'Follow the money',
    text_animation_style: 'slide_in_left',
    icon_name: ['coins', 'trending-up'],
    placement: 'bottom',
    color_hint: '#F5A623',
    start: 1,
    end: 4,
  };

  it('carries text_animation_style into the Remotion props', () => {
    const spec = parseRemotionInfographic(item);
    expect(spec?.props.textAnimationStyle).toBe('slide_in_left');
  });

  it('hands icon_name to Remotion as sent — a list stays a list', () => {
    const spec = parseRemotionInfographic(item);
    expect(spec?.props.icon_name).toEqual(['coins', 'trending-up']);
    expect(spec?.props.icons).toEqual(['coins', 'trending-up']);
  });

  it('hands a single icon_name through as a string', () => {
    const spec = parseRemotionInfographic({ ...item, icon_name: 'brain-circuit' });
    expect(spec?.props.icon_name).toBe('brain-circuit');
    expect(spec?.props.icons).toEqual(['brain-circuit']);
  });

  it('splits a comma-separated icon_name into names', () => {
    const spec = parseRemotionInfographic({ ...item, icon_name: 'globe, network, shield' });
    expect(spec?.props.icon_name).toEqual(['globe', 'network', 'shield']);
  });

  it('builds identical InfographicData for the library card and the timeline clip', () => {
    const spec = parseRemotionInfographic(item)!;
    const fromLibrary = specToInfographicData(spec);
    const fromTimelineClip = clipRemotionToInfographicData(remotionPayloadFromSpec(spec));
    expect(fromTimelineClip).toEqual(fromLibrary);
  });

  it('keeps the animation style on a seeded text overlay clip payload', () => {
    const seeded = seededTextFromOverlayItem(item);
    expect(seeded?.animationStyle).toBe('slide_in_left');
    expect(seeded?.remotion?.props.textAnimationStyle).toBe('slide_in_left');
  });
});

describe('beat animation update payload', () => {
  it('sends placement and geometry_px for a custom text clip', () => {
    const payload = buildBeatAnimationUpdate({
      id: 'txt-1',
      trackId: 'track-text',
      type: 'text',
      name: 'Hello',
      text: 'Hello',
      start: 0,
      duration: 3,
      sourceStart: 0,
      sourceDuration: 3,
      offsetX: 84,
      offsetY: 82,
      textColor: '#ffcc00',
      animationStyle: 'fade_in',
    } as never);
    expect(payload?.animation_type).toBe('fade_in');
    expect(payload?.display_text).toBe('Hello');
    expect(payload?.placement).toBe('top_right');
    expect(payload?.geometry_px).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }));
    expect(payload?.color_hint).toBe('#ffcc00');
    expect(payload?.background_color_hint).toBeNull();
  });

  it('sends background_color_hint when the text background is on', () => {
    const payload = buildBeatAnimationUpdate(
      {
        id: 'txt-2',
        trackId: 'track-text',
        type: 'text',
        name: 'Hello',
        text: 'Hello',
        start: 0,
        duration: 3,
        sourceStart: 0,
        sourceDuration: 3,
        bgColor: '#111827',
        animationStyle: 'fade_in',
      } as never,
      { background: true, bgColor: '#111827' },
    );
    expect(payload?.background_color_hint).toBe('#111827');
  });

  it('sends display_text and placement for an infographic clip', () => {
    const payload = buildBeatAnimationUpdate({
      id: 'info-1',
      trackId: 'track-infographic',
      type: 'infographic',
      name: 'Network',
      text: 'Network',
      start: 0,
      duration: 4,
      sourceStart: 0,
      sourceDuration: 4,
      placement: 'top_right',
      remotion: {
        compositionId: 'IconPop',
        animationType: 'icon_pop_in',
        durationFrames: 120,
        trigger: 'scene_start',
        placement: 'top_right',
        props: {
          displayText: ['Hidden', 'Network'],
          icon_name: 'globe',
          geometryPx: { x: 1696, y: 64, width: 160, height: 160 },
        },
      },
    } as never);
    expect(payload?.animation_type).toBe('icon_pop_in');
    expect(payload?.display_text).toEqual(['Hidden', 'Network']);
    expect(payload?.placement).toBe('top_right');
    expect(payload?.geometry_px).toEqual({ x: 1696, y: 64, width: 160, height: 160 });
    expect(payload?.icon_name).toBe('globe');
  });

  it('sends background_color_hint from infographic props', () => {
    const payload = buildBeatAnimationUpdate({
      id: 'info-2',
      trackId: 'track-infographic',
      type: 'infographic',
      name: 'Title',
      text: 'Title',
      start: 0,
      duration: 4,
      sourceStart: 0,
      sourceDuration: 4,
      placement: 'center',
      remotion: {
        compositionId: 'TitleCard',
        animationType: 'full_screen_title_card',
        durationFrames: 90,
        trigger: 'scene_start',
        placement: 'center',
        props: { displayText: 'Title', backgroundColorHint: '#111827' },
      },
    } as never);
    expect(payload?.background_color_hint).toBe('#111827');
  });
});
