#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildNodeCommand } = require('../scripts/lib/shell')
const { t } = require('../scripts/lib/i18n')

const ROOT_DIR = path.resolve(__dirname, '..')
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json')

const COMMANDS = {
  init: { script: 'scripts/init-brain.js', descriptionKey: 'bin.cmd.init' },
  start: { script: 'scripts/init-brain.js', descriptionKey: 'bin.cmd.start' },
  setup: { script: 'scripts/setup-wizard.js', descriptionKey: 'bin.cmd.setup' },
  'agents:sync': { script: 'scripts/sync-agents.js', descriptionKey: 'bin.cmd.agentsSync' },
  reset: { script: 'scripts/reset.js', descriptionKey: 'bin.cmd.reset' },
  pr: { script: 'scripts/create-pr.js', descriptionKey: 'bin.cmd.pr' },
  audit: { script: 'scripts/audit.js', descriptionKey: 'bin.cmd.audit' },
  'init-work': { script: 'scripts/sdd.js', prepend: ['init-work'], descriptionKey: 'bin.cmd.initWork' },
  specify: { script: 'scripts/sdd.js', prepend: ['specify'], descriptionKey: 'bin.cmd.specify' },
  plan: { script: 'scripts/sdd.js', prepend: ['plan'], descriptionKey: 'bin.cmd.plan' },
  tasks: { script: 'scripts/sdd.js', prepend: ['tasks'], descriptionKey: 'bin.cmd.tasks' },
  implement: { script: 'scripts/sdd.js', prepend: ['implement'], descriptionKey: 'bin.cmd.implement' },
  analyze: { script: 'scripts/sdd.js', prepend: ['analyze'], descriptionKey: 'bin.cmd.analyze' },
  sync: { script: 'scripts/sync-github.js', descriptionKey: 'bin.cmd.sync' },
  'sync:pull': { script: 'scripts/sync-pull.js', descriptionKey: 'bin.cmd.syncPull' },
  pull: { script: 'scripts/sync-pull.js', descriptionKey: 'bin.cmd.pull' },
  sanity: { script: 'scripts/sanity-check.js', descriptionKey: 'bin.cmd.sanity' },
  watch: { script: 'scripts/watch-github.js', descriptionKey: 'bin.cmd.watch' },
  normalize: { script: 'scripts/normalize-ticket.js', descriptionKey: 'bin.cmd.normalize' },
  complete: { script: 'scripts/complete-ticket.js', descriptionKey: 'bin.cmd.complete' },
  hotfix: { script: 'scripts/hotfix.js', descriptionKey: 'bin.cmd.hotfix' },
  hydrate: { script: 'scripts/hydrate.js', descriptionKey: 'bin.cmd.hydrate' }
}

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function printHelp() {
  console.log(t('bin.title', { version: readVersion() }))
  console.log(`\n${t('bin.usage')}`)

  for (const [name, command] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${t(command.descriptionKey)}`)
  }

  console.log(`\n${t('bin.options')}`)
}

function fail(message) {
  console.error(`[brain] ${message}`)
  process.exit(1)
}

function runScript(script, args) {
  const scriptPath = path.join(ROOT_DIR, script)

  if (!fs.existsSync(scriptPath)) {
    fail(`Script not found: ${script}.`)
  }

  const result = spawnSync(buildNodeCommand(scriptPath, args), {
    // El workspace es el directorio desde el que el usuario invoca `brain`,
    // not the folder where the package is installed.
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    // shell: true resuelve correctamente node/npm/gh y sus wrappers .cmd en Windows.
    shell: true
  })

  if (result.error) {
    fail(result.error.message)
  }

  return typeof result.status === 'number' ? result.status : 1
}

function main() {
  const argv = process.argv.slice(2)
  const first = argv[0]

  if (first === '--help' || first === '-h' || first === 'help') {
    printHelp()
    return 0
  }

  if (first === '--version' || first === '-v') {
    console.log(readVersion())
    return 0
  }

  if (!first) {
    return runScript(COMMANDS.init.script, argv)
  }

  if (first.startsWith('-')) {
    return runScript(COMMANDS.init.script, argv)
  }

  const command = COMMANDS[first]

  if (!command) {
    console.error(`[brain] ${t('bin.unknown', { name: first })}`)
    printHelp()
    return 1
  }

  const rest = argv.slice(1)
  const args = Array.isArray(command.prepend) ? [...command.prepend, ...rest] : rest

  return runScript(command.script, args)
}

process.exitCode = main()
