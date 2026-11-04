#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { runSanityCheck } = require('./lib/sanity')

const asJson = process.argv.includes('--json')
const shouldWrite = process.argv.includes('--write')
const result = runSanityCheck()

if (shouldWrite) {
  const ledgerPath = path.resolve(
    process.cwd(),
    '.agents',
    'tickets',
    '.sanity-check.json'
  )
  const ledger = {
    checked_at: result.checked_at,
    source: 'sanity-check',
    ready_for_sync: result.ready_for_sync,
    tickets: result.tickets,
    deleted: [],
    blocking: result.errors
  }

  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8')

  if (!asJson) {
    console.log(`[sanity-check] Reporte escrito en ${path.relative(process.cwd(), ledgerPath)}`)
  }
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`[sanity-check] Tickets: ${result.totals.tickets} (backlog: ${result.totals.backlog})`)

  for (const warning of result.warnings) {
    console.warn(`[sanity-check] WARN  ${warning}`)
  }

  for (const error of result.errors) {
    console.error(`[sanity-check] ERROR ${error}`)
  }

  console.log(
    `[sanity-check] ${result.ok ? 'READY FOR SYNC' : 'BLOCKED'} — ${result.totals.errors} errores, ${result.totals.warnings} advertencias.`
  )
}

process.exitCode = result.ok ? 0 : 1
