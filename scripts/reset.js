#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { getRegisteredRepositories, readSystemMap } = require('./lib/system-map')
const { t } = require('./lib/i18n')

function fail(message) {
  console.error(`[reset] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(t('reset.help'))
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    repo: null,
    all: false,
    json: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        fail(t('reset.missingValue', { option: current }))
      }
      index += 1
      return value
    }

    if (current === '--root') args.root = path.resolve(next())
    else if (current === '--repo') args.repo = next()
    else if (current === '--all') args.all = true
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else fail(t('reset.unknownOption', { option: current }))
  }

  return args
}

function activeFile(rootDir, repository) {
  return path.join(rootDir, repository.path || '.', '.brain', 'active.json')
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  if (!args.all && !args.repo) {
    fail(t('reset.needTarget'))
  }

  const map = readSystemMap(args.root)
  const repositories = getRegisteredRepositories(map)
  let targets = repositories

  if (args.repo) {
    const normalized = String(args.repo).toLowerCase()
    targets = repositories.filter(
      repository => String(repository.id || '').toLowerCase() === normalized
    )

    if (targets.length === 0) {
      fail(t('reset.unknownRepo', { repo: args.repo }))
    }
  }

  const removed = []
  const missing = []

  for (const repository of targets) {
    const file = activeFile(args.root, repository)

    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      removed.push(path.relative(args.root, file))
    } else {
      missing.push(path.relative(args.root, file))
    }
  }

  const result = {
    root: args.root,
    repositories: targets.length,
    removed,
    missing
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  for (const file of removed) console.log(t('reset.removed', { file }))
  for (const file of missing) console.log(t('reset.notFound', { file }))
  console.log(t('reset.summary', { removed: removed.length, missing: missing.length }))
}

try {
  main()
} catch (error) {
  fail(error.message)
}
