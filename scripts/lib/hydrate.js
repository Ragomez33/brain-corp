const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildCommand } = require('./shell')
const { getRegisteredRepositories, readSystemMap } = require('./system-map')
const { t } = require('./i18n')

function normalizeGitPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '')
}

function gitPathKey(value) {
  const normalized = normalizeGitPath(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function runGit(rootDir, args) {
  const result = spawnSync(buildCommand('git', args), {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // shell: true resuelve git/git.exe y sus wrappers de forma consistente
    // en Windows, Linux y macOS.
    shell: true
  })

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    error: result.error || null
  }
}

function gitError(result) {
  return (
    String(result.stderr || result.stdout || '').trim() ||
    (result.error && result.error.message) ||
    'git command failed.'
  )
}

/**
 * A repository is considered initialized when it has a `.git` entry and Git
 * can resolve it as a work tree. A `.git` file is valid for submodules/worktrees.
 */
function isGitRepository(targetDir) {
  try {
    const stats = fs.statSync(path.join(targetDir, '.git'))
    if (!stats.isDirectory() && !stats.isFile()) return false
  } catch {
    return false
  }

  const result = runGit(targetDir, ['rev-parse', '--is-inside-work-tree'])

  // If Git itself is unavailable, fall back to the marker instead of failing
  // the whole hydration loop with a misleading message.
  if (result.error) return true

  return result.ok && result.stdout.trim() === 'true'
}

function unquote(value) {
  const text = String(value || '').trim()

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1)
  }

  return text
}

/**
 * Parses submodule paths from `.gitmodules` without mutating the repository.
 * Returns normalized paths relative to the container root.
 */
function readSubmodulePaths(rootDir) {
  const file = path.join(rootDir, '.gitmodules')
  if (!fs.existsSync(file)) return []

  let content

  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }

  const paths = []
  let inSubmodule = false

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#') || line.startsWith(';')) continue

    if (/^\[submodule\s+".*"\]$/i.test(line)) {
      inSubmodule = true
      continue
    }

    if (line.startsWith('[')) {
      inSubmodule = false
      continue
    }

    if (!inSubmodule) continue

    const match = line.match(/^path\s*=\s*(.+)$/i)
    if (match) paths.push(normalizeGitPath(unquote(match[1])))
  }

  return paths
}

/**
 * Reads gitlinks (mode 160000) from the container index. This detects orphan
 * submodule entries even when `.gitmodules` is missing or incomplete.
 */
function readGitlinks(rootDir) {
  const result = runGit(rootDir, ['ls-files', '--stage', '-z'])
  if (!result.ok) return new Set()

  const links = new Set()

  for (const entry of result.stdout.split('\0')) {
    const match = entry.match(/^160000\s+[0-9a-fA-F]+\s+\d+\t(.+)$/)
    if (match) links.add(normalizeGitPath(match[1]))
  }

  return links
}

function syncSubmodules(rootDir) {
  const commands = [
    ['submodule', 'sync', '--recursive'],
    ['submodule', 'update', '--init', '--recursive']
  ]

  for (const args of commands) {
    const result = runGit(rootDir, args)

    if (!result.ok) {
      return {
        ok: false,
        command: `git ${args.join(' ')}`,
        error: gitError(result)
      }
    }
  }

  return { ok: true, command: null, error: null }
}

function submoduleStatus(rootDir, relativePath) {
  const result = runGit(rootDir, ['submodule', 'status', '--', relativePath])

  if (!result.ok) {
    return { ok: false, error: gitError(result) }
  }

  const line = result.stdout.split(/\r?\n/).find(item => item.trim())
  if (!line) {
    return {
      ok: true,
      initialized: false,
      inSync: false,
      state: 'missing',
      error: null
    }
  }

  // git submodule status prefixes:
  // ' ' in sync, '+' HEAD differs from index, '-' not initialized, 'U' conflict.
  const prefix = line[0]

  return {
    ok: true,
    initialized: prefix !== '-',
    inSync: prefix === ' ',
    state: prefix,
    error: null
  }
}

function resolveRepositoryRemote(repository) {
  const candidates = [
    repository && repository.remote,
    repository && repository.sshUrl,
    repository && repository.url
  ]

  const remote = candidates.find(value => typeof value === 'string' && value.trim())
  return remote ? remote.trim() : null
}

function resolveRepositoryTarget(rootDir, repository) {
  const raw = String((repository && repository.path) || '').trim()
  if (!raw) throw new Error(t('hydrate.pathMissing'))

  const target = path.resolve(rootDir, raw)
  const relative = path.relative(rootDir, target)

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(t('hydrate.pathOutsideRoot', { path: raw }))
  }

  return target
}

function cloneSidecar({ repository, rootDir, remote, target, translator, logger }) {
  const label = repository.id || repository.name || repository.path

  fs.mkdirSync(path.dirname(target), { recursive: true })

  logger.log(translator('hydrate.cloning', { repo: label, path: repository.path }))

  const result = runGit(rootDir, ['clone', remote, target])

  if (!result.ok) {
    throw new Error(
      gitError(result) ||
        translator('hydrate.gitFailed', { status: result.status })
    )
  }

  logger.log(translator('hydrate.cloned', { repo: label }))
}

/**
 * Hydrates every sidecar registered in config/system-map.json.
 *
 * Submodule-aware behavior:
 * - If `.gitmodules` exists, runs `git submodule sync --recursive` and
 *   `git submodule update --init --recursive` before processing sidecars.
 * - Gitlink paths declared as submodules are never overwritten with a plain
 *   `git clone`; they must be initialized by Git itself.
 * - Orphan gitlinks without a `.gitmodules` declaration are reported as
 *   inconsistencies.
 * - Independent repositories keep the existing conditional clone behavior.
 *
 * @returns {{
 *   total: number,
 *   cloned: number,
 *   synced: number,
 *   skipped: number,
 *   failed: number,
 *   results: Array<{
 *     id: string,
 *     path: string,
 *     remote: string|null,
 *     status: string,
 *     submodule: boolean,
 *     error: string|null
 *   }>
 * }}
 */
function hydrateSidecars({
  rootDir = process.cwd(),
  map = null,
  translator = t,
  logger = console
} = {}) {
  const systemMap = map || readSystemMap(rootDir)
  const repositories = getRegisteredRepositories(systemMap)
  const results = []

  if (repositories.length === 0) {
    logger.log(translator('hydrate.empty'))
    return { total: 0, cloned: 0, synced: 0, skipped: 0, failed: 0, results }
  }

  logger.log(translator('hydrate.heading'))

  const hasGitmodules = fs.existsSync(path.join(rootDir, '.gitmodules'))
  const submodulePaths = readSubmodulePaths(rootDir)
  const submoduleKeys = new Set(submodulePaths.map(gitPathKey))
  const gitlinkKeys = new Set([...readGitlinks(rootDir)].map(gitPathKey))
  let submoduleSync = null

  if (hasGitmodules) {
    logger.log(translator('hydrate.submodulesDetected'))
    submoduleSync = syncSubmodules(rootDir)

    if (submoduleSync.ok) {
      logger.log(translator('hydrate.submodulesSynced'))
    } else {
      logger.error(
        translator('hydrate.submodulesFailed', { error: submoduleSync.error })
      )
    }
  }

  for (const repository of repositories) {
    const label =
      (repository && (repository.id || repository.name || repository.path)) || 'sidecar'
    const entry = {
      id: label,
      path: repository && repository.path ? repository.path : null,
      remote: null,
      status: 'failed',
      submodule: false,
      error: null
    }

    try {
      const target = resolveRepositoryTarget(rootDir, repository)
      const relativePath = normalizeGitPath(path.relative(rootDir, target))
      const pathKey = gitPathKey(relativePath)
      const declaredSubmodule = submoduleKeys.has(pathKey)
      const hasGitlink = gitlinkKeys.has(pathKey)
      const remote = resolveRepositoryRemote(repository)

      entry.remote = remote
      entry.submodule = declaredSubmodule || hasGitlink

      // A gitlink without a matching .gitmodules entry is an inconsistent
      // container index. Cloning into it would create a nested repository and
      // leave the parent index broken.
      if (hasGitlink && !declaredSubmodule) {
        throw new Error(
          translator('hydrate.orphanGitlink', { repo: label, path: repository.path })
        )
      }

      if (declaredSubmodule) {
        const status = submoduleStatus(rootDir, relativePath)

        if (status.ok && status.initialized && status.inSync) {
          entry.status = 'synced'
          results.push(entry)
          logger.log(
            translator('hydrate.submoduleSynced', {
              repo: label,
              path: repository.path
            })
          )
          continue
        }

        const detail =
          (status.ok ? null : status.error) ||
          (submoduleSync && !submoduleSync.ok ? submoduleSync.error : null)

        if (status.ok && status.initialized && !status.inSync) {
          throw new Error(
            translator('hydrate.submoduleOutOfSync', {
              repo: label,
              path: repository.path
            })
          )
        }

        throw new Error(
          translator('hydrate.submoduleIncomplete', {
            repo: label,
            path: repository.path,
            error: detail || translator('hydrate.submoduleNotInitialized')
          })
        )
      }

      if (isGitRepository(target)) {
        entry.status = 'skipped'
        results.push(entry)
        logger.log(
          translator('hydrate.skipped', { repo: label, path: repository.path })
        )
        continue
      }

      if (!remote) {
        throw new Error(translator('hydrate.noRemote', { repo: label }))
      }

      cloneSidecar({ repository, rootDir, remote, target, translator, logger })
      entry.status = 'cloned'
      results.push(entry)
    } catch (error) {
      const message = error && error.message ? error.message : String(error)

      entry.status = 'failed'
      entry.error = message
      results.push(entry)

      logger.error(translator('hydrate.failed', { repo: label, error: message }))
    }
  }

  const summary = {
    total: results.length,
    cloned: results.filter(item => item.status === 'cloned').length,
    synced: results.filter(item => item.status === 'synced').length,
    skipped: results.filter(item => item.status === 'skipped').length,
    failed: results.filter(item => item.status === 'failed').length,
    results
  }

  logger.log(
    translator('hydrate.summary', {
      cloned: summary.cloned,
      synced: summary.synced,
      skipped: summary.skipped,
      failed: summary.failed
    })
  )

  return summary
}

module.exports = {
  cloneSidecar,
  gitPathKey,
  hydrateSidecars,
  isGitRepository,
  normalizeGitPath,
  readGitlinks,
  readSubmodulePaths,
  resolveRepositoryRemote,
  resolveRepositoryTarget,
  submoduleStatus,
  syncSubmodules
}
