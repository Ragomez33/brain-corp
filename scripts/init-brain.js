#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const readline = require('node:readline/promises')

const ROOT_DIR = path.resolve(__dirname, '..')
const CONFIG_PATH = path.join(ROOT_DIR, '.brainrc.json')
const SYNC_PULL_PATH = path.join(__dirname, 'sync-pull.js')
const WATCH_PATH = path.join(__dirname, 'watch-github.js')
const WATCH_LOG = '.agents/watch.log'

const AGENTS = [
  { value: 'opencode', label: 'opencode' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'custom', label: 'Personalizado' }
]

function fail(message) {
  console.error(`\n[init-brain] ${message}`)
  process.exit(1)
}

function runGh(args, { allowFailure = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8' })

  if (result.error) {
    if (allowFailure) return null
    fail('No se encontró el CLI de GitHub (gh). Instálalo desde https://cli.github.com/.')
  }

  if (result.status !== 0) {
    if (allowFailure) return null
    const stderr = (result.stderr || '').trim()
    fail(stderr || `El comando "gh ${args.join(' ')}" falló.`)
  }

  return (result.stdout || '').trim()
}

function assertGhSession() {
  const status = runGh(['auth', 'status'], { allowFailure: true })

  if (status === null) {
    fail('El CLI de GitHub no tiene una sesión activa. Ejecuta "gh auth login" y vuelve a intentar.')
  }
}

function getGithubUser() {
  const user = runGh(['api', 'user', '--jq', '.login'])

  if (!user) {
    fail('No se pudo obtener el usuario autenticado de GitHub.')
  }

  return user
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null

  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch (error) {
    fail(`.brainrc.json existe pero no es JSON válido: ${error.message}`)
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
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
  console.log('\nMotor de agente CLI para esta sesión:')

  AGENTS.forEach((agent, index) => {
    const isDefault = agent.value === defaultValue ? ' (por defecto)' : ''
    console.log(`  ${index + 1}. ${agent.label}${isDefault}`)
  })

  const defaultIndex = AGENTS.findIndex(agent => agent.value === defaultValue)
  const answer = await ask(rl, 'Selecciona una opción', String(defaultIndex >= 0 ? defaultIndex + 1 : 1))

  const index = Number(answer)

  if (Number.isInteger(index) && index >= 1 && index <= AGENTS.length) {
    const selected = AGENTS[index - 1]
    if (selected.value !== 'custom') return selected.value

    const custom = await ask(rl, 'Nombre del agente personalizado', 'opencode')
    return custom || 'opencode'
  }

  const direct = AGENTS.find(agent => agent.value === answer.toLowerCase())
  return direct ? direct.value : 'opencode'
}

async function askProject(rl, githubUser) {
  while (true) {
    const raw = await ask(
      rl,
      'Project ID o URL del GitHub Project Kanban (vacío para omitir)'
    )

    if (!raw) {
      return { projectId: null, projectOwner: null }
    }

    const parsed = parseProjectInput(raw)

    if (!parsed) {
      console.log('  Formato no reconocido. Usa un número o una URL como https://github.com/orgs/MiOrg/projects/5')
      continue
    }

    const owner =
      parsed.projectOwner || (await ask(rl, 'Propietario del Project (usuario u organización)', githubUser))

    const validation = runGh(
      ['project', 'view', String(parsed.projectId), '--owner', owner, '--format', 'json'],
      { allowFailure: true }
    )

    if (validation === null) {
      console.log('  Aviso: no se pudo verificar el Project (puede faltar el scope "project"). Se guardará igualmente.')
    }

    return { projectId: parsed.projectId, projectOwner: owner }
  }
}

function runSyncPull() {
  console.log('\nSincronizando tickets desde GitHub (sync-pull)...')

  const result = spawnSync(process.execPath, [SYNC_PULL_PATH], {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.status !== 0) {
    console.warn(
      '[init-brain] sync-pull no pudo completarse. Se continúa con el estado local.'
    )
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
    console.log(`\nWatcher ya activo (PID ${previousPid}).`)
    return config
  }

  if (previousPid) {
    delete config.lastSession.watchPid
    config.lastSession.watch = false
  }

  const answer = await ask(rl, '\n¿Activar watcher en tiempo real (cada 45s)? (s/N)', 'n')
  const enabled = ['s', 'si', 'sí', 'y', 'yes'].includes(answer.toLowerCase())

  const now = new Date().toISOString()
  config.lastSession = {
    ...(config.lastSession || {}),
    watch: enabled,
    updatedAt: now
  }

  if (!enabled) {
    config.updatedAt = now
    writeConfig(config)
    console.log('Watcher no activado.')
    return config
  }

  fs.mkdirSync(path.join(ROOT_DIR, '.agents'), { recursive: true })

  const child = spawn(
    process.execPath,
    [WATCH_PATH, '--log', WATCH_LOG],
    {
      cwd: ROOT_DIR,
      detached: true,
      stdio: 'ignore'
    }
  )

  child.unref()

  config.lastSession.watchPid = child.pid
  config.updatedAt = now
  writeConfig(config)

  console.log(`Watcher iniciado en segundo plano (PID ${child.pid}). Log: ${WATCH_LOG}`)

  return config
}

async function onboard(rl) {
  console.log('\n=== brain-corp · Onboarding inicial ===\n')

  assertGhSession()
  const githubUser = getGithubUser()
  console.log(`Usuario de GitHub detectado: ${githubUser}`)

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

  console.log('\nConfiguración guardada en .brainrc.json:')
  console.log(`  GitHub user:     ${githubUser}`)
  console.log(`  Project:         ${projectId ? `#${projectId} (${projectOwner})` : 'sin configurar'}`)
  console.log(`  Agente por defecto: ${defaultAgent}`)

  return config
}

async function sessionMenu(rl, config) {
  console.log('\n=== brain-corp · Sesión ===\n')
  console.log(`Usuario: ${config.githubUser}`)
  console.log(`Project: ${config.projectId ? `#${config.projectId} (${config.projectOwner})` : 'sin configurar'}`)

  const agent = await chooseAgent(rl, config.defaultAgent || 'opencode')

  const focus = await ask(
    rl,
    '\nFoco de la sesión (módulo, tarea o sidecar; vacío = análisis global)',
    'análisis global'
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

  console.log('\nSesión configurada:')
  console.log(`  Agente: ${agent}`)
  console.log(`  Foco:   ${focus}`)
  console.log('\nSugerencia: usa /analyze <tema> para abrir un ticket o el flujo nativo de spec-kit (/speckit.specify) apuntando a .agents/tickets/<estado>/TICK-XXX.md para generar una spec.')

  return config
}

function stopWatcher(config) {
  const lastSession = config && config.lastSession
  const pid = lastSession && lastSession.watchPid

  if (isProcessAlive(pid)) {
    try {
      process.kill(Number(pid), 'SIGTERM')
      console.log(`\nWatcher detenido (PID ${pid}).`)
    } catch (error) {
      console.warn(`\n[init-brain] No se pudo detener el watcher (PID ${pid}): ${error.message}`)
    }
  }

  if (lastSession && ('watchPid' in lastSession || lastSession.watch)) {
    delete lastSession.watchPid
    lastSession.watch = false
    config.updatedAt = new Date().toISOString()

    try {
      writeConfig(config)
    } catch (error) {
      console.warn(`[init-brain] No se pudo actualizar .brainrc.json: ${error.message}`)
    }
  }
}

function launchAgent(config) {
  const agent = (config && config.defaultAgent) || 'opencode'

  console.log(`\nLanzando ${agent}...`)

  return new Promise((resolve, reject) => {
    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      stopWatcher(config)
    }

    const child = spawn(agent, [], {
      cwd: ROOT_DIR,
      stdio: 'inherit'
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
        // El proceso ya terminó.
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
          `No se pudo lanzar el agente "${agent}": ${error.message}. Verifica que esté instalado y disponible en el PATH.`
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
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let config

  try {
    runSyncPull()

    const existing = readConfig()
    config = existing ? await sessionMenu(rl, existing) : await onboard(rl)

    await maybeStartWatcher(rl, config)
  } finally {
    rl.close()
  }

  const exitCode = await launchAgent(config)
  process.exitCode = exitCode
}

main().catch(error => fail(error.stack || error.message))
