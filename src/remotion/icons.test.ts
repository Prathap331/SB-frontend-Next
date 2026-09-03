import { resolveLucideIcon } from './icons';
import { readIconNames, readTextAnimationStyle } from './props';
import { Circle } from 'lucide-react';

describe('backend lucide icon library', () => {
  it('resolves kebab-case names from the edit-video icon groups', () => {
    const names = [
      'arrow-right',
      'brain-circuit',
      'heart-handshake',
      'users-round',
      'building-2',
      'fingerprint-pattern',
      'chart-column',
      'dollar-sign',
      'flask-conical',
      'map-pin',
      'moon-star',
      'alert-triangle',
      'graduation-cap',
      'message-circle',
      'infinity',
      'globe',
    ];
    for (const name of names) {
      expect(resolveLucideIcon(name)).not.toBe(Circle);
    }
  });

  it('falls back to Circle for unknown names', () => {
    expect(resolveLucideIcon('not-a-real-icon')).toBe(Circle);
  });

  it('reads iconName / icon_name / comma lists from remotion props', () => {
    expect(readIconNames({ iconName: ['globe', 'shield'] })).toEqual(['globe', 'shield']);
    expect(readIconNames({ icon_name: 'brain-circuit' })).toEqual(['brain-circuit']);
    expect(readIconNames({ icons: 'globe, network, x' })).toEqual(['globe', 'network', 'x']);
  });

  it('reads a multi-name icon_name array straight off the props', () => {
    expect(readIconNames({ icon_name: ['coins', 'trending-up', 'wallet'] })).toEqual([
      'coins',
      'trending-up',
      'wallet',
    ]);
  });

  it('prefers icon_name over icons when both are present', () => {
    expect(readIconNames({ icon_name: ['globe'], icons: ['shield'] })).toEqual(['globe']);
  });

  it('reads the backend text animation style under either key', () => {
    expect(readTextAnimationStyle({ textAnimationStyle: 'typewriter' })).toBe('typewriter');
    expect(readTextAnimationStyle({ text_animation_style: 'slide_up' })).toBe('slide_up');
    expect(readTextAnimationStyle({})).toBeUndefined();
  });
});
