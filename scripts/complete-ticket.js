#!/usr/bin/env node

const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  ROOT_DIR,
  listTickets,
  updateFrontmatter,
  writeTicket,
  moveTicket,
  inferIssueNumber
} = require('./lib/tickets')
const { t } = require('./lib/i18n')

const DELIVERY_SECTION = '## Entrega'

function fail(message) {
  console.error(`[complete-ticket] ${message}`)
  process.exit(1)
}

function runGh(args) {
  try {
    return execFileSync('gh', args, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : ''
    throw new Error(stderr || error.message)
  }
}

function parseArgs(argv) {
  const args = { id: null, pr: null, repo: null, json: false, skipClose: false, dryRun: false }
  const positionals = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(t('complete.missingValue', { option: current }))
      index += 1
      return value
    }

    if (current === '--id') args.id = next()
    else if (current === '--pr') args.pr = next()
    else if (current === '--repo') args.repo = next()
    else if (current === '--json') args.json = true
    else if (current === '--skip-close') args.skipClose = true
    else if (current === '--dry-run') args.dryRun = true
    else if (current.startsWith('--')) fail(t('complete.unknownArg', { arg: current }))
    else positionals.push(current)
  }

  if (!args.id && positionals[0]) args.id = positionals[0]
  if (!args.pr && positionals[1]) args.pr = positionals[1]

  if (!args.id) {
    fail(t('complete.ticketRequired'))
  }

  return args
}

function normalizePrReference(value) {
  const ref = String(value || '').trim()
  if (!ref) return null
  if (/^https?:\/\//i.test(ref)) return ref
  if (/^#?\d+$/.test(ref)) return `#${ref.replace(/^#/, '')}`
  return ref
}

function findTicket(ticketId) {
  const target = String(ticketId).toUpperCase()
  const matches = listTickets().filter(ticket => {
    const id = String(ticket.data.id || '').toUpperCase()
    const fileName = path.basename(ticket.filePath).toUpperCase()
    return id === target || fileName.startsWith(`${target}-`)
  })

  if (matches.length === 0) {
    fail(t('complete.notFound', { ticket: target }))
  }

  if (matches.length > 1) {
    const paths = matches.map(ticket => path.relative(ROOT_DIR, ticket.filePath)).join('\n  - ')
    fail(t('complete.ambiguous', { ticket: target, paths }))
  }

  return matches[0]
}

function buildDeliverySection({ prRef, completedAt }) {
  const lines = [DELIVERY_SECTION, '']
  if (prRef) lines.push(`- PR: ${prRef}`)
  lines.push(`- Completado: ${completedAt}`)
  return lines.join('\n')
}

function updateDeliverySection(content, { prRef, completedAt }) {
  const normalized = String(content || '').trim()
  const lines = normalized ? normalized.split(/\r?\n/) : []
  const headerIndex = lines.findIndex(line => line.trim() === DELIVERY_SECTION)

  if (headerIndex === -1) {
    const section = buildDeliverySection({ prRef, completedAt })
    return `${normalized ? `${normalized}\n\n` : ''}${section}\n`
  }

  let endIndex = lines.findIndex(
    (line, index) => index > headerIndex && /^##\s+/.test(line.trim())
  )
  if (endIndex === -1) endIndex = lines.length

  const existingPrLine = lines
    .slice(headerIndex + 1, endIndex)
    .find(line => /^-\s*PR\s*:/i.test(line.trim()))
  const effectivePr = prRef || (existingPrLine ? existingPrLine.trim().replace(/^-\s*PR\s*:\s*/i, '') : null)

  const before = lines.slice(0, headerIndex)
  const after = lines.slice(endIndex)
  const section = buildDeliverySection({ prRef: effectivePr, completedAt }).split('\n')

  const combined = [...before, ...section]

  if (after.length > 0) {
    combined.push('')
    combined.push(...after)
  }

  return `${combined.join('\n').replace(/\n{3,}/g, '\n\n')}\n`
}

function closeIssue({ issueNumber, prRef, repo, skipClose, dryRun }) {
  if (!issueNumber) {
    return { closed: false, skipped: true, reason: t('complete.reasonNoIssue') }
  }

  if (skipClose) {
    return { closed: false, skipped: true, reason: t('complete.reasonSkipClose') }
  }

  if (dryRun) {
    return { closed: false, skipped: true, reason: t('complete.reasonDryRun') }
  }

  const ghArgs = ['issue', 'close', String(issueNumber), '--reason', 'completed']

  if (prRef) ghArgs.push('--comment', `Completado por ${prRef}`)
  if (repo) ghArgs.push('--repo', repo)

  try {
    runGh(ghArgs)
    return { closed: true, skipped: false }
  } catch (error) {
    if (/already closed/i.test(error.message)) {
      return { closed: true, skipped: false, reason: t('complete.reasonAlreadyClosed') }
    }

    return { closed: false, skipped: false, error: error.message }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const ticket = findTicket(args.id)
  const ticketId = ticket.data.id || path.basename(ticket.filePath, '.md')
  const prRef = normalizePrReference(args.pr)
  const completedAt = new Date().toISOString()
  const issueNumber = inferIssueNumber(ticket.filePath, ticket.data)

  const updatedContent = updateDeliverySection(ticket.content, { prRef, completedAt })
  const updatedRaw = updateFrontmatter(ticket.raw, { status: 'done' })
  const frontmatterMatch = updatedRaw.match(/^---\r?\n[\s\S]*?\r?\n---/)
  const rawWithContent = frontmatterMatch
    ? `${frontmatterMatch[0]}\n\n${updatedContent}`
    : updatedRaw

  let finalPath = ticket.filePath
  let closeResult = { closed: false, skipped: true, reason: 'dry-run' }

  if (!args.dryRun) {
    writeTicket(ticket.filePath, rawWithContent)
    finalPath = moveTicket(ticket.filePath, 'done')
    closeResult = closeIssue({
      issueNumber,
      prRef,
      repo: args.repo,
      skipClose: args.skipClose,
      dryRun: false
    })
  }

  const result = {
    id: ticketId,
    ticket: path.relative(ROOT_DIR, finalPath),
    previousStatus: ticket.data.status,
    status: 'done',
    pr: prRef,
    github_issue: issueNumber,
    closed: closeResult.closed,
    close_skipped: closeResult.skipped,
    close_error: closeResult.error || null,
    dry_run: Boolean(args.dryRun)
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(t('complete.done', { ticket: ticketId, path: result.ticket }))
    if (prRef) console.log(t('complete.prRegistered', { pr: prRef }))
    if (closeResult.closed) {
      console.log(t('complete.issueClosed', { issue: issueNumber }))
    } else if (closeResult.error) {
      console.error(t('complete.issueCloseError', { issue: issueNumber, error: closeResult.error }))
    } else {
      console.log(t('complete.issueCloseSkipped', { reason: closeResult.reason }))
    }
  }

  if (closeResult.error) process.exitCode = 1
}

main()
