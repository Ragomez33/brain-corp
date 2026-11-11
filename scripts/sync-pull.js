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
  normalizeTicketId,
  ticketSlugFromFileName,
  updateFrontmatter,
  writeTicket,
  moveTicket
} = require('./lib/tickets')
const { logRepair, repairTickets } = require('./lib/repair')
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

function samePath(first, second) {
  const a = path.resolve(first)
  const b = path.resolve(second)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function syncExisting(ticket, issue) {
  const currentStatus = ticket.data.status || 'backlog'
  const targetStatus = resolveIssueStatus(issue, currentStatus)
  const rawId = String(ticket.data.id || '').trim().toUpperCase()
  const canonicalId = normalizeTicketId(rawId)

  const updates = {}
  const needsStatusUpdate = targetStatus !== currentStatus
  const needsMove = STATUS_DIRS.includes(targetStatus) && ticket.dir !== targetStatus

  if (canonicalId && canonicalId !== rawId) {
    updates.id = canonicalId
  }

  if (Number(ticket.data.github_issue) !== issue.number) {
    updates.github_issue = issue.number
  }

  if (needsStatusUpdate) {
    updates.status = targetStatus
  }

  let currentPath = ticket.filePath
  let renameTarget = null

  if (canonicalId) {
    const targetName = `${canonicalId}-${ticketSlugFromFileName(
      ticket.filePath,
      ticket.data.title
    )}.md`
    const targetPath = path.join(path.dirname(ticket.filePath), targetName)

    if (!samePath(ticket.filePath, targetPath)) {
      if (fs.existsSync(targetPath)) {
        throw new Error(
          `cannot rename ${path.basename(ticket.filePath)} to ${targetName}; the target already exists.`
        )
      }

      renameTarget = targetPath
    }
  }

  if (Object.keys(updates).length === 0 && !needsMove && !renameTarget) {
    return { changed: false, status: currentStatus, path: ticket.filePath }
  }

  if (Object.keys(updates).length > 0) {
    const raw = updateFrontmatter(ticket.raw, updates)
    writeTicket(currentPath, raw)
  }

  if (renameTarget) {
    fs.renameSync(currentPath, renameTarget)
    currentPath = renameTarget
  }

  const finalPath = needsMove ? moveTicket(currentPath, targetStatus) : currentPath

  return {
    changed: true,
    status: targetStatus,
    path: finalPath,
    moved: needsMove,
    renamed: Boolean(renameTarget)
  }
}

function buildNewTicket(issue) {
  const body = issue.body || ''
  const strict = hasStrictFrontmatter(body)
  const slug = slugify(issue.title || `issue-${issue.number}`)
  let ticketId
  let data
  let raw

  if (strict) {
    const parsed = matter(body)
    const rawId = String(parsed.data.id || '').trim()
    ticketId = normalizeTicketId(rawId)

    if (!ticketId) {
      throw new Error(
        `invalid ticket id "${rawId}" in the issue body; expected TICK-XXX.`
      )
    }

    const status = resolveIssueStatus(issue, parsed.data.status || 'backlog')
    const updates = {
      github_issue: issue.number,
      status
    }

    if (ticketId !== rawId) {
      updates.id = ticketId
    }

    raw = updateFrontmatter(body, updates)
    data = { ...parsed.data, ...updates, id: ticketId }
  } else {
    ticketId = normalizeTicketId(`TICK-${issue.number}`)

    if (!ticketId) {
      throw new Error(
        `issue number ${issue.number} cannot be mapped to a TICK-XXX id.`
      )
    }

    const status = resolveIssueStatus(issue, 'needs_formatting')
    data = {
      id: ticketId,
      title: issue.title,
      author: 'Brain-Corp Analyst',
      target_domain: 'shared',
      status,
      created_at: today(),
      dependencies: [],
      github_issue: issue.number
    }
    raw = `${buildFrontmatter(data)}\n\n${body.trim()}\n`
  }

  const backlogPath = path.join(TICKETS_DIR, 'backlog', `${data.id}-${slug}.md`)

  const existingById = listTickets().find(
    ticket => normalizeTicketId(ticket.data.id) === data.id
  )

  if (existingById) {
    throw new Error(
      `ticket ${data.id} already exists at ${path.relative(
        ROOT_DIR,
        existingById.filePath
      )}.`
    )
  }

  if (fs.existsSync(backlogPath)) {
    throw new Error(
      `cannot create ${path.basename(backlogPath)}; the file already exists.`
    )
  }

  writeTicket(backlogPath, raw)

  const folder = folderForStatus(data.status)
  const finalPath = folder === 'backlog' ? backlogPath : moveTicket(backlogPath, folder)

  return { path: finalPath, status: data.status, strict }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  ensureTicketDirs()

  // Initial sync is also the repair point for workspaces that already contain
  // ticket files whose name does not match their canonical id.
  logRepair(repairTickets())

  validateGh()

  const brainConfig = readBrainConfig()
  const repo = args.repo || process.env.GITHUB_REPO || brainConfig.repo || null

  const issues = fetchIssues({ repo, limit: args.limit })
  const localTickets = listTickets()

  const localByIssue = new Map()
  for (const ticket of localTickets) {
    const issueNumber = inferIssueNumber(ticket.filePath, ticket.data)
    if (!issueNumber) continue

    if (localByIssue.has(issueNumber)) {
      console.warn(
        t('syncpull.duplicateIssue', {
          issue: issueNumber,
          file: path.basename(ticket.filePath),
          existing: path.basename(localByIssue.get(issueNumber).filePath)
        })
      )
      continue
    }

    localByIssue.set(issueNumber, ticket)
  }

  let created = 0
  let updated = 0
  let unchanged = 0
  let failed = 0

  for (const issue of issues) {
    const existing = localByIssue.get(issue.number)

    try {
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
    } catch (error) {
      failed += 1
      console.error(
        t('syncpull.error', {
          issue: issue.number,
          error: error.message
        })
      )
    }
  }

  console.log(
    t('syncpull.summary', {
      created,
      updated,
      unchanged,
      failed,
      issues: issues.length
    })
  )

  if (failed > 0) process.exitCode = 1
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
