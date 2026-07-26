import { cn } from '../lib/utils'

/**
 * The pre-export check, totalled, next to the button it is about.
 *
 * It never disables Export. An error is usually something you want to see
 * rendered before you fix it, and a warning is advice. This says how many
 * there are and takes you to the first one.
 *
 * Clean reads as a quiet line rather than nothing at all, for the same reason
 * the readiness rail states both answers: an indicator that only ever appears
 * when something is wrong is one you stop believing when it is absent.
 */

interface Props {
  errors: number
  warnings: number
  loaded: boolean
  /** Jump to the first affected slide. */
  onJump: () => void
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export default function CheckBadge({ errors, warnings, loaded, onJump }: Props) {
  // Nothing until the first answer lands, rather than a "clear" that is only
  // true because the check has not run yet.
  if (!loaded) return null

  if (!errors && !warnings) {
    return (
      <span
        title="The pre-export check found nothing wrong with these slides."
        className="shrink-0 cursor-default text-[11px] font-semibold text-muted-foreground"
      >
        Checks clear
      </span>
    )
  }

  const label = [
    errors && plural(errors, 'error'),
    warnings && plural(warnings, 'warning'),
  ].filter(Boolean).join(', ')

  return (
    <button
      onClick={onJump}
      title="Found before export, by measuring with the renderer's own fonts. Click to jump to the first one."
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-[5px] text-[11px] font-semibold transition-colors',
        errors
          ? 'border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive'
          : 'border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-400',
      )}
    >
      <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', errors ? 'bg-destructive' : 'bg-amber-500')} />
      {label}
    </button>
  )
}
