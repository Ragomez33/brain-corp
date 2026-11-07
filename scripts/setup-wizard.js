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

const { t } = require('./lib/i18n')

const ROLE_LABELS = {
  provider: 'setup.roleProvider',
  client: 'setup.roleClient',
  standalone: 'setup.roleStandalone'
}

function roleLabel(role) {
  return t(ROLE_LABELS[role])
}

function printHelp() {
  console.log(t('setup.help'))
}

function parseArgs(argv) {
  const args = { manual: false, force: false, help: false }

  for (const current of argv) {
    if (current === '--manual') args.manual = true
    else if (current === '--force') args.force = true
    else if (current === '--help' || current === '-h') args.help = true
    else throw new Error(t('setup.unknownArg', { arg: current }))
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
    name: roleLabel(role),
    value: role
  }))

  if (isInteractiveTerminal()) {
    const selected = await promptSelection(rl, {
      message: t('setup.rolePrompt'),
      choices,
      pageSize: ROLES.length,
      multiple: false,
      initialCursor: Math.max(0, ROLES.indexOf('standalone'))
    })

    return selected ? selected.value : 'standalone'
  }

  console.log(`\n${t('setup.roleHeading')}`)
  ROLES.forEach((role, index) => {
    console.log(`  ${index + 1}. ${roleLabel(role)}`)
  })

  const answer = await ask(rl, t('setup.selectOption'), '3')
  const index = Number(answer)

  if (Number.isInteger(index) && index >= 1 && index <= ROLES.length) {
    return ROLES[index - 1]
  }

  const direct = normalizeRole(answer)
  if (direct) return direct

  console.log(t('setup.roleFallback'))
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
        throw new Error(t('setup.rangeOutOfList', { part }))
      }

      for (let index = start; index <= end; index += 1) {
        selected.add(index - 1)
      }

      continue
    }

    const index = Number(part)

    if (!Number.isInteger(index) || index < 1 || index > count) {
      throw new Error(t('setup.invalidSelection', { part }))
    }

    selected.add(index - 1)
  }

  return [...selected].sort((a, b) => a - b)
}

function printGithubRepositories(repositories) {
  console.log(`\n${t('setup.githubReposHeading')}`)

  repositories.forEach((repository, index) => {
    const visibility = repository.isPrivate ? t('setup.private') : t('setup.public')
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
      message: t('setup.selectReposPrompt', { count: repositories.length }),
      choices: repositories.map(repository => ({
        name: `${repository.nameWithOwner || repository.name}${
          repository.isPrivate ? ` [${t('setup.private')}]` : ''
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
      t('setup.manualSelectionPrompt'),
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
      message: t('setup.filterOwnersPrompt', {
        repos: repositories.length,
        owners: owners.length
      }),
      choices: [
        { name: t('setup.allOwners'), value: null },
        ...owners.map(owner => ({ name: owner, value: owner }))
      ],
      pageSize: 12,
      multiple: false
    })

    if (!choice || !choice.value) return repositories
    return repositories.filter(repository => repository.owner === choice.value)
  }

  console.log(`\n${t('setup.ownersHeading')}`)
  console.log(`   0. ${t('setup.allOwners')}`)
  owners.forEach((owner, index) => {
    console.log(`  ${String(index + 1).padStart(2, ' ')}. ${owner}`)
  })

  const answer = await ask(rl, t('setup.filterOwnersInput'), 'todas')
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
    const visibility = repository.isPrivate ? t('setup.private') : t('setup.public')
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
        t('setup.conflict', {
          name: mapped.nameWithOwner || mapped.name,
          existing: conflict.nameWithOwner || conflict.path,
          id: mapped.id
        })
      )
      continue
    }

    assigned.push(mapped)
    selected.push(mapped)
    console.log(t('setup.assigned', { id: mapped.id, role: mapped.role, path: mapped.path }))
  }

  return selected
}

async function collectManualRepositories(rl, rootDir, existingRepositories = []) {
  const selected = []
  const assigned = [...existingRepositories]

  console.log(
    `\n${t('setup.manualHeading')}`
  )

  while (true) {
    const input = await ask(rl, `\n${t('setup.manualInputPrompt')}`)
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
          t('setup.conflict', {
            name: repository.nameWithOwner || repository.name,
            existing: conflict.nameWithOwner || conflict.path,
            id: repository.id
          })
        )
        continue
      }

      assigned.push(repository)
      selected.push(repository)
      console.log(t('setup.registered', {
        id: repository.id,
        role: repository.role,
        path: repository.path
      }))
    } catch (error) {
      console.log(`  ${error.message}`)
    }
  }

  return selected
}

async function chooseRepositories(rl, rootDir, manualOnly, existingRepositories = []) {
  if (manualOnly) {
    console.log(`\n${t('setup.manualMode')}`)
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  let available

  try {
    console.log(`\n${t('setup.queryingGithub')}`)
    available = ecosystem.listGithubRepositories({ rootDir, perPage: 100 })
  } catch (error) {
    console.warn(`\n${t('setup.githubQueryError', { error: error.message })}`)
    console.warn(t('setup.continueManual'))
    return collectManualRepositories(rl, rootDir, existingRepositories)
  }

  if (available.length === 0) {
    console.log(`\n${t('setup.githubNoRepos')}`)
    console.log(t('setup.continueManual'))
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
    `\n${t('setup.addManualPrompt')}`,
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
      `\n${t('setup.ghUnavailableClone')}`
    )
    return
  }

  console.log(`\n${t('setup.reposWithoutLocal')}`)
  for (const repository of missing) {
    console.log(`  - ${repository.nameWithOwner} -> ${repository.path}`)
  }

  const clone = await confirm(
    rl,
    `\n${t('setup.clonePrompt')}`,
    true
  )

  if (!clone) return

  for (const repository of missing) {
    console.log(`\n${t('setup.cloning', { repo: repository.nameWithOwner, path: repository.path })}`)
    const result = ecosystem.cloneRepository({ repository, rootDir })

    if (result.ok && result.skipped) {
      console.log(t('setup.cloneExists'))
    } else if (result.ok) {
      console.log(t('setup.cloneOk'))
    } else {
      console.warn(t('setup.cloneError', { error: result.error }))
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

function printSummary(repositories) {
  if (repositories.length === 0) {
    console.log(`\n${t('setup.noSidecars')}`)
    return
  }

  console.log(`\n${t('setup.registeredHeading')}`)

  for (const repository of repositories) {
    console.log(`  - ${repository.id}`)
    console.log(`      ${t('setup.roleLabel')}:   ${repository.role}`)
    console.log(`      ${t('setup.pathLabel')}:   ${repository.path}`)
    console.log(`      ${t('setup.originLabel')}: ${repository.remote || repository.source || 'local'}`)
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
  if (!rl) throw new Error(t('setup.readlineRequired'))

  const current = map || readSystemMap(rootDir)
  let repositories = getRegisteredRepositories(current)

  console.log(`\n${t('setup.onboardingTitle')}\n`)

  const provisioned = provisionCoreAssets({ workspaceDir: rootDir })
  const createdAssets = provisioned.filter(result => result.created).length

  if (createdAssets > 0) {
    console.log(
      t('setup.assetsDeployed', { count: createdAssets })
    )
  }

  const clean = isCleanWorkspace(rootDir, current)
  const configured = repositories.length > 0

  if (configured && !clean && !force) {
    console.log(t('setup.alreadyConfigured'))

    const add = await confirm(rl, t('setup.addSidecarsPrompt'), false)

    if (!add) {
      printSummary(repositories)
      return current
    }
  } else {
    const register = await confirm(
      rl,
      `\n${t('setup.registerPrompt')}`,
      true
    )

    if (!register) {
      if (!configured) {
        console.log(`\n${t('setup.workspaceNoSidecars')}`)
      }
      return current
    }

    if (configured) {
      const replace = await confirm(
        rl,
        t('setup.replacePrompt'),
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

  printSummary(repositories)
  console.log(`\n${t('setup.nextStep')}`)

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
  runSetupWizard
}
