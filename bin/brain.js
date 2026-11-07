#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildNodeCommand } = require('../scripts/lib/shell')

const ROOT_DIR = path.resolve(__dirname, '..')
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json')

const COMMANDS = {
  init: { script: 'scripts/init-brain.js', description: 'Onboarding, sesión y lanzamiento del agente.' },
  start: { script: 'scripts/init-brain.js', description: 'Alias de init.' },
  setup: { script: 'scripts/setup-wizard.js', description: 'Registrar sidecars y topología del ecosistema.' },
  'agents:sync': { script: 'scripts/sync-agents.js', description: 'Re-desplegar assets y comandos del motor de agente.' },
  'init-work': { script: 'scripts/sdd.js', prepend: ['init-work'], description: 'Inicializar una feature SDD en .brain/.' },
  specify: { script: 'scripts/sdd.js', prepend: ['specify'], description: 'Generar spec.md (EARS).' },
  plan: { script: 'scripts/sdd.js', prepend: ['plan'], description: 'Generar plan.md.' },
  tasks: { script: 'scripts/sdd.js', prepend: ['tasks'], description: 'Generar tasks.md.' },
  implement: { script: 'scripts/sdd.js', prepend: ['implement'], description: 'Ejecutar tareas (checkpoint o batch).' },
  analyze: { script: 'scripts/sdd.js', prepend: ['analyze'], description: 'Auditar coherencia y spec drift.' },
  sync: { script: 'scripts/sync-github.js', description: 'Publicar tickets del backlog como issues.' },
  'sync:pull': { script: 'scripts/sync-pull.js', description: 'Importar issues de GitHub como tickets.' },
  pull: { script: 'scripts/sync-pull.js', description: 'Alias de sync:pull.' },
  sanity: { script: 'scripts/sanity-check.js', description: 'Auditar coherencia de tickets.' },
  watch: { script: 'scripts/watch-github.js', description: 'Sincronización continua.' },
  normalize: { script: 'scripts/normalize-ticket.js', description: 'Normalizar tickets importados.' },
  complete: { script: 'scripts/complete-ticket.js', description: 'Cerrar la entrega de un ticket.' },
  hotfix: { script: 'scripts/hotfix.js', description: 'Crear un ticket de emergencia.' }
}

function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function printHelp() {
  console.log(`brain-corp v${readVersion()}

Uso:
  brain [comando] [opciones]

Comandos:`)

  for (const [name, command] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${command.description}`)
  }

  console.log(`
Opciones:
  -h, --help       Muestra esta ayuda.
  -v, --version    Muestra la versión.

Sin comando, brain ejecuta "init".`)
}

function fail(message) {
  console.error(`[brain] ${message}`)
  process.exit(1)
}

function runScript(script, args) {
  const scriptPath = path.join(ROOT_DIR, script)

  if (!fs.existsSync(scriptPath)) {
    fail(`No se encontró el script ${script}.`)
  }

  const result = spawnSync(buildNodeCommand(scriptPath, args), {
    // El workspace es el directorio desde el que el usuario invoca `brain`,
    // no la carpeta donde está instalado el paquete.
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
    console.error(`[brain] Comando no reconocido: ${first}`)
    printHelp()
    return 1
  }

  const rest = argv.slice(1)
  const args = Array.isArray(command.prepend) ? [...command.prepend, ...rest] : rest

  return runScript(command.script, args)
}

process.exitCode = main()
