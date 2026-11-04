#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline/promises')
const ecosystem = require('./lib/ecosystem')
const { provisionCoreAssets } = require('./lib/agent-provision')
const {
  confirm,
  isInteractiveTerminal,
  promptSelection
} = require('./lib/prompts')
const {
  ROOT_DIR,
  ROLES,
  getRegisteredRepositories,
  hasConfiguredSidecars,
  isCleanWorkspace,
  normalizeRole,
  readSystemMap,
  writeSystemMap
} = require('./lib/system-map')

const SPECIFY_CONFIG_PATH = path.join('.specify', 'config.json')

const ROLE_LABELS = {
  provider: 'provider (provee datos/API a otros sidecars)',
  client: 'client (consume datos/API de un provider)',
  standalone: 'standalone (opera de forma autónoma)'
}

function printHelp() {
  console.log(`brain-corp setup-wizard

Uso:
  node scripts/setup-wizard.js [opciones]

Opciones:
  --manual   Omite la API de GitHub y registra repositorios por URL o ruta local.
  --force    Vuelve a preguntar aunque ya existan sidecars configurados.
  --help     Muestra esta ayuda.

Flujo:
  1. Consulta todos los repositorios accesibles (personales y de organizaciones) con:
     gh api --paginate user/repos?per_page=100 --jq "<campos>"
  2. Si hay muchos repositorios, permite filtrar por organización.
  3. Muestra un menú multi-select: flechas para moverte, espacio para marcar
     y Enter para confirmar.
  4. Permite asignar rol (provider | client | standalone) a cada seleccionado.
  5. Genera config/system-map.json con rutas sidecars/<nombre-repo>.
  6. Ofrece clonar con "gh repo clone <owner/repo> <ruta>".
  Si gh no está autenticado o falla, el wizard continúa en modo manual.`)
}

function parseArgs(argv) {
  const args = { manual: false, force: false, help: false }

  for (const current of argv) {
    if (current === '--manual') args.manual = true
    else if (current === '--force') args.force = true
    else if (current === '--help' || current === '-h') args.help = true
    else throw new Error(`Argumento no reconocido: ${current}`)
  }

  return args
}

async function ask(rl, question, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  return answer || defaultValue
}

async function chooseRole(rl) {
  const choices = ROLES.map(role => ({
    name: ROLE_LABELS[role],
    value: role
  }))

  if (isInteractiveTerminal()) {
    const selected = await promptSelection(rl, {
      message: 'Rol del sidecar',
      choices,
      pageSize: ROLES.length,
      multiple: false,
      initialCursor: Math.max(0, ROLES.indexOf('standalone'))
    })

    return selected ? selected.value : 'standalone'
  }

  console.log('\nRol del sidecar:')
  ROLES.forEach((role, index) => {
    console.log(`  ${index + 1}. ${ROLE_LABELS[role]}`)
  })

  const answer = await ask(rl, 'Selecciona una opción', '3')
  const index = Number(answer)

  if (Number.isInteger(index) && index >= 1 && index <= ROLES.length) {
    return ROLES[index - 1]
  }

  const direct = normalizeRole(answer)
  if (direct) return direct

  console.log('  Opción no reconocida; se usará "standalone".')
  return 'standalone'
}

function parseSelection(input, count) {
  const value = String(input || '').trim().toLowerCase()

  if (!value || value === 'manual' || value === 'm') return null
  if (value === 'ninguno' || value === 'none' || value === '0') return []
  if (value === 'todos' || value === 'all' || value === '*') {
    return Array.from({ length: count }, (_, index) => index)
  }

  const selected = new Set()

  for (const part of value.split(/[\s,]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/)

    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])

      if (start < 1 || end > count || start > end) {
        throw new Error(`Rango fuera de la lista: ${part}`)
      }

      for (let index = start; index <= end; index += 1) {
        selected.add(index - 1)
      }

      continue
    }

    const index = Number(part)

    if (!Number.isInteger(index) || index < 1 || index > count) {
      throw new Error(`Selección inválida: ${part}`)
    }

    selected.add(index - 1)
  }

  return [...selected].sort((a, b) => a - b)
}

function printGithubRepositories(repositories) {
  console.log('\nRepositorios disponibles en GitHub:')

  repositories.forEach((repository, index) => {
    const visibility = repository.isPrivate ? 'privado' : 'público'
    const owner = repository.owner ? ` · ${repository.owner}` : ''
    console.log(
      `  ${String(index + 1).padStart(2, ' ')}. ${repository.nameWithOwner || repository.name}`
    )
    console.log(`      ${visibility}${owner}`)
  })
}

async function selectGithubRepositories(rl, repositories) {
  if (isInteractiveTerminal()) {
    const selected = await promptSelection(rl, {
      message: `Selecciona repositorios (${repositories.length} disponibles)`,
      choices: repositories.map(repository => ({
        name: `${repository.nameWithOwner || repository.name}${
          repository.isPrivate ? ' [privado]' : ''
        }`,
        value: repository
      })),
      pageSize: 15,
      multiple: true
    })

    if (selected === null) return null
    if (!Array.isArray(selected)) return []
    return selected.map(choice => choice.value).filter(Boolean)
  }

  printGithubRepositories(repositories)

  while (true) {
    const answer = await ask(
      rl,
      '\nSelecciona repositorios por número (ej. 1,3-5), "todos", "ninguno" o "manual"',
      'manual'
    )

    try {
      const indices = parseSelection(answer, repositories.length)
      if (indices === null) return null
      return indices.map(index => repositories[index])
    } catch (error) {
      console.log(`  ${error.message}`)
    }
  }
}

async function filterRepositoriesByOwner(rl, repositories) {
  const owners = [...new Set(repositories.map(repository => repository.owner).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  )

  if (repositories.length <= 20 || owners.length <= 1) return repositories

  if (isInteractiveTerminal()) {
    const choice = await promptSelection(rl, {
      message: `${repositories.length} repositorios de ${owners.length} organizaciones. Filtra por organización`,
      choices: [
        { name: 'Todas las organizaciones', value: null },
        ...owners.map(owner => ({ name: owner, value: owner }))
      ],
      pageSize: 12,
      multiple: false
    })

    if (!choice || !choice.value) return repositories
    return repositories.filter(repository => repository.owner === choice.value)
  }

  console.log('\nOrganizaciones encontradas:')
  console.log('   0. Todas')
  owners.forEach((owner, index) => {
    console.log(`  ${String(index + 1).padStart(2, ' ')}. ${owner}`)
  })

  const answer = await ask(rl, 'Filtra por organización (número o vacío para todas)', 'todas')
  const index = Number(answer)

  if (!Number.isInteger(index) || index < 1 || index > owners.length) {
    return repositories
  }

  return repositories.filter(repository => repository.owner === owners[index - 1])
}

function isSameRemote(left, right) {
  return Boolean(
    left &&
      right &&
      left.nameWithOwner &&
      right.nameWithOwner &&
      String(left.nameWithOwner).toLowerCase() ===
        String(right.nameWithOwner).toLowerCase()
  )
}

function findRepositoryConflict(repository, repositories) {
  return repositories.find(
    item => item.id === repository.id && !isSameRemote(item, repository)
  )
}

async function collectGithubRepositories(
  rl,
  repositories,
  rootDir,
  existingRepositories = []
) {
  const selected = []
  const assigned = [...existingRepositories]

  for (const repository of repositories) {
    const visibility = repository.isPrivate ? 'privado' : 'público'
    console.log(
      `\n${repository.nameWithOwner || repository.name} (${visibility})`
    )

    const role = await chooseRole(rl)
    const mapped = ecosystem.ensureUniqueRepository(
      ecosystem.repositoryFromGithub(repository, role, { rootDir }),
      assigned
    )

    const conflict = findRepositoryConflict(mapped, assigned)

    if (conflict) {
      console.warn(
        `  Conflicto de nombre: ${mapped.nameWithOwner || mapped.name} ya está representado por ${conflict.nameWithOwner || conflict.path}. Se omite para mantener sidecars/${mapped.id}.`
      )
      continue
    }

    assigned.push(mapped)
    selected.push(mapped)
    console.log(`  Asignado: ${mapped.id} (${mapped.role}) -> ${mapped.path}`)
  }

  return selected
}

async function collectManualRepositories(rl, rootDir, existingRepositories = []) {
  const selected = []
  const assigned = [...existingRepositories]

  console.log(
    '\nRegistro manual: usa una URL de GitHub (https://github.com/owner/repo o git@github.com:owner/repo.git) o una ruta local existente.'
  )

  while (true) {
    const input = await ask(rl, '\nURL de GitHub o ruta local (vacío para terminar)')
    if (!input) break

    try {
      const descriptor = ecosystem.parseRepositoryInput(input, { rootDir })
      if (!descriptor) break

      const role = await chooseRole(rl)
      const repository = ecosystem.ensureUniqueRepository(
        ecosystem.repositoryFromDescriptor(descriptor, role, { rootDir }),
        assigned
      )

      const conflict = findRepositoryConflict(repository, assigned)

      if (conflict) {
        console.warn(
          `  Conflicto de nombre: ${repository.nameWithOwner || repository.name} ya está representado por ${conflict.nameWithOwner || conflict.path}. Se omite para mantener sidecars/${repository.id}.`
        )
        continue
      }

      assigned.push(repository)
      selected.push(repository)
      console.log(`  Registrado: ${repository.id} (${repository.role}) -> ${repository.path}`)
    } catch (error) {
      console.log(`  ${error.message}`)
    }
  }

  return selected
}

async function chooseRepositories(rl, rootDir, manualOnly, existingRepositories = []) {
  if (manualOnly) {
    console.log('\nModo manual activado (--manual).')
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  let available

  try {
    console.log('\nConsultando todos los repositorios accesibles con GitHub CLI...')
    available = ecosystem.listGithubRepositories({ rootDir, perPage: 100 })
  } catch (error) {
    console.warn(`\n[setup-wizard] No se pudo consultar GitHub: ${error.message}`)
    console.warn('Se continúa con el registro manual por URL o ruta local.')
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  if (available.length === 0) {
    console.log('\nGitHub no devolvió repositorios para esta cuenta.')
    console.log('Se continúa con el registro manual por URL o ruta local.')
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  const filtered = await filterRepositoriesByOwner(rl, available)
  const selected = await selectGithubRepositories(rl, filtered)

  if (selected === null) {
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  const repositories = await collectGithubRepositories(
    rl,
    selected,
    rootDir,
    existingRepositories
  )

  const addManual = await confirm(
    rl,
    '\n¿Añadir también algún repositorio por URL o ruta local?',
    false
  )

  if (addManual) {
    repositories.push(
      ...(await collectManualRepositories(rl, rootDir, [
        ...existingRepositories,
        ...repositories
      ]))
    )
  }

  return repositories
}

function upsertRepositories(repositories, incoming) {
  for (const repository of incoming) {
    const index = repositories.findIndex(item => item.id === repository.id)

    if (index >= 0) {
      repositories[index] = {
        ...repositories[index],
        ...repository
      }
    } else {
      repositories.push(repository)
    }
  }
}

async function maybeCloneRepositories(rl, repositories, rootDir) {
  const missing = repositories.filter(
    repository =>
      repository.nameWithOwner && !ecosystem.repositoryExists(repository, rootDir)
  )

  if (missing.length === 0) return

  const ghStatus = ecosystem.runGh(['auth', 'status'], { rootDir })

  if (!ghStatus.ok) {
    console.log(
      '\n[setup-wizard] gh no está disponible o no tiene sesión activa; se omite el clonado automático.'
    )
    return
  }

  console.log('\nRepositorios seleccionados sin copia local:')
  for (const repository of missing) {
    console.log(`  - ${repository.nameWithOwner} -> ${repository.path}`)
  }

  const clone = await confirm(
    rl,
    '\n¿Clonarlos ahora con "gh repo clone"?',
    true
  )

  if (!clone) return

  for (const repository of missing) {
    console.log(`\nClonando ${repository.nameWithOwner} en ${repository.path}...`)
    const result = ecosystem.cloneRepository({ repository, rootDir })

    if (result.ok && result.skipped) {
      console.log('  Ya existía localmente; se omite.')
    } else if (result.ok) {
      console.log('  Clonado correctamente.')
    } else {
      console.warn(`  No se pudo clonar: ${result.error}`)
    }
  }
}

function buildUpdatedMap(current, repositories) {
  const registeredIds = new Set(repositories.map(repository => repository.id))
  const previousIds = new Set(
    getRegisteredRepositories(current).map(repository => repository.id)
  )

  const relationships = current.relationships.filter(relationship => {
    const removedSource =
      previousIds.has(relationship.from) && !registeredIds.has(relationship.from)
    const removedTarget =
      previousIds.has(relationship.to) && !registeredIds.has(relationship.to)

    return !removedSource && !removedTarget
  })

  const groups = current.topology.groups
    .map(group => ({
      ...group,
      members: (group.members || []).filter(member => registeredIds.has(member))
    }))
    .filter(group => group.members.length > 0)

  const domains = {}

  for (const repository of repositories) {
    const configuredDomains = Array.isArray(repository.domains) ? repository.domains : []
    domains[repository.id] = configuredDomains.length
      ? configuredDomains
      : (current.domains && current.domains[repository.id]) || []
  }

  return {
    ...current,
    version: current.version || '1.0.0',
    generatedAt: new Date().toISOString().slice(0, 10),
    root: current.root || '.',
    repositories,
    relationships,
    topology: {
      ...current.topology,
      groups
    },
    domains
  }
}

function buildSpecifyProject(repository, existingProject) {
  if (existingProject) {
    return {
      ...existingProject,
      systemMapRepository: repository.id,
      path: repository.path,
      specifyInitDir: existingProject.specifyInitDir || repository.path
    }
  }

  const specs =
    repository.specs && typeof repository.specs === 'object'
      ? repository.specs
      : {
          directory: `${repository.path}/specs`,
          layout: 'feature-folder',
          file: 'spec.md',
          naming: '<feature-number>-<slug>',
          template: null,
          constitution: `${repository.path}/constitution.md`,
          specKitScript: null
        }

  return {
    systemMapRepository: repository.id,
    path: repository.path,
    specifyInitDir: repository.path,
    specs
  }
}

function syncSpecifyConfig(rootDir, repositories) {
  const filePath = path.join(rootDir, SPECIFY_CONFIG_PATH)
  if (!fs.existsSync(filePath)) return null

  let config

  try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.warn(`[setup-wizard] No se pudo leer .specify/config.json: ${error.message}`)
    return null
  }

  const currentProjects =
    config.projects && typeof config.projects === 'object' ? config.projects : {}
  const projects = {}

  for (const repository of repositories) {
    const existingProject =
      currentProjects[repository.id] ||
      Object.values(currentProjects).find(
        project =>
          project &&
          (project.systemMapRepository === repository.id || project.path === repository.path)
      )

    projects[repository.id] = buildSpecifyProject(repository, existingProject)
  }

  config.projects = projects
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  return filePath
}

function printSummary(repositories) {
  if (repositories.length === 0) {
    console.log('\nNo hay sidecars registrados en config/system-map.json.')
    return
  }

  console.log('\nSidecars registrados:')

  for (const repository of repositories) {
    console.log(`  - ${repository.id}`)
    console.log(`      Rol:    ${repository.role}`)
    console.log(`      Ruta:   ${repository.path}`)
    console.log(`      Origen: ${repository.remote || repository.source || 'local'}`)
  }
}

function needsSidecarOnboarding(map, rootDir = ROOT_DIR) {
  return !hasConfiguredSidecars(map) || isCleanWorkspace(rootDir, map)
}

async function runSetupWizard({
  rl,
  rootDir = ROOT_DIR,
  manual = false,
  force = false,
  map = null
} = {}) {
  if (!rl) throw new Error('runSetupWizard requiere una interfaz readline activa.')

  const current = map || readSystemMap(rootDir)
  let repositories = getRegisteredRepositories(current)

  console.log('\n=== brain-corp · Onboarding de sidecars ===\n')

  const provisioned = provisionCoreAssets({ workspaceDir: rootDir })
  const createdAssets = provisioned.filter(result => result.created).length

  if (createdAssets > 0) {
    console.log(
      `[setup-wizard] Assets base desplegados: ${createdAssets} archivo(s) nuevos en .agents/ y .specify/.`
    )
  }

  const clean = isCleanWorkspace(rootDir, current)
  const configured = repositories.length > 0

  if (configured && !clean && !force) {
    console.log('Ya hay sidecars configurados en config/system-map.json.')

    const add = await confirm(rl, '¿Registrar sidecars adicionales?', false)

    if (!add) {
      printSummary(repositories)
      return current
    }
  } else {
    const register = await confirm(
      rl,
      '\n¿Deseas registrar repositorios/sidecars en este workspace?',
      true
    )

    if (!register) {
      if (!configured) {
        console.log('\nWorkspace inicializado sin sidecars. Podrás registrarlos luego con "brain setup".')
      }
      return current
    }

    if (configured) {
      const replace = await confirm(
        rl,
        'La configuración actual parece no corresponder a este workspace. ¿Reemplazar la lista de sidecars?',
        clean
      )

      if (replace) repositories = []
    }
  }

  const incoming = await chooseRepositories(rl, rootDir, manual, repositories)
  upsertRepositories(repositories, incoming)

  await maybeCloneRepositories(rl, repositories, rootDir)

  const next = buildUpdatedMap(current, repositories)
  writeSystemMap(rootDir, next)

  if (syncSpecifyConfig(rootDir, repositories)) {
    console.log('\nEnrutamiento de spec-kit actualizado en .specify/config.json.')
  }

  printSummary(repositories)
  console.log('\nSiguiente paso: "brain init" o "npm run init-brain".')

  return next
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  try {
    await runSetupWizard({ rl, manual: args.manual, force: args.force })
  } finally {
    rl.close()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[setup-wizard] ${error.message}`)
    process.exit(1)
  })
}

module.exports = {
  needsSidecarOnboarding,
  parseSelection,
  promptSelection,
  runSetupWizard,
  syncSpecifyConfig
}
