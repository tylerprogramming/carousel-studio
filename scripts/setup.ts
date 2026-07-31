#!/usr/bin/env bun
/**
 * bun run setup — get a fresh clone to the point where it works.
 *
 * The README used to ask for six commands across two code blocks, and the
 * failure mode was silent: you would get all the way to pressing Export before
 * finding out Pillow was missing.
 *
 * The rule here is that this installs what it is safe to install and *directs*
 * for the rest. Dependencies and Pillow are the app's business. A language
 * runtime is not — quietly putting a Python on someone's machine is not a
 * setup script's job, so when one is missing this prints the command for their
 * platform and stops. Same for ffmpeg, which is optional anyway.
 *
 * Nothing here is destructive. Existing settings.json and .env are left alone.
 */

import { existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { homedir, platform } from 'os'

const ROOT = join(import.meta.dir, '..')
const OS = platform()

const c = {
  dim:   (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold:  (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red:   (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan:  (s: string) => `\x1b[36m${s}\x1b[0m`,
}

const ok   = (s: string) => console.log(`  ${c.green('✓')} ${s}`)
const warn = (s: string) => console.log(`  ${c.amber('!')} ${s}`)
const bad  = (s: string) => console.log(`  ${c.red('✗')} ${s}`)
const hint = (s: string) => console.log(`    ${c.dim(s)}`)
const cmd  = (s: string) => console.log(`    ${c.cyan(s)}`)

function run(args: string[], opts: { cwd?: string } = {}) {
  try {
    const p = Bun.spawnSync(args, { cwd: opts.cwd ?? ROOT, stdout: 'pipe', stderr: 'pipe' })
    return { code: p.exitCode, out: p.stdout.toString().trim(), err: p.stderr.toString().trim() }
  } catch (err) {
    // spawnSync throws rather than returning non-zero when the binary is not
    // there at all — which is the normal case here, since this script exists to
    // probe for things that may be missing.
    return { code: 127, out: '', err: String(err) }
  }
}

/** Install instructions for the current platform, and only that one. Printing
 *  three OSes' worth of commands makes the reader do the filtering. */
function installHint(what: 'python' | 'ffmpeg') {
  const table = {
    python: {
      darwin: ['Download the macOS installer from https://www.python.org/downloads/',
               'or, with Homebrew:  brew install python'],
      linux:  ['sudo apt install python3 python3-pip     # Debian/Ubuntu',
               'sudo dnf install python3 python3-pip     # Fedora'],
      win32:  ['winget install Python.Python.3.12',
               'or download from https://www.python.org/downloads/'],
    },
    ffmpeg: {
      darwin: ['brew install ffmpeg'],
      linux:  ['sudo apt install ffmpeg     # Debian/Ubuntu',
               'sudo dnf install ffmpeg     # Fedora'],
      win32:  ['winget install Gyan.FFmpeg'],
    },
  }
  const lines = (table[what] as Record<string, string[]>)[OS]
    ?? ['See https://www.python.org/downloads/ or your package manager']
  lines.forEach(cmd)
}

// ── Bun ───────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold('Social Studio setup')}\n`)
console.log(c.bold('Runtimes'))
ok(`Bun ${Bun.version}`)

// ── Python ────────────────────────────────────────────────────────────────────
// The same search order the app uses at runtime, so setup and the running app
// can never disagree about which interpreter is in play.
const CANDIDATES = [
  process.env.CAROUSEL_PYTHON,
  'python3', '/usr/bin/python3', '/opt/homebrew/bin/python3', '/usr/local/bin/python3', 'python',
].filter(Boolean) as string[]

interface Py { bin: string; version: string; pillow: string | null }

// Written out properly rather than joined with semicolons: `try:` is a compound
// statement and cannot follow simple ones on the same line, so the semicolon
// version was a SyntaxError and made every interpreter look missing.
const PROBE = `
import sys
try:
    import PIL
    pillow = PIL.__version__
except Exception:
    pillow = ''
print(sys.version.split()[0] + '|' + pillow)
`.trim()

function probe(bin: string): Py | null {
  const r = run([bin, '-c', PROBE])
  if (r.code !== 0) return null
  const [version, pillow] = r.out.split('|')
  if (!version) return null
  return { bin, version, pillow: pillow || null }
}

const found = CANDIDATES.map(probe).filter(Boolean) as Py[]
const withPillow = found.find((p) => p.pillow)
let python = withPillow ?? found[0] ?? null

if (!python) {
  bad('No Python found. The slide renderer is Python + Pillow, so nothing will render.')
  hint('Python 3.9 or newer. Install it, then run this again:')
  installHint('python')
  console.log()
  process.exit(1)
}

ok(`Python ${python.version} (${python.bin})`)

// ── Dependencies ──────────────────────────────────────────────────────────────
console.log(`\n${c.bold('Dependencies')}`)

for (const [label, cwd] of [['server', ROOT], ['client', join(ROOT, 'client')]] as const) {
  const r = run(['bun', 'install'], { cwd })
  if (r.code === 0) ok(`${label} packages`)
  else { bad(`bun install failed in ${label}`); hint(r.err.split('\n')[0] ?? ''); process.exit(1) }
}

// Pillow *is* this app's dependency, so installing it is fair game — unlike the
// interpreter it runs on.
if (python.pillow) {
  ok(`Pillow ${python.pillow}`)
} else {
  console.log(`  ${c.dim('…')} installing Pillow`)
  let r = run([python.bin, '-m', 'pip', 'install', '-r', join(ROOT, 'requirements.txt')])
  // Homebrew and system Pythons mark themselves externally managed (PEP 668).
  // The flag sounds alarming and is not, on a Python that is not the OS's own —
  // but it is only reached after the plain attempt has already failed.
  if (r.code !== 0 && /externally.managed/i.test(r.err)) {
    warn('This Python is externally managed; retrying with --break-system-packages')
    r = run([python.bin, '-m', 'pip', 'install', '--break-system-packages',
             '-r', join(ROOT, 'requirements.txt')])
  }
  const after = probe(python.bin)
  if (after?.pillow) { ok(`Pillow ${after.pillow}`); python = after }
  else {
    bad('Could not install Pillow automatically.')
    hint('Install it yourself, then run this again:')
    cmd(`${python.bin} -m pip install -r requirements.txt`)
    hint('If that reports "externally managed", either add --break-system-packages')
    hint('or use a virtualenv and point the app at it with pythonPath in settings.json.')
    process.exit(1)
  }
}

// ── ffmpeg ────────────────────────────────────────────────────────────────────
// Optional on purpose: PNG and PDF export are the common path and need nothing.
const ffmpeg = run(['ffmpeg', '-version']).code === 0
if (ffmpeg) ok('ffmpeg')
else {
  warn('ffmpeg not found — video export will be unavailable. PNG and PDF work without it.')
  installHint('ffmpeg')
}

// ── Config ────────────────────────────────────────────────────────────────────
console.log(`\n${c.bold('Config')}`)
for (const [example, real] of [['settings.example.json', 'settings.json'], ['.env.example', '.env']]) {
  const dest = join(ROOT, real)
  if (existsSync(dest)) { ok(`${real} ${c.dim('(already there, left alone)')}`) }
  else if (existsSync(join(ROOT, example))) { copyFileSync(join(ROOT, example), dest); ok(`${real} created from ${example}`) }
  else warn(`${example} is missing, so ${real} was not created`)
}

// ── What you can do now ───────────────────────────────────────────────────────
/** Every place the app actually reads keys from — a real environment variable,
 *  the project .env, and ~/.claude/.env. Checking only the first two reported
 *  "no key" on a machine that had one, which is exactly the kind of small lie
 *  that makes a setup script untrustworthy. */
async function findKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY (environment)'
  if (process.env.OPENAI_API_KEY) return 'OPENAI_API_KEY (environment)'
  for (const [path, where] of [
    [join(ROOT, '.env'), '.env'],
    [join(homedir(), '.claude', '.env'), '~/.claude/.env'],
  ]) {
    try {
      const text = await Bun.file(path).text()
      const hit = text.match(/^(ANTHROPIC_API_KEY|OPENAI_API_KEY)=(.+)$/m)
      if (hit?.[2]?.trim()) return `${hit[1]} (${where})`
    } catch { /* not there */ }
  }
  return null
}

const keySource = await findKey()
const hasKey = !!keySource

console.log(`\n${c.bold('Ready')}`)
cmd('bun run dev')
hint('then open http://localhost:5175')
console.log()

if (hasKey) {
  ok(`AI generation available — found ${keySource}.`)
} else {
  // The important half. Without saying this, an empty ANTHROPIC_API_KEY reads
  // as "this app does not work yet", when in fact everything except writing
  // copy is available.
  console.log(`  ${c.dim('No API key set — that is fine. Editing, rendering, exporting,')}`)
  console.log(`  ${c.dim('themes, fonts and alt text all work without one.')}`)
  console.log(`  ${c.dim('A key is only needed to have Claude write slide copy and captions:')}`)
  cmd('add ANTHROPIC_API_KEY=... to .env')
}
console.log()
