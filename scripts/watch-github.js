#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { t } = require('./lib/i18n')

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
      console.error(t('watch.unknownArg', { arg: current }))
      process.exit(1)
    }
  }

  if (!Number.isFinite(args.intervalSeconds) || args.intervalSeconds <= 0) {
    console.error(t('watch.invalidInterval'))
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
  log('Starting sync-pull...')

  const pull = runScript(SYNC_PULL)

  if (pull.status !== 0) {
    log(`sync-pull exited with code ${pull.status}.`)
    printResult(pull)
    return
  }

  const pullOutput = (pull.stdout || '').trim()
  if (pullOutput) log(`sync-pull: ${pullOutput.split('\n').pop()}`)

  const pendingResult = runScript(NORMALIZE, ['--json'])

  if (pendingResult.status !== 0) {
    log('Could not query the pending ticket list.')
    printResult(pendingResult)
    return
  }

  let pending = []

  try {
    pending = JSON.parse(pendingResult.stdout || '[]')
  } catch {
    log('Invalid JSON output while querying pending tickets.')
    return
  }

  if (pending.length === 0) {
    log('No tickets pending normalization.')
    return
  }

  log(`Detected ${pending.length} ticket(s) with "needs_formatting". Normalizing...`)

  const normalizeResult = runScript(NORMALIZE, ['--auto'])

  printResult(normalizeResult)

  if (normalizeResult.status !== 0) {
    log(`normalize-ticket exited with code ${normalizeResult.status}.`)
  } else {
    log('Normalization completed.')
  }
}

function scheduleNext() {
  if (args.once) {
    log('--once mode completed.')
    if (logStream) logStream.end()
    return
  }

  log(`Next cycle in ${args.intervalSeconds}s.`)
  setTimeout(() => {
    tick()
    scheduleNext()
  }, args.intervalSeconds * 1000)
}

function shutdown(signal) {
  log(`Received signal ${signal}; stopping watcher.`)
  if (logStream) logStream.end()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

log(`Watcher started (interval ${args.intervalSeconds}s, root ${ROOT_DIR}).`)
tick()
scheduleNext()
