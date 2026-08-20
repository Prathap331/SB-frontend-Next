import { resolveInfographicRenderer } from '@/remotion/registry';
import { parseRemotionInfographic } from '@/lib/video-editor/infographics';
import { specToInfographicData } from '@/remotion/data';
import { DataDrivenInfographic } from '@/remotion/compositions/DataDrivenInfographic';

describe('data-driven infographic resolver', () => {
  it('CASE 1: TitleCard by animation_type — full data object into Remotion', () => {
    const spec = parseRemotionInfographic({
      composition_id: 'TitleCard',
      animation_type: 'full_screen_title_card',
      props: { title: "Assassin's Creed Origins", subtitle: '' },
      duration_frames: 120,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });
    expect(spec).not.toBeNull();
    const data = specToInfographicData(spec!);
    const resolved = resolveInfographicRenderer(data);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.component).toBe(DataDrivenInfographic);
      expect(resolved.renderer.inputProps.data).toEqual(data);
      expect(resolved.renderer.inputProps.data.props.title).toBe("Assassin's Creed Origins");
      expect(resolved.renderer.animationType).toBe('full_screen_title_card');
    }
  });

  it('CASE 2: QuoteCard by animation_type', () => {
    const spec = parseRemotionInfographic({
      composition_id: 'QuoteCard',
      animation_type: 'full_screen_quote_card',
      props: {
        quote: 'The break comes when the revenge story finally changes shape.',
        attribution: '',
      },
      duration_frames: 120,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });
    expect(spec).not.toBeNull();
    const resolved = resolveInfographicRenderer(specToInfographicData(spec!));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.inputProps.data.props.quote).toBe(
        'The break comes when the revenge story finally changes shape.',
      );
    }
  });

  it('CASE 3: DataVizFullScreen by animation_type', () => {
    const spec = parseRemotionInfographic({
      composition_id: 'DataVizFullScreen',
      animation_type: 'full_screen_data_viz',
      props: {
        label: '2017',
        caption: 'Ubisoft Montreal, 2017 release, Ancient Egypt setting, stealth-action to RPG shift',
      },
      duration_frames: 120,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });
    expect(spec).not.toBeNull();
    const resolved = resolveInfographicRenderer(specToInfographicData(spec!));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.inputProps.data.props.label).toBe('2017');
    }
  });

  it('CASE 4: new composition_id with known animation_type still renders', () => {
    const spec = parseRemotionInfographic({
      composition_id: 'RandomNewCompositionName',
      animation_type: 'full_screen_quote_card',
      props: { quote: 'Test quote', attribution: '' },
      duration_frames: 90,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });
    expect(spec?.compositionId).toBe('RandomNewCompositionName');
    const resolved = resolveInfographicRenderer(specToInfographicData(spec!));
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.inputProps.data.composition_id).toBe('RandomNewCompositionName');
      expect(resolved.renderer.inputProps.data.props.quote).toBe('Test quote');
    }
  });

  it('CASE 5: BulletListReveal renders items from backend props', () => {
    const items = ['The Hidden Ones', 'The Curse of the Pharaohs', 'Discovery Tour'];
    const spec = parseRemotionInfographic({
      composition_id: 'BulletListReveal',
      animation_type: 'bullet_list_reveal',
      props: { title: '', items },
      duration_frames: 150,
      trigger: 'scene_start',
      placement: 'center_right',
      render_engine_hint: 'remotion',
    });
    expect(spec).not.toBeNull();
    const data = specToInfographicData(spec!);
    const resolved = resolveInfographicRenderer(data);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.inputProps.data.props.items).toEqual(items);
      expect(resolved.renderer.inputProps.data.placement).toBe('center_right');
    }
  });

  it('unknown animation_type with renderable props uses generic layout (does not fail on composition_id)', () => {
    const resolved = resolveInfographicRenderer({
      composition_id: 'SomeNewUniqueId',
      animation_type: 'brand_new_effect_v9',
      props: { title: 'Dynamic title from backend' },
      duration_frames: 90,
      trigger: 'scene_start',
      placement: 'center',
      render_engine_hint: 'remotion',
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.renderer.layout).toBe('generic');
      expect(resolved.renderer.inputProps.data.props.title).toBe('Dynamic title from backend');
    }
  });

  it('unknown animation_type with empty props returns safe unsupported result', () => {
    const resolved = resolveInfographicRenderer({
      composition_id: 'EmptyThing',
      animation_type: 'brand_new_effect_v9',
      props: {},
      duration_frames: 90,
      trigger: 'scene_start',
      placement: 'full_frame',
      render_engine_hint: 'remotion',
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.animationType).toBe('brand_new_effect_v9');
      expect(resolved.reason).toBe('empty_props');
    }
  });
});
