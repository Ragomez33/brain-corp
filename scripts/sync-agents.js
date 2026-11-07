#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { provisionAgentAssets } = require('./lib/agent-provision')
const { t } = require('./lib/i18n')

const CONFIG_FILE = '.brainrc.json'
const DEFAULT_AGENT = 'opencode'
const SUPPORTED_AGENTS = ['opencode', 'claude', 'cursor', 'antigravity']

function fail(message) {
  console.error(`[sync-agents] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(
    t('agents.help', {
      agents: SUPPORTED_AGENTS.join(' | '),
      default: DEFAULT_AGENT
    })
  )
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    agent: null,
    overwrite: false,
    json: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) fail(t('agents.missingValue', { option: current }))
      index += 1
      return value
    }

    if (current === '--root') args.root = path.resolve(next())
    else if (current === '--agent') args.agent = next()
    else if (current === '--overwrite') args.overwrite = true
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else fail(t('agents.unknownOption', { option: current }))
  }

  return args
}

function readConfig(rootDir) {
  const configPath = path.join(rootDir, CONFIG_FILE)
  if (!fs.existsSync(configPath)) return null

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    fail(t('agents.badConfig', { file: CONFIG_FILE, error: error.message }))
  }
}

function resolveAgent({ rootDir, agent }) {
  if (agent) return String(agent).toLowerCase()

  const config = readConfig(rootDir)
  const configured = config?.defaultAgent || config?.lastSession?.agent
  return String(configured || DEFAULT_AGENT).toLowerCase()
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const rootDir = args.root
  if (!fs.existsSync(rootDir)) fail(t('agents.missingWorkspace', { root: rootDir }))

  const agent = resolveAgent({ rootDir, agent: args.agent })
  const result = provisionAgentAssets({
    agent,
    workspaceDir: rootDir,
    overwrite: args.overwrite
  })

  if (args.json) {
    console.log(JSON.stringify({ ...result, workspaceDir: rootDir }, null, 2))
    return
  }

  console.log(t('agents.engine', { agent, root: rootDir }))
  console.log(
    t('agents.summary', {
      created: result.created.length,
      skipped: result.skipped.length
    })
  )

  for (const item of result.created) {
    console.log(`  + ${path.relative(rootDir, item.path)}`)
  }
}

main()
