#!/usr/bin/env node

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { findTicketsByReference, inferIssueNumber } = require('./lib/tickets')
const { getRegisteredRepositories, readSystemMap } = require('./lib/system-map')
const { resolveLanguage } = require('./lib/config')
const { t } = require('./lib/i18n')

const PACKAGE_ROOT = path.resolve(__dirname, '..')
const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates', 'pr')

function fail(message) {
  console.error(`[pr] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(t('pr.help'))
}

function parseArgs(argv) {
  const args = {
    ticketId: null,
    repo: null,
    base: null,
    title: null,
    summary: null,
    specImpact: null,
    bodyFile: null,
    lang: null,
    draft: false,
    dryRun: false,
    json: false,
    help: false
  }

  const positional = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        fail(t('pr.missingValue', { option: current }))
      }
      index += 1
      return value
    }

    if (current === '--ticket') args.ticketId = next()
    else if (current === '--repo') args.repo = next()
    else if (current === '--base') args.base = next()
    else if (current === '--title') args.title = next()
    else if (current === '--summary') args.summary = next()
    else if (current === '--spec-impact') args.specImpact = next()
    else if (current === '--body-file') args.bodyFile = path.resolve(next())
    else if (current === '--lang') args.lang = next()
    else if (current === '--draft') args.draft = true
    else if (current === '--dry-run') args.dryRun = true
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else if (current.startsWith('-')) fail(t('pr.unknownOption', { option: current }))
    else positional.push(current)
  }

  if (!args.ticketId && positional[0]) args.ticketId = positional[0]
  if (!args.ticketId && !args.help) fail(t('pr.ticketRequired'))

  return args
}

function findTicket(ticketId) {
  const target = String(ticketId || '').trim().toUpperCase()
  const matches = findTicketsByReference(target)

  if (matches.length === 0) fail(t('pr.ticketNotFound', { ticket: target }))
  if (matches.length > 1) fail(t('pr.ticketAmbiguous', { ticket: target }))
  return matches[0]
}

function resolveRepository({ ticket, repoId, rootDir }) {
  const repositories = getRegisteredRepositories(readSystemMap(rootDir))
  const requested = repoId || String(ticket.data.target_domain || '')

  const repository = repositories.find(
    item => String(item.id || '').toLowerCase() === requested.toLowerCase()
  )

  if (!repository) {
    fail(t('pr.repoRequired', { domain: requested || 'shared' }))
  }

  return {
    ...repository,
    absolutePath: path.resolve(rootDir, repository.path || '.')
  }
}

function readTemplate(language) {
  const file = path.join(TEMPLATES_DIR, language, 'PULL_REQUEST_TEMPLATE.md')
  if (!fs.existsSync(file)) fail(t('pr.templateMissing', { file }))
  return fs.readFileSync(file, 'utf8')
}

function renderTemplate(template, variables) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })
}

function runGit(repository, args) {
  return execFileSync('git', args, {
    cwd: repository.absolutePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function remoteBranchExists(repository, branch) {
  try {
    execFileSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch], {
      cwd: repository.absolutePath,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return true
  } catch {
    return false
  }
}

function preflight({ repository, base }) {
  const warnings = []
  const errors = []
  const pathLabel = repository.path || repository.absolutePath

  try {
    runGit(repository, ['rev-parse', '--is-inside-work-tree'])
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString().trim() : error.message
    errors.push(t('pr.preflightNoGit', { path: pathLabel, error: detail }))
    return { branch: null, warnings, errors }
  }

  let branch = null

  try {
    branch = runGit(repository, ['rev-parse', '--abbrev-ref', 'HEAD'])
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString().trim() : error.message
    errors.push(t('pr.preflightNoGit', { path: pathLabel, error: detail }))
    return { branch, warnings, errors }
  }

  if (!branch || branch === 'HEAD') {
    errors.push(t('pr.preflightDetached', { path: pathLabel }))
  } else if (branch === base) {
    errors.push(t('pr.preflightSameBranch', { branch, base }))
  }

  try {
    const status = runGit(repository, ['status', '--porcelain'])
    const count = status ? status.split('\n').length : 0
    if (count > 0) warnings.push(t('pr.preflightDirty', { count, path: pathLabel }))
  } catch {
    // Ignore status failures here; the git validation above already reports them.
  }

  let hasOrigin = true

  try {
    runGit(repository, ['remote', 'get-url', 'origin'])
  } catch {
    hasOrigin = false
    errors.push(t('pr.preflightNoOrigin', { path: pathLabel }))
  }

  if (hasOrigin) {
    if (!remoteBranchExists(repository, base)) {
      errors.push(t('pr.preflightBaseMissing', { base }))
    }

    if (branch && branch !== 'HEAD' && branch !== base && !remoteBranchExists(repository, branch)) {
      errors.push(t('pr.preflightBranchMissing', { branch }))
    }
  }

  return { branch, warnings, errors }
}

function reportPreflight(preflightResult, { failOnErrors = true } = {}) {
  for (const warning of preflightResult.warnings) {
    console.error(`[pr] ${warning}`)
  }

  for (const error of preflightResult.errors) {
    console.error(`[pr] ${error}`)
  }

  if (failOnErrors && preflightResult.errors.length > 0) process.exit(1)
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const rootDir = process.cwd()
  const ticket = findTicket(args.ticketId)
  const repository = resolveRepository({ ticket, repoId: args.repo, rootDir })
  const language = String(args.lang || resolveLanguage(rootDir)).toLowerCase() === 'es' ? 'es' : 'en'
  const ticketId = String(ticket.data.id || args.ticketId).toUpperCase()
  const issue = inferIssueNumber(ticket.filePath, ticket.data)
  const ticketTitle = String(ticket.data.title || ticketId)
  const summary = args.summary || ticketTitle
  const base = args.base || 'main'
  const specImpact = args.specImpact || 'none'

  let body

  if (args.bodyFile) {
    if (!fs.existsSync(args.bodyFile)) fail(t('pr.bodyFileMissing', { file: args.bodyFile }))
    body = fs.readFileSync(args.bodyFile, 'utf8')
  } else {
    body = renderTemplate(readTemplate(language), {
      TICKET_ID: ticketId,
      TICKET_TITLE: ticketTitle,
      ISSUE: issue ? `#${issue}` : 'N/A',
      SUMMARY: summary,
      SPEC_IMPACT: specImpact,
      BASE: base,
      REPO_ID: repository.id
    })
  }

  const title = args.title || `${ticketId}: ${ticketTitle}`
  const preflightResult = preflight({ repository, base })

  if (args.dryRun) {
    reportPreflight(preflightResult, { failOnErrors: false })

    const result = {
      ticket: ticketId,
      repository: repository.id,
      language,
      title,
      base,
      branch: preflightResult.branch,
      draft: args.draft,
      bodyFile: null,
      dryRun: true,
      warnings: preflightResult.warnings,
      errors: preflightResult.errors
    }

    if (args.json) {
      console.log(JSON.stringify({ ...result, body }, null, 2))
    } else {
      console.log(t('pr.dryRun', { title, base, repo: repository.id }))
      console.log(`gh pr create --title "${title}" --body-file <tmp> --base ${base}${args.draft ? ' --draft' : ''}`)
      console.log('')
      console.log(body)
    }
    return
  }

  reportPreflight(preflightResult)

  const bodyFile = path.join(os.tmpdir(), `brain-corp-pr-${ticketId}-${process.pid}.md`)
  fs.writeFileSync(bodyFile, body, { mode: 0o600 })

  const ghArgs = ['pr', 'create', '--title', title, '--body-file', bodyFile, '--base', base]
  if (args.draft) ghArgs.push('--draft')

  const result = {
    ticket: ticketId,
    repository: repository.id,
    language,
    title,
    base,
    branch: preflightResult.branch,
    draft: args.draft,
    bodyFile,
    dryRun: false,
    warnings: preflightResult.warnings
  }

  try {
    const output = execFileSync('gh', ghArgs, {
      cwd: repository.absolutePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()

    result.url = output
    if (args.json) console.log(JSON.stringify(result, null, 2))
    else console.log(t('pr.created', { url: output }))
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : ''
    fail(t('pr.createFailed', { error: stderr || error.message }))
  } finally {
    try {
      fs.unlinkSync(bodyFile)
    } catch {
      // Ignore cleanup errors.
    }
  }
}

try {
  main()
} catch (error) {
  fail(error.message)
}
