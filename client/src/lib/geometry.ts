import { Slide } from '../types'

/**
 * The slide geometry table — the TypeScript half of the renderer parity
 * contract.
 *
 * This lives in its own module rather than inside SlidePreview.tsx so it can be
 * imported without pulling in React, which is what lets tests/geometry-parity
 * diff it against terminal_geometry() in generate_slide.py on every commit.
 * Before that, "these two tables agree" was a claim in the README with nothing
 * checking it.
 *
 * SlidePreview.tsx re-exports everything here, so existing imports still work.
 */

/**
 * TikTok's own UI, in the 1080x1920 frame's coordinates. The same measurements
 * generate_slide.py builds the tall geometry from. They are keep-out zones, not
 * padding: the background still fills the whole frame, nothing readable sits
 * under them.
 */
export const TALL_SAFE = { top: 130, right: 150, bottom: 340 } as const

/**
 * Every number that differs between the 4:5 terminal slide and its 9:16 twin.
 * This is a copy of terminal_geometry() in generate_slide.py, field for field —
 * that function is the specification and this table has to follow it.
 *
 * `floor` is the bottom of the usable frame. On a 4:5 slide that is the canvas
 * bottom; on a tall slide it is the top of TikTok's caption block. Everything
 * anchored to the bottom hangs off it, so the same offsets that place the
 * footer and the terminal window at 4:5 place them at 9:16.
 */
export function terminalGeometry(tall: boolean) {
  return tall
    ? {
        width: 1080, height: 1920,
        padx: 84,
        right: 1080 - TALL_SAFE.right,   // stop short of TikTok's action rail
        railY: 160,          // below the status bar and the tab chrome
        top: 300,            // the headline gets the top third to itself
        winTop: 900,
        winGap: 56,          // minimum air between the text above and the window
        bodyTop: 980,
        floor: 1920 - TALL_SAFE.bottom,  // top of TikTok's caption block
      }
    : {
        width: 1080, height: 1350,
        padx: 84,
        right: 1080 - 84,
        railY: 74,
        top: 200,
        winTop: 700,
        winGap: 40,
        bodyTop: 720,
        floor: 1350,
      }
}

/**
 * Canvas aspect for any slide. Thumbnails, phone mockups and the slide strip
 * size their boxes with this instead of hardcoding 1350/1080, which crops a
 * tall slide's bottom third without saying so.
 */
export function slideAspect(slide: Pick<Slide, 'variant'>) {
  const g = terminalGeometry(slide.variant === 'tall')
  return g.height / g.width
}
