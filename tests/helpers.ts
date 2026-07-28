import { spawnSync } from 'bun'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
export const FIXTURES = join(ROOT, 'tests', 'fixtures')

/**
 * Run a snippet of Python inside the repo root and parse its stdout as JSON.
 *
 * The tests reach into the renderer's own functions rather than re-deriving
 * their numbers, so a test can never quietly disagree with the code it is
 * checking. Running from ROOT is what makes `import generate_slide` resolve.
 */
export function py<T = unknown>(code: string): T {
  const proc = spawnSync(['python3', '-c', code], { cwd: ROOT })
  if (proc.exitCode !== 0) {
    throw new Error(`python failed (${proc.exitCode}):\n${proc.stderr.toString()}`)
  }
  const out = proc.stdout.toString().trim()
  try {
    return JSON.parse(out) as T
  } catch {
    throw new Error(`python did not return JSON:\n${out}\n${proc.stderr.toString()}`)
  }
}

/** Run a repo script with a JSON argv payload, the way server.ts spawns them. */
export function pyScript<T = unknown>(script: string, ...args: string[]): T {
  const proc = spawnSync(['python3', join(ROOT, script), ...args], { cwd: ROOT })
  const out = proc.stdout.toString().trim()
  if (proc.exitCode !== 0 && !out) {
    throw new Error(`${script} failed (${proc.exitCode}):\n${proc.stderr.toString()}`)
  }
  try {
    return JSON.parse(out) as T
  } catch {
    throw new Error(`${script} did not return JSON:\n${out}\n${proc.stderr.toString()}`)
  }
}
