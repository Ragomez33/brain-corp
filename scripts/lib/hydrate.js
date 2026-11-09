const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildCommand } = require('./shell')
const { getRegisteredRepositories, readSystemMap } = require('./system-map')
const { t } = require('./i18n')

/**
 * A repository is considered initialized when it contains a `.git` entry.
 * `.git` can be a directory (regular clone) or a file (worktrees/submodules).
 */
function isGitRepository(targetDir) {
  try {
    const stats = fs.statSync(path.join(targetDir, '.git'))
    return stats.isDirectory() || stats.isFile()
  } catch {
    return false
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

  const result = spawnSync(buildCommand('git', ['clone', remote, target]), {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // shell: true resuelve git/git.exe y sus wrappers de forma consistente
    // en Windows, Linux y macOS.
    shell: true
  })

  if (result.error) throw result.error

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim()
    throw new Error(
      detail || t('hydrate.gitFailed', { status: result.status })
    )
  }

  logger.log(translator('hydrate.cloned', { repo: label }))
}

/**
 * Hydrates every sidecar registered in config/system-map.json.
 *
 * - Skips repositories whose local path already contains a `.git` entry.
 * - Clones missing/uninitialized repositories with `git clone <remote> <path>`.
 * - Isolates failures per repository: one broken sidecar never aborts the rest.
 *
 * @returns {{
 *   total: number,
 *   cloned: number,
 *   skipped: number,
 *   failed: number,
 *   results: Array<{id: string, path: string, remote: string|null, status: string, error: string|null}>
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
    return { total: 0, cloned: 0, skipped: 0, failed: 0, results }
  }

  logger.log(translator('hydrate.heading'))

  for (const repository of repositories) {
    const label =
      (repository && (repository.id || repository.name || repository.path)) || 'sidecar'
    const entry = {
      id: label,
      path: repository && repository.path ? repository.path : null,
      remote: null,
      status: 'failed',
      error: null
    }

    try {
      const target = resolveRepositoryTarget(rootDir, repository)
      const remote = resolveRepositoryRemote(repository)
      entry.remote = remote

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
    skipped: results.filter(item => item.status === 'skipped').length,
    failed: results.filter(item => item.status === 'failed').length,
    results
  }

  logger.log(
    translator('hydrate.summary', {
      cloned: summary.cloned,
      skipped: summary.skipped,
      failed: summary.failed
    })
  )

  return summary
}

module.exports = {
  cloneSidecar,
  hydrateSidecars,
  isGitRepository,
  resolveRepositoryRemote,
  resolveRepositoryTarget
}
