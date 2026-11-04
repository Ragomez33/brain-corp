const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildCommand } = require('./shell')
const {
  ROOT_DIR,
  createRepository,
  normalizeRepositoryPath,
  slugify
} = require('./system-map')

const GH_REPO_JQ =
  '.[] | {name: .name, nameWithOwner: .full_name, url: .html_url, sshUrl: .ssh_url, isPrivate: .private, owner: .owner.login}'

function runGh(args, { rootDir = ROOT_DIR } = {}) {
  const result = spawnSync(buildCommand('gh', args), {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  })

  const stdout = (result.stdout || '').trim()
  const stderr = (result.stderr || '').trim()

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
      stdout,
      stderr
    }
  }

  if (result.status !== 0) {
    return {
      ok: false,
      status: result.status,
      error: stderr || stdout || `El comando "gh ${args.join(' ')}" falló.`,
      stdout,
      stderr
    }
  }

  return { ok: true, status: 0, stdout, stderr }
}

function normalizeGithubRepository(repository) {
  return {
    source: 'github',
    name: String(repository.name || '').trim(),
    nameWithOwner: repository.nameWithOwner || null,
    owner: repository.owner || null,
    url: repository.url || null,
    sshUrl: repository.sshUrl || null,
    isPrivate: Boolean(repository.isPrivate),
    pushedAt: repository.pushedAt || null
  }
}

function parseGhApiRepositories(output) {
  const text = String(output || '').trim()
  if (!text) return []

  if (text.startsWith('[')) {
    return JSON.parse(text)
  }

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
}

function listGithubRepositories({ rootDir = ROOT_DIR, perPage = 100, owner = null } = {}) {
  const safePerPage =
    Number.isInteger(Number(perPage)) && Number(perPage) > 0 ? Number(perPage) : 100
  const endpoint = owner
    ? `orgs/${owner}/repos?per_page=${safePerPage}`
    : `user/repos?per_page=${safePerPage}`

  const result = runGh(
    ['api', '--paginate', endpoint, '--jq', GH_REPO_JQ],
    { rootDir }
  )

  if (!result.ok) {
    throw new Error(result.error)
  }

  let repositories

  try {
    repositories = parseGhApiRepositories(result.stdout)
  } catch (error) {
    throw new Error(`La salida de "gh api" no es JSON válido: ${error.message}`)
  }

  return repositories
    .map(normalizeGithubRepository)
    .filter(repository => repository.name)
    .sort((a, b) =>
      String(a.nameWithOwner || a.name).localeCompare(String(b.nameWithOwner || b.name))
    )
}

function parseGithubRemote(value) {
  const input = String(value || '').trim()

  const patterns = [
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
    /^github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (!match) continue

    const owner = match[1]
    const name = match[2]

    return {
      source: 'github-manual',
      name,
      nameWithOwner: `${owner}/${name}`,
      owner,
      url: `https://github.com/${owner}/${name}`,
      sshUrl: `git@github.com:${owner}/${name}.git`,
      isPrivate: null,
      pushedAt: null
    }
  }

  return null
}

function parseRepositoryInput(value, { rootDir = ROOT_DIR } = {}) {
  const input = String(value || '').trim()
  if (!input) return null

  const githubRepository = parseGithubRemote(input)
  if (githubRepository) return githubRepository

  const localPath = path.isAbsolute(input)
    ? path.normalize(input)
    : path.resolve(rootDir, input)

  if (!fs.existsSync(localPath)) {
    throw new Error(
      `No se encontró una URL de GitHub válida ni una ruta local existente: ${input}`
    )
  }

  if (!fs.statSync(localPath).isDirectory()) {
    throw new Error(`La ruta local no es un directorio: ${input}`)
  }

  const name = path.basename(localPath)
  const relative = path.relative(rootDir, localPath).replace(/\\/g, '/')
  const insideRoot =
    relative && relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative)

  return {
    source: 'local',
    name,
    nameWithOwner: null,
    url: null,
    sshUrl: null,
    isPrivate: null,
    pushedAt: null,
    localPath,
    path: insideRoot ? relative : null
  }
}

function repositoryFromDescriptor(descriptor, role, { rootDir = ROOT_DIR } = {}) {
  const repositoryPath =
    descriptor.path || normalizeRepositoryPath(rootDir, `sidecars/${slugify(descriptor.name)}`)

  const repository = createRepository({
    name: descriptor.name,
    role,
    path: repositoryPath,
    rootDir
  })

  repository.source = descriptor.source || 'manual'

  if (descriptor.nameWithOwner) repository.nameWithOwner = descriptor.nameWithOwner
  if (descriptor.owner) repository.owner = descriptor.owner
  if (descriptor.url) repository.url = descriptor.url
  if (descriptor.sshUrl) repository.sshUrl = descriptor.sshUrl
  if (descriptor.sshUrl || descriptor.url) repository.remote = descriptor.sshUrl || descriptor.url
  if (typeof descriptor.isPrivate === 'boolean') repository.isPrivate = descriptor.isPrivate
  if (descriptor.pushedAt) repository.pushedAt = descriptor.pushedAt
  if (descriptor.localPath) repository.localPath = descriptor.localPath

  return repository
}

function repositoryFromGithub(repository, role, { rootDir = ROOT_DIR } = {}) {
  return repositoryFromDescriptor(normalizeGithubRepository(repository), role, { rootDir })
}

function ensureUniqueRepository(repository, repositories = []) {
  const sameRemote =
    repository.nameWithOwner &&
    repositories.find(
      item =>
        item.nameWithOwner &&
        String(item.nameWithOwner).toLowerCase() ===
          String(repository.nameWithOwner).toLowerCase()
    )

  if (sameRemote) {
    return {
      ...repository,
      id: sameRemote.id,
      path: sameRemote.path
    }
  }

  return repository
}

function repositoryExists(repository, rootDir = ROOT_DIR) {
  if (!repository || !repository.path) return false
  return fs.existsSync(path.resolve(rootDir, repository.path))
}

function cloneRepository({ repository, rootDir = ROOT_DIR } = {}) {
  if (!repository) throw new Error('Falta el repositorio a clonar.')

  if (repositoryExists(repository, rootDir)) {
    return { ok: true, skipped: true, path: repository.path }
  }

  if (!repository.nameWithOwner) {
    return {
      ok: false,
      skipped: false,
      error: `"${repository.name}" no tiene owner/repositorio de GitHub; no se puede clonar con gh.`
    }
  }

  const targetPath = repository.path
  fs.mkdirSync(path.dirname(path.resolve(rootDir, targetPath)), { recursive: true })

  const result = spawnSync(
    buildCommand('gh', ['repo', 'clone', repository.nameWithOwner, targetPath]),
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true
    }
  )

  if (result.error) {
    return { ok: false, skipped: false, error: result.error.message, path: targetPath }
  }

  return {
    ok: result.status === 0,
    skipped: false,
    status: result.status,
    path: targetPath,
    error:
      result.status === 0
        ? null
        : `El comando "gh repo clone" terminó con código ${result.status}.`
  }
}

module.exports = {
  GH_REPO_JQ,
  cloneRepository,
  ensureUniqueRepository,
  listGithubRepositories,
  normalizeGithubRepository,
  parseGhApiRepositories,
  parseGithubRemote,
  parseRepositoryInput,
  repositoryExists,
  repositoryFromDescriptor,
  repositoryFromGithub,
  runGh
}
