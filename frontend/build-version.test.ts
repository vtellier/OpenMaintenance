// A build is named after the latest v* release tag (#197). Two places compute
// that name with `git describe`: the Makefile's VERSION (the binary and
// /api/version) and vite.config.ts's __APP_VERSION__ (the frontend bundle).
// Each test runs one of them in a throwaway repository where v0.9.0 is
// followed by a tag of another name, as `pre-react` follows it on main: both
// must still read v0.9.0-N-g<sha>, a version the update check can compare.
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, test } from 'vitest'

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.dirname(frontendDir)

// The Makefile test needs `make`, which a Windows machine may lack; CI and
// macOS have it, so it still runs there.
const hasMake = (() => {
  try {
    execFileSync('make', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

let tmp: string
let repo: string
let expected: string

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } },
  ).trim()
}

beforeAll(() => {
  // A git hook or an editor can export GIT_DIR, GIT_WORK_TREE or
  // GIT_INDEX_FILE, which would point git, make and the vite.config import at
  // another repository. The forks pool gives this file its own process, so
  // clearing them here covers all three.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('GIT_')) delete process.env[key]
  }
  tmp = mkdtempSync(path.join(tmpdir(), 'om-build-version-'))
  repo = path.join(tmp, 'repo')
  mkdirSync(repo)
  git('init', '-q')
  git('commit', '-q', '--allow-empty', '-m', 'release')
  git('tag', 'v0.9.0')
  git('commit', '-q', '--allow-empty', '-m', 'later work')
  git('tag', 'pre-react')
  git('commit', '-q', '--allow-empty', '-m', 'branch work')
  expected = `v0.9.0-2-g${git('rev-parse', '--short', 'HEAD')}`
})

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true })
})

test.skipIf(!hasMake)('the Makefile names the build after the latest v* tag', () => {
  // A second makefile prints VERSION, so the repository's Makefile is read as
  // it is (GNU make 3.81, as on macOS, has no --eval).
  const printer = path.join(tmp, 'print-version.mk')
  writeFileSync(printer, 'print-version:\n\t@echo $(VERSION)\n')
  const version = execFileSync(
    'make',
    ['-s', '-C', repo, '-f', path.join(repoRoot, 'Makefile'), '-f', printer, 'print-version'],
    { encoding: 'utf8' },
  ).trim()
  expect(version).toBe(expected)
})

test('vite.config.ts names the bundle after the latest v* tag', async () => {
  // getVersion() runs `git describe` in the working directory when the config
  // is loaded.
  const cwd = process.cwd()
  process.chdir(repo)
  try {
    const { default: config } = await import('./vite.config')
    expect(JSON.parse(config.define!.__APP_VERSION__ as string)).toBe(expected)
  } finally {
    process.chdir(cwd)
  }
})
