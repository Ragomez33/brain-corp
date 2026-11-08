#!/usr/bin/env node

const path = require('node:path')
const { t, resolveLanguage } = require('./lib/i18n')

const DIST = path.join(__dirname, '..', 'dist')
const AUDIT_INDEX = path.join(DIST, 'modules', 'audit', 'index.js')
const AUTH = path.join(DIST, 'middleware', 'auth.js')

const COLORS = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  red: '\u001b[31m',
  yellow: '\u001b[33m',
  green: '\u001b[32m',
  cyan: '\u001b[36m',
  magenta: '\u001b[35m'
}

const SEVERITY_COLOR = {
  critical: COLORS.magenta,
  high: COLORS.red,
  medium: COLORS.yellow,
  low: COLORS.cyan,
  info: COLORS.dim
}

function fail(message) {
  console.error(`[audit] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(t('audit.help'))
}

function parseArgs(argv) {
  const args = {
    name: null,
    root: process.cwd(),
    repo: null,
    ticket: null,
    json: false,
    help: false
  }

  const positional = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        fail(t('audit.missingValue', { option: current }))
      }
      index += 1
      return value
    }

    if (current === '--root') args.root = path.resolve(next())
    else if (current === '--repo') args.repo = next()
    else if (current === '--ticket') args.ticket = next()
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else if (current.startsWith('-')) fail(t('audit.unknownOption', { option: current }))
    else positional.push(current)
  }

  args.name = positional[0] || null
  return args
}

function printReport(report) {
  const color = SEVERITY_COLOR
  console.log(
    `\n${COLORS.bold}brain-corp audit · ${report.audit}${COLORS.reset} ${COLORS.dim}(${report.repoRoot})${COLORS.reset}`
  )
  console.log(`${report.summary}\n`)

  if (report.findings.length === 0) {
    console.log(`${COLORS.green}${t('audit.noFindings')}${COLORS.reset}`)
  }

  for (const finding of report.findings) {
    const tone = color[finding.severity] || COLORS.reset
    const location = [finding.repo, finding.file].filter(Boolean).join(':')
    const line = finding.line ? `:${finding.line}` : ''
    console.log(
      `${tone}[${finding.severity.toUpperCase()}]${COLORS.reset} ${location}${line} ${finding.message}`
    )
    if (finding.detail) {
      console.log(`  ${COLORS.dim}${finding.detail}${COLORS.reset}`)
    }
  }

  console.log(`\n${COLORS.dim}${JSON.stringify(report.metrics)}${COLORS.reset}\n`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help || !args.name) {
    printHelp()
    if (!args.name && !args.help) process.exitCode = 1
    return
  }

  let audit
  let auth

  try {
    audit = require(AUDIT_INDEX)
    auth = require(AUTH)
  } catch (error) {
    fail(t('audit.buildMissing', { error: error.message }))
  }

  if (!audit.isAuditName(args.name)) {
    console.error(`[audit] ${t('audit.unknown', { name: args.name })}`)
    printHelp()
    process.exitCode = 1
    return
  }

  try {
    const { report } = audit.runAudit(args.name, {
      root: args.root,
      repo: args.repo,
      ticket: args.ticket
    })

    if (args.json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }

    printReport(report)
  } catch (error) {
    if (error && error.name === 'LicenseError') {
      const language = resolveLanguage()
      console.error(`\n${auth.licenseHelpMessage(language)}`)
      console.error(`${COLORS.yellow}${t('audit.licenseReason', { reason: error.message })}${COLORS.reset}\n`)
      process.exitCode = 2
      return
    }

    fail(error.message)
  }
}

main()
