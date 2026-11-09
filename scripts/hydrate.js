#!/usr/bin/env node

const { hydrateSidecars } = require('./lib/hydrate')

const ROOT_DIR = process.cwd()

function main() {
  const summary = hydrateSidecars({ rootDir: ROOT_DIR })
  return summary.failed > 0 ? 1 : 0
}

process.exitCode = main()
