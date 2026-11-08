const fs = require('node:fs')
const path = require('node:path')

// The workspace root is the user's cwd; scripts live in the package.
const ROOT_DIR = process.cwd()
const ROLES = ['provider', 'client', 'standalone']

function systemMapPath(rootDir = ROOT_DIR) {
  return path.join(rootDir, 'config', 'system-map.json')
}

function createNeutralMap() {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString().slice(0, 10),
    root: '.',
    description:
      'Ecosystem topology map for brain-corp. Register the repositories/sidecars orchestrated by this workspace.',
    repositories: [],
    relationships: [],
    topology: {
      pattern: 'multi-repository workspace',
      groups: []
    },
    rootOrchestration: {
      enabled: true,
      root: '.',
      rule: 'All commands and skills operate from the brain-corp root. Sidecar paths are resolved from config/system-map.json; changing directories is never required.',
      pathResolution: 'repositories[].path (relative to root)',
      neverCd: true
    },
    domains: {},
    notes: []
  }
}

function inferRole(repository) {
  const type = String(repository && repository.type ? repository.type : '').toLowerCase()

  if (/(backend|api|provider|server|service)/.test(type)) return 'provider'
  if (/(front|web|client|ui)/.test(type)) return 'client'
  return 'standalone'
}

function normalizeMap(map) {
  const neutral = createNeutralMap()

  return {
    ...neutral,
    ...map,
    repositories: (Array.isArray(map.repositories) ? map.repositories : []).map(repository => ({
      ...(repository || {}),
      role: normalizeRole(repository && repository.role) || inferRole(repository)
    })),
    relationships: Array.isArray(map.relationships) ? map.relationships : [],
    topology: {
      ...neutral.topology,
      ...(map.topology || {}),
      groups: Array.isArray(map.topology && map.topology.groups)
        ? map.topology.groups
        : []
    },
    rootOrchestration: {
      ...neutral.rootOrchestration,
      ...(map.rootOrchestration || {})
    },
    domains:
      map.domains && typeof map.domains === 'object' && !Array.isArray(map.domains)
        ? map.domains
        : {},
    notes: Array.isArray(map.notes) ? map.notes : []
  }
}

function readSystemMap(rootDir = ROOT_DIR) {
  const filePath = systemMapPath(rootDir)

  if (!fs.existsSync(filePath)) return createNeutralMap()

  let parsed

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read config/system-map.json: ${error.message}`)
  }

  return normalizeMap(parsed)
}

function writeSystemMap(rootDir, map) {
  const filePath = systemMapPath(rootDir)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(normalizeMap(map), null, 2)}\n`, 'utf8')
  return filePath
}

function getRegisteredRepositories(map) {
  return Array.isArray(map && map.repositories) ? map.repositories : []
}

function hasConfiguredSidecars(map) {
  return getRegisteredRepositories(map).length > 0
}

function isCleanWorkspace(rootDir, map) {
  const repositories = getRegisteredRepositories(map)
  if (repositories.length === 0) return true

  return repositories.every(repository => {
    if (!repository || !repository.path) return true
    return !fs.existsSync(path.resolve(rootDir, repository.path))
  })
}

function getTargetDomains(map) {
  const domains = getRegisteredRepositories(map)
    .map(repository => repository.id || repository.name)
    .filter(Boolean)
    .map(String)

  return new Set([...domains, 'shared'])
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  return ROLES.includes(role) ? role : null
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'sidecar'
}

function normalizeRepositoryPath(rootDir, value, fallback = '') {
  const raw = String(value || fallback || '').trim()
  if (!raw) throw new Error('Sidecar path is required.')

  if (path.isAbsolute(raw)) {
    const relative = path.relative(rootDir, raw).replace(/\\/g, '/')
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path must be inside the brain-corp root.')
    }
    return relative
  }

  const normalized = path.posix.normalize(raw.replace(/\\/g, '/').replace(/^\.\//, ''))
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('Path must be relative and stay inside brain-corp.')
  }

  return normalized
}

function createRepository({ name, role, path: repositoryPath, rootDir = ROOT_DIR }) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Sidecar name is required.')

  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    throw new Error('Role must be provider, client or standalone.')
  }

  const id = slugify(cleanName)
  const normalizedPath = normalizeRepositoryPath(
    rootDir,
    repositoryPath,
    `sidecars/${id}`
  )

  return {
    id,
    name: cleanName,
    path: normalizedPath,
    role: normalizedRole,
    type: normalizedRole,
    description: ''
  }
}

module.exports = {
  ROOT_DIR,
  ROLES,
  createNeutralMap,
  createRepository,
  getRegisteredRepositories,
  getTargetDomains,
  hasConfiguredSidecars,
  isCleanWorkspace,
  normalizeMap,
  normalizeRepositoryPath,
  normalizeRole,
  readSystemMap,
  slugify,
  systemMapPath,
  writeSystemMap
}
