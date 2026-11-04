#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const ROOT_DIR = process.cwd()
const SYNC_PULL = path.join(__dirname, 'sync-pull.js')
const NORMALIZE = path.join(__dirname, 'normalize-ticket.js')

function parseArgs(argv) {
  const args = {
    intervalSeconds: Number(process.env.WATCH_INTERVAL_SECONDS || 45),
    once: false,
    logFile: null
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--once') args.once = true
    else if (current === '--interval') {
      args.intervalSeconds = Number(argv[index + 1])
      index += 1
    } else if (current === '--log') {
      args.logFile = argv[index + 1]
      index += 1
    } else {
      console.error(`[watch-github] Argumento no reconocido: ${current}`)
      process.exit(1)
    }
  }

  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds <= 0) {
    console.error('[watch-github] El intervalo debe ser un número positivo de segundos.')
    process.exit(1)
  }

  return args
}

const args = parseArgs(process.argv.slice(2))
const logStream = args.logFile
  ? fs.createWriteStream(path.resolve(ROOT_DIR, args.logFile), { flags: 'a' })
  : null

function log(message) {
  const line = `[watch-github] ${new Date().toISOString()} ${message}`
  console.log(line)
  if (logStream) logStream.write(`${line}\n`)
}

function runScript(scriptPath, scriptArgs = []) {
  return spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: ROOT_DIR,
    encoding: 'utf8'
  })
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

function tick() {
  log('Iniciando sync-pull...')

  const pull = runScript(SYNC_PULL)

  if (pull.status !== 0) {
    log(`sync-pull terminó con código ${pull.status}.`)
    printResult(pull)
    return
  }

  const pullOutput = (pull.stdout || '').trim()
  if (pullOutput) log(`sync-pull: ${pullOutput.split('\n').pop()}`)

  const pendingResult = runScript(NORMALIZE, ['--json'])

  if (pendingResult.status !== 0) {
    log('No se pudo consultar la lista de tickets pendientes.')
    printResult(pendingResult)
    return
  }

  let pending = []

  try {
    pending = JSON.parse(pendingResult.stdout || '[]')
  } catch {
    log('Salida JSON inválida al consultar tickets pendientes.')
    return
  }

  if (pending.length === 0) {
    log('Sin tickets pendientes de normalización.')
    return
  }

  log(`Detectados ${pending.length} ticket(s) con "needs_formatting". Normalizando...`)

  const normalizeResult = runScript(NORMALIZE, ['--auto'])

  printResult(normalizeResult)

  if (normalizeResult.status !== 0) {
    log(`normalize-ticket terminó con código ${normalizeResult.status}.`)
  } else {
    log('Normalización completada.')
  }
}

function scheduleNext() {
  if (args.once) {
    log('Modo --once completado.')
    if (logStream) logStream.end()
    return
  }

  log(`Próximo ciclo en ${args.intervalSeconds}s.`)
  setTimeout(() => {
    tick()
    scheduleNext()
  }, args.intervalSeconds * 1000)
}

function shutdown(signal) {
  log(`Recibida señal ${signal}; deteniendo watcher.`)
  if (logStream) logStream.end()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

log(`Watcher iniciado (intervalo ${args.intervalSeconds}s, raíz ${ROOT_DIR}).`)
tick()
scheduleNext()
