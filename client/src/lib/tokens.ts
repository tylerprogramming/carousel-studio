/**
 * Design tokens for the places that genuinely need JavaScript values.
 *
 * App chrome should use Tailwind classes (`bg-brand`, `text-muted-foreground`,
 * …) — those resolve to the CSS variables in index.css. This module exists for
 * the two cases Tailwind can't express:
 *
 *   1. SlidePreview, which renders at an arbitrary `scale` and therefore needs
 *      computed pixel values rather than fixed utility classes.
 *   2. Platform mockups (Instagram / LinkedIn / TikTok chrome), which reproduce
 *      other companies' brand colours and shouldn't leak into the theme.
 *
 * Nothing here should be a colour that already exists as a CSS variable.
 */

/**
 * App chrome palette.
 *
 * These mirror the CSS variables in index.css and the Tailwind `brand`/`tiktok`
 * colours. Prefer Tailwind classes in new code; these exist because several
 * panels build inline style objects, and until those are converted they were
 * each redeclaring the same eight hex literals — eight independent copies that
 * could drift apart. Importing from here keeps one source of truth.
 */
export const BLUE       = '#5B6CF2'
export const BLUE_LIGHT = '#EEF0FD'
export const BLUE_HOVER = '#4A59E0'
export const TEXT       = '#1C1E2E'
export const MUTED      = '#8890A4'
export const BORDER     = '#E5EAF5'
export const BG         = '#F0F4FF'
export const WHITE      = '#FFFFFF'
export const CORAL      = '#E07355'
export const TIKTOK     = '#FE2C55'
export const TIKTOK_D   = '#c4002c'

/** Brand colours belonging to the platforms we render mockups of. */
export const PLATFORM = {
  instagram: { name: 'Instagram', tint: '#DC2743' },
  linkedin:  { name: 'LinkedIn',  tint: '#0A66C2' },
  tiktok:    { name: 'TikTok',    tint: '#FE2C55' },
} as const

export type PlatformId = keyof typeof PLATFORM

/** Slide canvas geometry. Must match generate_slide.py — see the note there. */
export const CANVAS = {
  width:  1080,
  height: 1350,
  pad:    80,
  footerPad: 90,
} as const

/** Instagram's 4:5 feed ratio, used to size thumbnails and phone mockups. */
export const ASPECT = CANVAS.height / CANVAS.width

/**
 * TikTok safe area. The 4:5 slide is inset inside the 9:16 frame rather than
 * cropped to fill it, clear of the caption block, action rail and tab chrome.
 *
 * These mirror the defaults in tiktok_safe.py. Change them together or the
 * preview stops matching the exported set.
 */
export const TIKTOK_SAFE = {
  /** Side margin as a fraction of frame width. 0: a 4:5 slide fills the width
   *  the way a feed photo does. Mirrors the default in tiktok_safe.py — these
   *  two are the preview and the export of the same framing, so they move
   *  together or the preview stops being a preview. */
  margin: 0,
  /** <0.5 pushes content up, away from the caption */
  topBias: 0.38,
} as const
