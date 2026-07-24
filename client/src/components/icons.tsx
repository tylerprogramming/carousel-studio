/**
 * Inline SVG icons.
 *
 * These live in one file rather than being redefined per-component (App.tsx
 * previously carried its own copies of several of these). They take className
 * so colour comes from Tailwind via `currentColor` instead of a hardcoded hex.
 */

type IconProps = { size?: number; className?: string }

export function AppLogo({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" className={className}>
      <rect width="30" height="30" rx="7.5" className="fill-brand" />
      <rect x="4.5" y="5.5" width="11" height="14" rx="2" fill="white" opacity="0.35" />
      <rect x="8.5" y="8.5" width="11" height="14" rx="2" fill="white" opacity="0.6" />
      <rect x="12.5" y="11.5" width="11" height="14" rx="2" fill="white" />
    </svg>
  )
}

export function IgLogo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <path d="M12 2.982c2.937 0 3.285.011 4.445.064 3.066.14 4.492 1.589 4.632 4.632.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445c-.14 3.04-1.562 4.492-4.632 4.632-1.16.053-1.506.064-4.445.064-2.937 0-3.285-.011-4.445-.064-3.066-.14-4.492-1.596-4.632-4.632C2.993 15.285 2.982 14.937 2.982 12s.011-3.285.064-4.445c.14-3.04 1.562-4.492 4.632-4.632 1.16-.053 1.508-.064 4.445-.064zm0-1.982C9.013 1 8.638 1.014 7.465 1.067 3.495 1.254 1.254 3.492 1.067 7.465 1.014 8.638 1 9.013 1 12c0 2.987.014 3.362.067 4.535.187 3.97 2.425 6.211 6.398 6.398C8.638 22.986 9.013 23 12 23c2.987 0 3.362-.014 4.535-.067 3.967-.187 6.211-2.423 6.398-6.398C22.986 15.362 23 14.987 23 12c0-2.987-.014-3.362-.067-4.535C22.748 3.498 20.506 1.254 16.535 1.067 15.362 1.014 14.987 1 12 1zm0 5.838a5.162 5.162 0 100 10.324 5.162 5.162 0 000-10.324zM12 15a3 3 0 110-6 3 3 0 010 6zm5.338-9.87a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z" fill="url(#ig-grad)" />
    </svg>
  )
}

export function LiLogo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path d="M6.5 9.5H4.5V19.5H6.5V9.5Z" fill="white" />
      <circle cx="5.5" cy="6.5" r="1.5" fill="white" />
      <path d="M19.5 13.5C19.5 11.3 18 9.5 15.5 9.5C14.2 9.5 13.1 10.1 12.5 11V9.5H10.5V19.5H12.5V14.5C12.5 12.8 13.6 11.5 15 11.5C16.4 11.5 17.5 12.3 17.5 14V19.5H19.5V13.5Z" fill="white" />
    </svg>
  )
}

export function TikTokLogo({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" fill="currentColor" />
    </svg>
  )
}

export function FolderIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5H6l1.5 2H13.5A1 1 0 0 1 14.5 5.5V12.5A1 1 0 0 1 13.5 13.5H2.5A1 1 0 0 1 1.5 12.5V3.5Z" stroke="currentColor" strokeWidth="1.3" fill="none" />
    </svg>
  )
}

export function SparkleIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M7 1L8.2 5.2L12.5 7L8.2 8.8L7 13L5.8 8.8L1.5 7L5.8 5.2L7 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export function BoltIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size * (14 / 13)} viewBox="0 0 13 14" fill="none" className={className}>
      <path d="M7.5 1L2 8H6.5L5.5 13L11 6H6.5L7.5 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function UndoIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8h8a5 5 0 0 1 0 10H7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function RedoIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M13 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 8H9a5 5 0 0 0 0 10h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function CopyIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 5.5v-3a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function GripIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <circle cx="4" cy="2.5" r="1" fill="currentColor" />
      <circle cx="8" cy="2.5" r="1" fill="currentColor" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="8" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="9.5" r="1" fill="currentColor" />
      <circle cx="8" cy="9.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function SlidesTabIcon({ size = 19, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="7" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="14" width="16" height="3" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

export function EditTabIcon({ size = 19, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M13.5 3.5L16.5 6.5L7 16H4V13L13.5 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export function BgTabIcon({ size = 19, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 13L6 9L9 12L13 8L18 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PreviewTabIcon({ size = 19, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M2 10C2 10 5 4 10 4C15 4 18 10 18 10C18 10 15 16 10 16C5 16 2 10 2 10Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
