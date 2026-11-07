#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const matter = require('gray-matter')
const {
  ROOT_DIR,
  TICKETS_DIR,
  STATUS_DIRS,
  ensureTicketDirs,
  slugify,
  today,
  buildFrontmatter,
  listTickets,
  hasStrictFrontmatter,
  inferIssueNumber,
  updateFrontmatter,
  writeTicket,
  moveTicket
} = require('./lib/tickets')
const { t } = require('./lib/i18n')

const BRAINRC_PATH = path.join(ROOT_DIR, '.brainrc.json')

function fail(message) {
  console.error(`[sync-pull] ${message}`)
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
  const args = { limit: 200, repo: null }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--repo') {
      args.repo = argv[index + 1]
      index += 1
    } else if (current === '--limit') {
      args.limit = Number(argv[index + 1])
      index += 1
    } else {
      fail(t('syncpull.unknownArg', { arg: current }))
    }
  }

  return args
}

function readBrainConfig() {
  if (!fs.existsSync(BRAINRC_PATH)) return {}

  try {
    return JSON.parse(fs.readFileSync(BRAINRC_PATH, 'utf8'))
  } catch (error) {
    fail(t('syncpull.badConfig', { error: error.message }))
  }
}

function validateGh() {
  try {
    runGh(['auth', 'status'])
  } catch {
    fail(t('syncpull.ghSession'))
  }
}

function fetchIssues({ repo, limit }) {
  const ghArgs = [
    'issue',
    'list',
    '--json',
    'number,title,body,labels,updatedAt,state',
    '--state',
    'all',
    '--limit',
    String(limit)
  ]

  if (repo) ghArgs.push('--repo', repo)

  const output = runGh(ghArgs)
  return JSON.parse(output || '[]')
}

function resolveIssueStatus(issue, currentStatus) {
  if (issue.state === 'CLOSED') return 'done'
  if (issue.state === 'OPEN' && currentStatus === 'done') return 'backlog'
  return currentStatus
}

function folderForStatus(status) {
  return ['backlog', 'in-analysis', 'ready', 'done'].includes(status)
    ? status
    : 'backlog'
}

function syncExisting(ticket, issue) {
  const currentStatus = ticket.data.status || 'backlog'
  const targetStatus = resolveIssueStatus(issue, currentStatus)

  const updates = {}
  const needsStatusUpdate = targetStatus !== currentStatus
  const needsMove = STATUS_DIRS.includes(targetStatus) && ticket.dir !== targetStatus

  if (Number(ticket.data.github_issue) !== issue.number) {
    updates.github_issue = issue.number
  }

  if (needsStatusUpdate) {
    updates.status = targetStatus
  }

  if (Object.keys(updates).length === 0 && !needsMove) {
    return { changed: false, status: currentStatus, path: ticket.filePath }
  }

  if (Object.keys(updates).length > 0) {
    const raw = updateFrontmatter(ticket.raw, updates)
    writeTicket(ticket.filePath, raw)
  }

  const finalPath = needsMove ? moveTicket(ticket.filePath, targetStatus) : ticket.filePath

  return { changed: true, status: targetStatus, path: finalPath, moved: needsMove }
}

function buildNewTicket(issue) {
  const body = issue.body || ''
  const strict = hasStrictFrontmatter(body)
  const slug = slugify(issue.title || `issue-${issue.number}`)
  let backlogPath = path.join(
    TICKETS_DIR,
    'backlog',
    `TICK-${issue.number}-${slug}.md`
  )

  if (fs.existsSync(backlogPath)) {
    backlogPath = path.join(
      TICKETS_DIR,
      'backlog',
      `TICK-${issue.number}-${slug}-gh.md`
    )
  }

  if (strict) {
    const parsed = matter(body)
    const status = resolveIssueStatus(issue, parsed.data.status || 'backlog')

    const raw = updateFrontmatter(body, {
      github_issue: issue.number,
      status
    })

    writeTicket(backlogPath, raw)

    const folder = folderForStatus(status)
    const finalPath = folder === 'backlog' ? backlogPath : moveTicket(backlogPath, folder)

    return { path: finalPath, status, strict }
  }

  const status = resolveIssueStatus(issue, 'needs_formatting')
  const data = {
    id: `TICK-${issue.number}`,
    title: issue.title,
    author: 'Brain-Corp Analyst',
    target_domain: 'shared',
    status,
    created_at: today(),
    dependencies: [],
    github_issue: issue.number
  }

  const raw = `${buildFrontmatter(data)}\n\n${body.trim()}\n`
  writeTicket(backlogPath, raw)

  const folder = folderForStatus(status)
  const finalPath = folder === 'backlog' ? backlogPath : moveTicket(backlogPath, folder)

  return { path: finalPath, status, strict }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  validateGh()
  ensureTicketDirs()

  const brainConfig = readBrainConfig()
  const repo = args.repo || process.env.GITHUB_REPO || brainConfig.repo || null

  const issues = fetchIssues({ repo, limit: args.limit })
  const localTickets = listTickets()

  const localByIssue = new Map()
  for (const ticket of localTickets) {
    const issueNumber = inferIssueNumber(ticket.filePath, ticket.data)
    if (issueNumber) localByIssue.set(issueNumber, ticket)
  }

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const issue of issues) {
    const existing = localByIssue.get(issue.number)

    if (existing) {
      const result = syncExisting(existing, issue)

      if (result.changed) {
        updated += 1
        console.log(
          t('syncpull.updated', {
            issue: issue.number,
            status: result.status,
            path: path.relative(ROOT_DIR, result.path || existing.filePath)
          })
        )
      } else {
        unchanged += 1
      }

      continue
    }

    const result = buildNewTicket(issue)
    created += 1

    console.log(
      t('syncpull.newTicket', {
        issue: issue.number,
        status: result.status,
        suffix: result.strict ? '' : t('syncpull.newTicketSuffix'),
        path: path.relative(ROOT_DIR, result.path)
      })
    )
  }

  console.log(
    t('syncpull.summary', {
      created,
      updated,
      unchanged,
      issues: issues.length
    })
  )
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    fail(error.message)
  }
}

module.exports = {
  resolveIssueStatus,
  syncExisting,
  buildNewTicket
}
