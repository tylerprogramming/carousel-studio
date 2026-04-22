export type SlideType = 'cover' | 'content' | 'cta'

export interface Slide {
  id: string
  type: SlideType
  slideNumber: number
  stepNumber?: number
  headline: string
  emphasisLine: string
  bodyText: string
  bgColor: string
  textColor: string
  accentColor: string
  backgroundImage?: string  // URL like /files/bg_slide1.png
  backgroundVideo?: string  // URL like /files/bg_slide1.mp4 — auto-plays looped muted
  overlayOpacity?: number   // 0–1, default 0.45
  overlayColor?: string     // '#000000' or '#ffffff'
  bgPanX?: number           // background image horizontal pan: -100 (left) to +100 (right), default 0
  bgPanY?: number           // background image vertical pan: -100 (top) to +100 (bottom), default 0
  textScale?: number        // font size multiplier, default 1.0
  footerColor?: string      // color of SAVE FOR LATER / SWIPE text, default '#FFFFFF'
  bodyTextColor?: string    // explicit override for body text color (falls back to auto-computed blend)
  insetImageUrl?: string    // URL like /files/foo.png or /files/foo.mp4
  insetBorderColor?: string // default '#FFFFFF'
  insetBorderWidth?: number // px, default 4
  insetHeightPct?: number   // % of slide height, default 38
  insetPosition?: 'top' | 'bottom'  // default 'bottom'
  insetPadding?: number     // px padding from edges, default 0 (full width)
  insetZoom?: number        // crop scale for inset media: 1.0 = max visible, 5.0 = tight crop (default 1.0)
  insetVerticalOffset?: number // px nudge from edge (positive = further from edge), default 0
  insetPanX?: number        // horizontal pan: -100 (left) to +100 (right), default 0
  insetPanY?: number        // vertical pan: -100 (up) to +100 (down), default 0
}

export interface CarouselConfig {
  title: string
  platform: 'instagram' | 'linkedin' | 'tiktok'
  slides: Slide[]
}

export const BG_COLORS = [
  { name: 'Forest', value: '#1B4332' },
  { name: 'Coral',  value: '#E07355' },
  { name: 'Sage',   value: '#74A58A' },
  { name: 'Sand',   value: '#C9B99A' },
  { name: 'White',  value: '#FFFFFF' },
  { name: 'Dark',   value: '#1A1A2E' },
  { name: 'Cream',  value: '#F5F0EB' },
  { name: 'Sky',    value: '#5BA4CF' },
]

export const TEXT_COLORS = [
  { name: 'Dark',   value: '#1B1B1B' },
  { name: 'Cream',  value: '#F5F0EB' },
  { name: 'Forest', value: '#1B4332' },
  { name: 'Coral',  value: '#E07355' },
]

export const ACCENT_COLORS = [
  { name: 'Coral',  value: '#E07355' },
  { name: 'Forest', value: '#1B4332' },
  { name: 'Gold',   value: '#F4A261' },
  { name: 'Sky',    value: '#5BA4CF' },
  { name: 'White',  value: '#FFFFFF' },
]

let idCounter = 0
export function genId() {
  return `slide_${++idCounter}_${Date.now()}`
}

export function defaultSlides(): Slide[] {
  return [
    {
      id: genId(),
      type: 'cover',
      slideNumber: 1,
      headline: '5 Claude Code Features',
      emphasisLine: 'You Are Not Using',
      bodyText: 'These are not advanced. They are just not obvious when you first start.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'content',
      slideNumber: 2,
      stepNumber: 1,
      headline: 'Plan Mode',
      emphasisLine: 'See the plan before it builds',
      bodyText: 'Hit Shift+Tab before building anything. Claude shows you the full plan first. Review it, adjust it, then execute.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'content',
      slideNumber: 3,
      stepNumber: 2,
      headline: 'Compact Mode',
      emphasisLine: 'Stop wasting context',
      bodyText: 'Type /compact to compress the conversation. Claude summarizes what happened and keeps going with a clean context window.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'content',
      slideNumber: 4,
      stepNumber: 3,
      headline: 'Session Memory',
      emphasisLine: 'It remembers across sessions',
      bodyText: 'Create a CLAUDE.md in your project root. Claude reads it every time. Instructions, context, conventions - all loaded automatically.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'content',
      slideNumber: 5,
      stepNumber: 4,
      headline: 'Rewind',
      emphasisLine: 'Undo any mistake instantly',
      bodyText: 'Hit Escape to stop mid-generation. Then use the rewind button to roll back. Like Cmd+Z but for AI changes.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'content',
      slideNumber: 6,
      stepNumber: 5,
      headline: 'Thinking Mode',
      emphasisLine: 'More compute, better answers',
      bodyText: 'Type /thinking to switch to extended thinking. Claude reasons step by step before responding. Use it on hard problems.',
      bgColor: '#F5F0EB',
      textColor: '#1B1B1B',
      accentColor: '#E07355',
    },
    {
      id: genId(),
      type: 'cta',
      slideNumber: 7,
      headline: 'Follow For More',
      emphasisLine: '@tylerreed',
      bodyText: 'New Claude Code tips every week.',
      bgColor: '#1B4332',
      textColor: '#F5F0EB',
      accentColor: '#E07355',
    },
  ]
}
