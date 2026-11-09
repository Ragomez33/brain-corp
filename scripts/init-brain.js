#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const readline = require('node:readline/promises')
const { buildCommand, buildNodeCommand } = require('./lib/shell')
const { confirm, isInteractiveTerminal, promptSelection } = require('./lib/prompts')
const { provisionAgentAssets } = require('./lib/agent-provision')
const { hydrateSidecars } = require('./lib/hydrate')
const {
  checkCliForUpdate,
  installUpdate,
  isUpdateCheckDisabled
} = require('./lib/update-check')
const {
  getRegisteredRepositories,
  readSystemMap,
  systemMapPath
} = require('./lib/system-map')
const { runSetupWizard } = require('./setup-wizard')
const { normalizeLanguage, resolveLanguage, setLanguage } = require('./lib/config')
const { t } = require('./lib/i18n')

// El workspace es siempre el directorio desde el que se invoca el CLI.
const ROOT_DIR = process.cwd()
const CONFIG_PATH = path.join(ROOT_DIR, '.brainrc.json')
const SYNC_PULL_PATH = path.join(__dirname, 'sync-pull.js')
const WATCH_PATH = path.join(__dirname, 'watch-github.js')

const AGENTS = [
  { value: 'opencode', label: 'opencode' },
  { value: 'claude', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'custom', labelKey: 'init.customAgentLabel' }
]

function agentLabel(agent) {
  return agent.labelKey ? t(agent.labelKey) : agent.label
}

async function chooseLanguage(rl) {
  const current = resolveLanguage(ROOT_DIR)
  const flagIndex = process.argv.indexOf('--lang')
  const requested = flagIndex !== -1 ? process.argv[flagIndex + 1] : null

  if (requested) {
    const normalized = normalizeLanguage(requested)
    if (!normalized) {
      console.warn(t('language.invalid'))
    } else {
      setLanguage(ROOT_DIR, normalized)
      console.log(t('language.saved', { lang: normalized }))
      return normalized
    }
  }

  if (!isInteractiveTerminal()) {
    setLanguage(ROOT_DIR, current)
    return current
  }

  const selected = await promptSelection(rl, {
    message: t('language.prompt', {}, 'en'),
    choices: [
      { name: t('language.en', {}, 'en'), value: 'en' },
      { name: t('language.es', {}, 'es'), value: 'es' }
    ],
    pageSize: 2,
    multiple: false,
    initialCursor: current === 'es' ? 1 : 0
  })

  const language = selected ? selected.value : current
  setLanguage(ROOT_DIR, language)
  console.log(t('language.saved', { lang: language }))
  return language
}

function fail(message) {
  console.error(`\n[init-brain] ${message}`)
  process.exit(1)
}

async function maybeOfferUpdate(rl, updateCheck) {
  let result

  try {
    result = await updateCheck
  } catch {
    // The update check is optional and must never interrupt init.
    return
  }

  if (!result || !result.updateAvailable) return

  console.log(
    t('update.available', {
      current: result.currentVersion,
      latest: result.latestVersion
    })
  )

  if (!isInteractiveTerminal()) {
    console.log(t('update.commandHint', { command: result.installCommand }))
    return
  }

  const accepted = await confirm(
    rl,
    t('update.prompt', { latest: result.latestVersion }),
    false
  )

  if (!accepted) {
    console.log(t('update.skipped'))
    return
  }

  console.log(t('update.installing', { latest: result.latestVersion }))

  const installed = installUpdate({
    packageName: result.packageName,
    version: result.latestVersion
  })

  if (installed.ok) {
    console.log(t('update.installed', { latest: result.latestVersion }))
    return
  }

  console.warn(t('update.failed', { error: installed.error }))
  console.log(t('update.commandHint', { command: result.installCommand }))
}

function runGh(args, { allowFailure = false } = {}) {
  const result = spawnSync(buildCommand('gh', args), {
    encoding: 'utf8',
    shell: true
  })

  if (result.error) {
    if (allowFailure) return null
    fail(t('init.ghMissing'))
  }

  if (result.status !== 0) {
    if (allowFailure) return null
    const stderr = (result.stderr || '').trim()
    fail(stderr || t('init.ghFailed', { command: args.join(' ') }))
  }

  return (result.stdout || '').trim()
}

function assertGhSession() {
  const status = runGh(['auth', 'status'], { allowFailure: true })

  if (status === null) {
    fail(t('init.ghSession'))
  }
}

function getGithubUser() {
  const user = runGh(['api', 'user', '--jq', '.login'])

  if (!user) {
    fail(t('init.ghUser'))
  }

  return user
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null

  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch (error) {
    fail(t('init.badConfig', { error: error.message }))
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function hasValidSidecars(map) {
  return getRegisteredRepositories(map).some(
    repository => repository && repository.id && repository.path
  )
}

function parseProjectInput(input) {
  const value = input.trim()

  if (/^\d+$/.test(value)) {
    return { projectId: Number(value), projectOwner: null }
  }

  const urlMatch = value.match(/github\.com\/(?:orgs|users)\/([^/]+)\/projects\/(\d+)/i)
  if (urlMatch) {
    return { projectId: Number(urlMatch[2]), projectOwner: urlMatch[1] }
  }

  const shortMatch = value.match(/^([\w.-]+)\/(\d+)$/)
  if (shortMatch) {
    return { projectId: Number(shortMatch[2]), projectOwner: shortMatch[1] }
  }

  return null
}

async function ask(rl, question, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()

  return answer || defaultValue
}

async function chooseAgent(rl, defaultValue) {
  const defaultIndex = Math.max(
    0,
    AGENTS.findIndex(agent => agent.value === defaultValue)
  )

  if (isInteractiveTerminal()) {
    const selected = await promptSelection(rl, {
      message: t('init.agentsHeading'),
      choices: AGENTS.map(agent => ({ name: agentLabel(agent), value: agent.value })),
      pageSize: AGENTS.length,
      multiple: false,
      initialCursor: defaultIndex
    })

    const value = selected ? selected.value : defaultValue || 'opencode'

    if (value !== 'custom') return value

    const custom = await ask(rl, t('init.customAgentPrompt'), 'opencode')
    return custom || 'opencode'
  }

  console.log(`\n${t('init.agentsHeading')}:`)

  AGENTS.forEach((agent, index) => {
    const isDefault = agent.value === defaultValue ? ` ${t('init.defaultSuffix')}` : ''
    console.log(`  ${index + 1}. ${agentLabel(agent)}${isDefault}`)
  })

  const answer = await ask(rl, t('init.selectOption'), String(defaultIndex + 1))
  const index = Number(answer)

  if (Number.isInteger(index) && index >= 1 && index <= AGENTS.length) {
    const selected = AGENTS[index - 1]
    if (selected.value !== 'custom') return selected.value

    const custom = await ask(rl, t('init.customAgentPrompt'), 'opencode')
    return custom || 'opencode'
  }

  const direct = AGENTS.find(agent => agent.value === answer.toLowerCase())
  return direct ? direct.value : 'opencode'
}

async function askProject(rl, githubUser) {
  while (true) {
    const raw = await ask(
      rl,
      t('init.projectPrompt')
    )

    if (!raw) {
      return { projectId: null, projectOwner: null }
    }

    const parsed = parseProjectInput(raw)

    if (!parsed) {
      console.log(t('init.projectFormat'))
      continue
    }

    const owner =
      parsed.projectOwner || (await ask(rl, t('init.projectOwnerPrompt'), githubUser))

    const validation = runGh(
      ['project', 'view', String(parsed.projectId), '--owner', owner, '--format', 'json'],
      { allowFailure: true }
    )

    if (validation === null) {
      console.log(t('init.projectWarning'))
    }

    return { projectId: parsed.projectId, projectOwner: owner }
  }
}

function runSyncPull() {
  console.log(`\n${t('init.syncPull')}`)

  const result = spawnSync(buildNodeCommand(SYNC_PULL_PATH), {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    shell: true
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    console.warn(t('init.syncPullFailed'))
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false

  try {
    process.kill(Number(pid), 0)
    return true
  } catch {
    return false
  }
}

async function maybeStartWatcher(rl, config) {
  const previousPid = config.lastSession && config.lastSession.watchPid

  if (isProcessAlive(previousPid)) {
    console.log(`\n${t('init.watcherActive', { pid: previousPid })}`)
    return config
  }

  if (previousPid) {
    delete config.lastSession.watchPid
    config.lastSession.watch = false
  }

  const enabled = await confirm(
    rl,
    `\n${t('init.watcherPrompt')}`,
    false
  )

  const now = new Date().toISOString()
  config.lastSession = {
    ...(config.lastSession || {}),
    watch: enabled,
    updatedAt: now
  }

  if (!enabled) {
    config.updatedAt = now
    writeConfig(config)
    console.log(t('init.watcherOff'))
    return config
  }

  fs.mkdirSync(path.join(ROOT_DIR, '.agents'), { recursive: true })

  const child = spawn(buildNodeCommand(WATCH_PATH), {
    cwd: ROOT_DIR,
    detached: true,
    stdio: 'ignore',
    // shell: true permite lanzar node y sus wrappers correctamente en Windows.
    shell: true
  })

  child.unref()

  config.lastSession.watchPid = child.pid
  config.updatedAt = now
  writeConfig(config)

  console.log(t('init.watcherStarted', { pid: child.pid }))

  return config
}

async function onboard(rl) {
  console.log(`\n${t('init.onboardingTitle')}\n`)

  assertGhSession()
  const githubUser = getGithubUser()
  console.log(t('init.githubUserDetected', { user: githubUser }))

  const { projectId, projectOwner } = await askProject(rl, githubUser)
  const defaultAgent = await chooseAgent(rl, 'opencode')

  const now = new Date().toISOString()
  const config = {
    version: 1,
    githubUser,
    projectId,
    projectOwner,
    defaultAgent,
    createdAt: now,
    updatedAt: now
  }

  writeConfig(config)

  console.log(`\n${t('init.configSaved')}`)
  console.log(`  ${t('init.githubUser')}:     ${githubUser}`)
  console.log(`  ${t('init.project')}:         ${projectId ? `#${projectId} (${projectOwner})` : t('init.notConfigured')}`)
  console.log(`  ${t('init.defaultAgent')}: ${defaultAgent}`)

  return config
}

async function sessionMenu(rl, config) {
  console.log(`\n${t('init.sessionTitle')}\n`)
  console.log(`${t('init.user')}: ${config.githubUser}`)
  console.log(`${t('init.project')}: ${config.projectId ? `#${config.projectId} (${config.projectOwner})` : t('init.notConfigured')}`)

  const agent = await chooseAgent(rl, config.defaultAgent || 'opencode')

  const focus = await ask(
    rl,
    `\n${t('init.focusPrompt')}`,
    t('init.globalAnalysis')
  )

  const now = new Date().toISOString()
  config.defaultAgent = agent
  config.lastSession = {
    agent,
    focus,
    updatedAt: now
  }
  config.updatedAt = now

  writeConfig(config)

  console.log(`\n${t('init.sessionConfigured')}`)
  console.log(`  ${t('init.agent')}: ${agent}`)
  console.log(`  ${t('init.focus')}:   ${focus}`)
  console.log(`\n${t('init.suggestion')}`)

  return config
}

function stopWatcher(config) {
  const lastSession = config && config.lastSession
  const pid = lastSession && lastSession.watchPid

  if (isProcessAlive(pid)) {
    try {
      process.kill(Number(pid), 'SIGTERM')
      console.log(`\n${t('init.watcherStopped', { pid })}`)
    } catch (error) {
      console.warn(t('init.watcherStopError', { pid, error: error.message }))
    }
  }

  if (lastSession && ('watchPid' in lastSession || lastSession.watch)) {
    delete lastSession.watchPid
    lastSession.watch = false
    config.updatedAt = new Date().toISOString()

    try {
      writeConfig(config)
    } catch (error) {
      console.warn(`[init-brain] ${t('init.badConfig', { error: error.message })}`)
    }
  }
}

function launchAgent(config) {
  const agent = (config && config.defaultAgent) || 'opencode'

  console.log(`\n${t('init.launching', { agent })}`)

  return new Promise((resolve, reject) => {
    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      stopWatcher(config)
    }

    const child = spawn(buildCommand(agent), {
      cwd: process.cwd(),
      stdio: 'inherit',
      // shell: true permite resolver los wrappers .cmd/.bat de Windows
      // (opencode.cmd, agy.cmd, etc.) y evita el error ENOENT.
      shell: true
    })

    const removeSignalHandlers = () => {
      process.removeListener('SIGINT', onSigint)
      process.removeListener('SIGTERM', onSigterm)
    }

    const shutdown = (signal, code) => {
      cleanup()
      removeSignalHandlers()

      try {
        if (child.exitCode === null && !child.killed) child.kill(signal)
      } catch {
        // The process already exited.
      }

      process.exit(code)
    }

    function onSigint() {
      shutdown('SIGINT', 130)
    }

    function onSigterm() {
      shutdown('SIGTERM', 143)
    }

    process.once('SIGINT', onSigint)
    process.once('SIGTERM', onSigterm)

    child.on('error', error => {
      removeSignalHandlers()
      cleanup()
      reject(
        new Error(
          t('init.launchError', { agent, error: error.message })
        )
      )
    })

    child.on('exit', (code, signal) => {
      removeSignalHandlers()
      cleanup()
      resolve(signal ? 128 : typeof code === 'number' ? code : 0)
    })
  })
}

async function main() {
  // Start the NPM check immediately but never block the init flow on it.
  const updateCheck = isUpdateCheckDisabled()
    ? Promise.resolve(null)
    : checkCliForUpdate()

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let config

  try {
    await chooseLanguage(rl)
    await maybeOfferUpdate(rl, updateCheck)

    const manualSetup = process.argv.includes('--manual')
    const mapPath = systemMapPath(ROOT_DIR)
    let systemMap = readSystemMap(ROOT_DIR)
    const configured = fs.existsSync(mapPath) && hasValidSidecars(systemMap)

    if (!configured) {
      console.log(t('init.workspaceMissing'))
      console.log(t('init.setupStarting'))

      await runSetupWizard({
        rl,
        rootDir: ROOT_DIR,
        map: systemMap,
        manual: manualSetup
      })

      systemMap = readSystemMap(ROOT_DIR)

      if (!hasValidSidecars(systemMap)) {
        throw new Error(t('init.sidecarsMissing'))
      }
    }

    // Auto-hydration: on a fresh clone of the container repo, sidecars may be
    // registered in the topology map but absent on disk. Clone only what is
    // missing; already initialized repositories are never overwritten.
    const hydration = hydrateSidecars({ rootDir: ROOT_DIR, map: systemMap })

    if (hydration.failed > 0) {
      console.warn(t('init.hydrateFailed', { failed: hydration.failed }))
    }

    runSyncPull()

    const existing = readConfig()
    config = existing ? await sessionMenu(rl, existing) : await onboard(rl)

    const provisioned = provisionAgentAssets({
      agent: config.defaultAgent,
      workspaceDir: ROOT_DIR
    })

    console.log(
      t('init.assetsVerified', {
        created: provisioned.created.length,
        skipped: provisioned.skipped.length
      })
    )
    console.log(t('init.assetsDeployed', { dir: ROOT_DIR }))

    await maybeStartWatcher(rl, config)
  } finally {
    rl.close()
  }

  const exitCode = await launchAgent(config)
  process.exitCode = exitCode
}

main().catch(error => fail(error.stack || error.message))
