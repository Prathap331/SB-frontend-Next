import {
  OVERLAY_DESIGN_W,
  OVERLAY_DESIGN_H,
  geometryPxFromPreviewOffsets,
  isRightPlacement,
  placementFromPreviewOffsets,
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

  it('maps preview offsets onto backend placement names', () => {
    expect(placementFromPreviewOffsets(50, 12)).toBe('bottom');
    expect(placementFromPreviewOffsets(84, 82)).toBe('top_right');
    expect(placementFromPreviewOffsets(16, 50)).toBe('center_left');
    expect(placementFromPreviewOffsets(50, 50)).toBe('center');
  });

  it('converts centered preview offsets into 1920×1080 geometry_px', () => {
    const geo = geometryPxFromPreviewOffsets(50, 12, 520, 160);
    expect(geo.width).toBe(520);
    expect(geo.height).toBe(160);
    expect(geo.x).toBe(Math.round(OVERLAY_DESIGN_W / 2 - 260));
    expect(geo.y).toBe(Math.round(OVERLAY_DESIGN_H - 0.12 * OVERLAY_DESIGN_H - 160));
  });
});
