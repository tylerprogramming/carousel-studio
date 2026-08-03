import { homedir } from 'os'
import { join, sep } from 'path'

/**
 * The two roots, and nothing else.
 *
 * This module imports only node builtins on purpose. `paths.ts` needs the roots
 * and reads settings; `settings.ts` needs a root to find settings.json in. Put
 * the roots in either of those and the two import each other.
 *
 * **APP_ROOT** is where the code lives: fonts, examples, frameworks, themes, the
 * Python scripts, the built client. Read-only.
 *
 * **DATA_ROOT** is where your work lives: carousels, exports, generated images,
 * audio, settings.json. Written to constantly.
 *
 * They were the same directory, which is correct for a git clone and wrong for
 * anything else. Installed from npm the code sits in node_modules — so the app
 * would have been writing your carousels there, and losing them on the next
 * `bunx social-studio@latest`.
 */

export const APP_ROOT = join(import.meta.dir, '..')

/**
 * Where to keep work.
 *
 * A clone keeps everything in the clone, which is what it has always done and
 * what anyone with an existing checkout expects — moving their carousels out
 * from under them would be a worse bug than the one this fixes.
 *
 * Only a package install redirects, detected by living under node_modules
 * rather than by guessing. `SOCIAL_STUDIO_DATA` overrides either way, which is
 * also how you run two independent copies against one install.
 */
export const DATA_ROOT: string = (() => {
  const configured = (process.env.SOCIAL_STUDIO_DATA ?? '').trim()
  if (configured) {
    return configured.startsWith('~')
      ? join(homedir(), configured.slice(1).replace(/^[/\\]/, ''))
      : configured
  }
  const installed = APP_ROOT.includes(`${sep}node_modules${sep}`)
                 || APP_ROOT.endsWith(`${sep}node_modules`)
  return installed ? join(homedir(), '.social-studio') : APP_ROOT
})()

/** True when work is being kept somewhere other than the code. Worth saying at
 *  startup, because "where did my carousels go" is otherwise a mystery. */
export const DATA_IS_SEPARATE = DATA_ROOT !== APP_ROOT
