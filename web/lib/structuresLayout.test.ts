import { CONTENT_ORIGIN, STRUCTURES_LAYOUT, toStage } from './structuresLayout.ts';

// design/screens/structures.html, in the 1440×900 stage's coordinates.
const STAGE = { w: 1440, h: 900 };

describe('Structures layout', () => {
  it('boxes sit inside the content area, which starts at the rail and the top bar', () => {
    expect(CONTENT_ORIGIN).toEqual({ left: 88, top: 72 });
  });

  it('puts the heading row at the design position (112, 96), 948 wide', () => {
    const b = toStage(STRUCTURES_LAYOUT.heading, STAGE);
    expect(b.left).toBe(112);
    expect(b.top).toBe(96);
    expect(b.width).toBe(948);
  });

  it('puts the card grid at the design position (112, 176), 948 wide', () => {
    const b = toStage(STRUCTURES_LAYOUT.grid, STAGE);
    expect(b.left).toBe(112);
    expect(b.top).toBe(176);
    expect(b.width).toBe(948);
    expect(b.bottom).toBe(876);
  });

  it('puts the detail panel 24 px from the right edge at y 96, 340 × 780', () => {
    const b = toStage(STRUCTURES_LAYOUT.panel, STAGE);
    expect(b.left).toBe(1440 - 24 - 340);
    expect(b.top).toBe(96);
    expect(b.width).toBe(340);
    expect(b.bottom).toBe(96 + 780);
  });

  it('keeps the grid and heading clear of the panel', () => {
    const panel = toStage(STRUCTURES_LAYOUT.panel, STAGE);
    for (const box of [STRUCTURES_LAYOUT.heading, STRUCTURES_LAYOUT.grid]) {
      const b = toStage(box, STAGE);
      expect(b.left + b.width).toBeLessThanOrEqual(panel.left - 16);
    }
  });
});
