import { expandPath } from './paths'
import { onSettingsChange, readSettings } from './settings'

/**
 * Which Python actually runs the renderer.
 *
 * Every render, check and video runs a Python script, and this used to spawn
 * the literal 'python3' at fourteen call sites. That does not mean "the Python
 * this app was set up with", it means "whatever is first on PATH right now" —
 * and that changes underneath you. A `brew install` of anything with a Python
 * dependency can put a fresh interpreter ahead of the one Pillow lives in. The
 * server still starts, the editor still loads, and the failure arrives when you
 * press Export on a finished carousel, as an ImportError in a toast.
 *
 * That happened during development, which is why this exists. So: find an
 * interpreter that can actually import PIL, prefer one the user names, and be
 * able to say which was chosen and why.
 */

/** Reports the things that decide whether, and how, a slide renders.
 *  Pillow's version is not enough on its own — FreeType does the rasterising
 *  and Raqm does the shaping, and both vary independently of it. */
const PYTHON_PROBE = `
import json, sys
try:
    import PIL, PIL.features
except Exception:
    sys.exit(1)
print(json.dumps({
    'version':  sys.version.split()[0],
    'pillow':   PIL.__version__,
    'freetype': PIL.features.version('freetype2'),
    'raqm':     PIL.features.version('raqm'),
}))
`.trim()

export interface PythonInfo {
  bin: string; version: string; pillow: string
  freetype: string | null; raqm: string | null
}

let cache: PythonInfo | null | undefined
onSettingsChange(() => { cache = undefined })   // pythonPath may have changed

/** Candidates in order of authority. CAROUSEL_PYTHON beats settings.json, the
 *  way a real environment variable should: it is how you pin an interpreter for
 *  one run, or in CI, without editing a file you would then have to remember to
 *  change back. `python3` stays first among the guesses so a working PATH is
 *  still honoured.
 *
 *  Deduped, so naming an interpreter that is also a default does not make the
 *  list read as though it were tried twice. */
export function pythonCandidates(): string[] {
  const configured = (readSettings().pythonPath || '').trim()
  return [...new Set([
    process.env.CAROUSEL_PYTHON,
    configured && expandPath(configured),
    'python3',
    '/usr/bin/python3',
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    'python',
  ].filter(Boolean) as string[])]
}

function probe(bin: string): PythonInfo | null {
  try {
    const p = Bun.spawnSync([bin, '-c', PYTHON_PROBE], { stdout: 'pipe', stderr: 'ignore' })
    if (p.exitCode !== 0) return null
    return { bin, ...JSON.parse(p.stdout.toString()) }
  } catch {
    return null                // not on PATH, not executable, not a Python
  }
}

/** The first candidate that can import PIL, or null if none can. Resolved once;
 *  saving settings clears it. */
export function python(): PythonInfo | null {
  if (cache !== undefined) return cache
  for (const bin of pythonCandidates()) {
    const info = probe(bin)
    if (info) return (cache = info)
  }
  return (cache = null)
}

/** What to spawn. Falls back to a bare `python3` when nothing usable was found,
 *  so the failure is the same ImportError it always was rather than a crash —
 *  but /api/health and the startup banner will already have said so. */
export function pythonBin(): string {
  return python()?.bin ?? 'python3'
}

export function hasFfmpeg(): boolean {
  try { return Bun.spawnSync(['ffmpeg', '-version'], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0 }
  catch { return false }
}

/** One line at startup, saying what would otherwise only surface as a stack
 *  trace at export time. */
export function reportPython(log: (s: string) => void = console.log) {
  const py = python()
  if (py) {
    const shaping = py.raqm ? `raqm ${py.raqm}` : 'no raqm'
    log(`   python ${py.version} (${py.bin}) · Pillow ${py.pillow} · ` +
        `freetype ${py.freetype ?? '?'} · ${shaping}`)
    // Falling through past a configured interpreter is the right behaviour, but
    // doing it silently would leave you reading a settings file that is not
    // being obeyed and no way to tell.
    const wanted = (readSettings().pythonPath || '').trim()
    if (wanted && expandPath(wanted) !== py.bin) {
      log(`   ⚠  pythonPath is set to ${wanted}, but that cannot import Pillow — using ${py.bin} instead`)
    }
    if (!hasFfmpeg()) log('   ffmpeg not found — video export unavailable, PNG and PDF are fine')
    return
  }
  log('')
  log('   ⚠  No Python with Pillow found. Rendering will fail.')
  log(`      Looked at: ${pythonCandidates().join(', ')}`)
  log('      Fix: pip install -r requirements.txt')
  log('      Or point at a specific one: "pythonPath" in settings.json,')
  log('      or the CAROUSEL_PYTHON environment variable.')
  log('')
}
