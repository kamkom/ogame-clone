/**
 * The Structures screen's boxes, in px inside the content area (right of the rail, below the top
 * bar). design/screens/structures.html places them in stage coordinates: heading and grid at
 * x 112 (the rail + 24), 948 wide; the 340-wide detail panel 24 from the right edge. The design
 * tokens --content-left/--content-top are those stage coordinates, so they must not be used
 * inside the content area again.
 */
export interface Box {
  left?: number;
  right: number;
  top: number;
  bottom?: number;
  width?: number;
}

/** Where the content area starts on the stage: --rail-w, --topbar-h. */
export const CONTENT_ORIGIN = { left: 88, top: 72 };

const GUTTER = 24;
const PANEL_W = 340;
/** Space the main column leaves on its right: the panel, its edge gutter and a 16 px gap. */
const MAIN_RIGHT = PANEL_W + GUTTER + 16;

export const STRUCTURES_LAYOUT = {
  heading: { left: GUTTER, top: GUTTER, right: MAIN_RIGHT },
  grid: { left: GUTTER, top: 104, right: MAIN_RIGHT, bottom: GUTTER },
  panel: { right: GUTTER, top: GUTTER, bottom: GUTTER, width: PANEL_W },
} satisfies Record<string, Box>;

/** A box's left/top/width/bottom on a stage of the given size. */
export function toStage(box: Box, stage: { w: number; h: number }) {
  const contentW = stage.w - CONTENT_ORIGIN.left;
  const contentH = stage.h - CONTENT_ORIGIN.top;
  const width = box.width ?? contentW - (box.left ?? 0) - box.right;
  const left = box.left ?? contentW - box.right - width;
  return {
    left: CONTENT_ORIGIN.left + left,
    top: CONTENT_ORIGIN.top + box.top,
    width,
    bottom: box.bottom === undefined ? null : CONTENT_ORIGIN.top + contentH - box.bottom,
  };
}
