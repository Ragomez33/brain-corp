#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { runSanityCheck } = require('./lib/sanity')
const { t } = require('./lib/i18n')

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
    console.log(t('sanity.reportWritten', { path: path.relative(process.cwd(), ledgerPath) }))
  }
}

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(t('sanity.tickets', { tickets: result.totals.tickets, backlog: result.totals.backlog }))

  for (const warning of result.warnings) {
    console.warn(t('sanity.warn', { warning }))
  }

  for (const error of result.errors) {
    console.error(t('sanity.error', { error }))
  }

  console.log(
    t('sanity.summary', {
      status: result.ok ? t('sanity.ready') : t('sanity.blocked'),
      errors: result.totals.errors,
      warnings: result.totals.warnings
    })
  )
}

process.exitCode = result.ok ? 0 : 1
