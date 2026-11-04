const fs = require('node:fs')
const path = require('node:path')

// La raíz del workspace es el cwd del usuario; los scripts viven en el paquete.
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
      'Mapa de topología del ecosistema brain-corp. Registra aquí los repositorios/sidecars que orquesta este workspace.',
    repositories: [],
    relationships: [],
    topology: {
      pattern: 'monorepo-contenedor con git submodules',
      gitmodules: '.gitmodules',
      groups: []
    },
    rootOrchestration: {
      enabled: true,
      root: '.',
      rule: 'Todos los comandos y skills operan desde la raíz de brain-corp. Las rutas de los sidecars se resuelven desde config/system-map.json; nunca se requiere cambiar de directorio.',
      pathResolution: 'repositories[].path (relativo a la raíz)',
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
    throw new Error(`No se pudo leer config/system-map.json: ${error.message}`)
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
  if (!raw) throw new Error('La ruta del sidecar es obligatoria.')

  if (path.isAbsolute(raw)) {
    const relative = path.relative(rootDir, raw).replace(/\\/g, '/')
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('La ruta debe estar dentro de la raíz de brain-corp.')
    }
    return relative
  }

  const normalized = path.posix.normalize(raw.replace(/\\/g, '/').replace(/^\.\//, ''))
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('La ruta debe ser relativa y permanecer dentro de brain-corp.')
  }

  return normalized
}

function createRepository({ name, role, path: repositoryPath, rootDir = ROOT_DIR }) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('El nombre del sidecar es obligatorio.')

  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    throw new Error('El rol debe ser provider, client o standalone.')
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
