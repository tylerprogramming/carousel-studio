import { spawnSync } from 'bun'
import { readFileSync } from 'fs'
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
/**
 * Which Python the tests use.
 *
 * Not the literal `python3`, for the same reason server.ts does not use it: on
 * a machine with more than one interpreter that name means whatever is first on
 * PATH today, and only one of them may have Pillow. A test suite that renders
 * through a different Python than the app does is measuring the wrong thing.
 *
 * CAROUSEL_PYTHON overrides, matching the server and letting CI or a contributor
 * pin the interpreter the goldens were made with.
 */
let pythonBin: string | undefined
export function python(): string {
  if (pythonBin) return pythonBin
  // settings.pythonPath first, in the same order the server resolves it. The
  // suite exists to test the renderer the app actually runs, so if you have
  // pinned an interpreter for the app, the tests must use that one — otherwise
  // they measure a Python your exports never touch.
  let configured: string | undefined
  try {
    configured = JSON.parse(readFileSync(join(ROOT, 'settings.json'), 'utf8')).pythonPath?.trim()
  } catch { /* no settings.json is the normal case for a fresh clone */ }

  const candidates = [...new Set([
    process.env.CAROUSEL_PYTHON,     // overrides settings, same as the server
    configured,
    // The project venv, ahead of every system interpreter — the same order
    // lib/python.ts uses. This list is duplicated rather than imported because
    // the tests must not depend on the module they are testing, so the two have
    // to be changed together. They drifted once: .venv was added to the app and
    // not here, and the moment settings.pythonPath was cleared the suite started
    // rendering through Homebrew's python3 (Pillow 12.3.0) while the app used
    // .venv (11.3.0). Every golden "failed" against pixels the app never
    // produces. If you touch one list, touch this one.
    join(ROOT, '.venv', 'bin', 'python3'),
    join(ROOT, '.venv', 'Scripts', 'python.exe'),   // Windows layout
    'python3', '/usr/bin/python3', '/opt/homebrew/bin/python3', '/usr/local/bin/python3', 'python',
  ].filter(Boolean) as string[])]
  for (const bin of candidates) {
    try {
      if (spawnSync([bin, '-c', 'import PIL'], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0) {
        return (pythonBin = bin)
      }
    } catch { /* not on PATH, try the next */ }
  }
  throw new Error(
    `No Python with Pillow found. Tried: ${candidates.join(', ')}.\n` +
    'Install it with: pip install -r requirements.txt\n' +
    'Or set CAROUSEL_PYTHON to a specific interpreter.')
}

export function py<T = unknown>(code: string): T {
  const proc = spawnSync([python(), '-c', code], { cwd: ROOT })
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
  const proc = spawnSync([python(), join(ROOT, script), ...args], { cwd: ROOT })
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
