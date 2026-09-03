import {
  OVERLAY_DESIGN_W,
  isRightPlacement,
  placementToDesignPx,
  resolveOverlayGeometry,
} from './placement';

describe('overlay placement + geometry', () => {
  it('maps top_right + 160×160 onto the backend 1920×1080 corner', () => {
    expect(placementToDesignPx('top_right', 160, 160)).toEqual({ x: 1696, y: 64 });
    expect(OVERLAY_DESIGN_W - 160 - 64).toBe(1696);
  });

  it('keeps explicit geometry_px when both x and y are present', () => {
    expect(
      resolveOverlayGeometry(
        { x: 1696, y: 64, width: 160, height: 160 },
        'top_right',
        { x: 64, y: 360, width: 160, height: 160 },
      ),
    ).toEqual({ x: 1696, y: 64, width: 160, height: 160 });
  });

  it('fills missing x/y from placement so icon_pop_in still lands top-right', () => {
    expect(
      resolveOverlayGeometry({ width: 160, height: 160 }, 'top_right', {
        x: 64,
        y: 360,
        width: 160,
        height: 160,
      }),
    ).toEqual({ x: 1696, y: 64, width: 160, height: 160 });
  });

  it('treats top_right as a right-growing placement', () => {
    expect(isRightPlacement('top_right')).toBe(true);
    expect(isRightPlacement('top_left')).toBe(false);
  });
});
