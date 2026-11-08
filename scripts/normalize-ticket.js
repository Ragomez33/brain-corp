#!/usr/bin/env node

const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  ROOT_DIR,
  parseTicket,
  listTickets,
  inferIssueNumber,
  inferTargetDomain,
  today,
  buildFrontmatter,
  writeTicket,
  moveTicket
} = require('./lib/tickets')
const { getRegisteredRepositories, readSystemMap } = require('./lib/system-map')
const { getTicketSections } = require('./lib/validation')
const { t } = require('./lib/i18n')

function describeDomainImpact(domain) {
  if (domain === 'shared') {
    return t('normalize.sharedImpact')
  }

  const repository = getRegisteredRepositories(readSystemMap(ROOT_DIR)).find(
    item => item.id === domain
  )

  if (!repository) return t('normalize.repoImpact', { repo: domain })

  const role = repository.role ? ` (${repository.role})` : ''
  const stack =
    Array.isArray(repository.stack) && repository.stack.length > 0
      ? `: ${repository.stack.join(', ')}`
      : ''

  return t('normalize.repoImpactDetail', {
    repo: repository.name || repository.id,
    role,
    stack
  })
}

function fail(message) {
  console.error(`[normalize-ticket] ${message}`)
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
  const args = { auto: false, json: false, push: null, file: null, noPush: false }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--auto') args.auto = true
    else if (current === '--json') args.json = true
    else if (current === '--no-push') args.noPush = true
    else if (current === '--push') {
      args.push = argv[index + 1]
      index += 1
    } else if (current === '--file') {
      args.file = argv[index + 1]
      index += 1
    } else {
      fail(t('normalize.unknownArg', { arg: current }))
    }
  }

  return args
}

function pendingTickets() {
  return listTickets().filter(ticket => ticket.data.status === 'needs_formatting')
}

function listPending({ json }) {
  const pending = pendingTickets()

  if (json) {
    console.log(
      JSON.stringify(
        pending.map(ticket => ({
          path: path.relative(ROOT_DIR, ticket.filePath),
          issue: inferIssueNumber(ticket.filePath, ticket.data),
          title: ticket.data.title || path.basename(ticket.filePath, '.md'),
          target_domain: inferTargetDomain(
            `${ticket.data.title || ''}\n${ticket.content}`
          )
        })),
        null,
        2
      )
    )
    return
  }

  if (pending.length === 0) {
    console.log(t('normalize.none'))
    return
  }

  console.log(t('normalize.pending', { count: pending.length }))

  for (const ticket of pending) {
    const issue = inferIssueNumber(ticket.filePath, ticket.data)
    const domain = inferTargetDomain(`${ticket.data.title || ''}\n${ticket.content}`)

    console.log(`- ${path.relative(ROOT_DIR, ticket.filePath)}`)
    console.log(`  ${t('normalize.issue')}: ${issue ? `#${issue}` : t('normalize.noIssue')}`)
    console.log(`  ${t('normalize.title')}: ${ticket.data.title || t('normalize.noTitle')}`)
    console.log(`  ${t('normalize.domain')}: ${domain}`)
    console.log(`  ${t('normalize.preview')}: ${ticket.content.trim().slice(0, 140).replace(/\n/g, ' ')}`)
  }
}

function buildNormalizedBody(text, domain) {
  const sections = getTicketSections()
  const context = text.trim() || t('ticket.normalize.noDescription')

  return `${sections.context}

${context}

${t('ticket.normalize.autoNote')}

${sections.requirements}

${t('ticket.normalize.reqAnalysis')}
${t('ticket.normalize.reqContracts', { domain })}
${t('ticket.normalize.reqValidations')}
${t('ticket.normalize.reqMigrations')}

${sections.architecture}

${t('ticket.normalize.archRepo', { domain })}
${t('ticket.normalize.archLayers', { layers: describeDomainImpact(domain) })}
${t('ticket.normalize.archDependencies')}
`
}

function normalizeTicket(ticket, { push }) {
  const issueNumber = inferIssueNumber(ticket.filePath, ticket.data)
  const title =
    ticket.data.title ||
    (ticket.content.match(/^#\s+(.+)$/m) || [])[1] ||
    path.basename(ticket.filePath, '.md')

  const domain = inferTargetDomain(`${title}\n${ticket.content}`)
  const data = {
    id: ticket.data.id || `TICK-${issueNumber || 'LOCAL'}`,
    title,
    author: 'Brain-Corp Analyst',
    target_domain: domain,
    status: 'backlog',
    created_at: ticket.data.created_at || today(),
    dependencies: Array.isArray(ticket.data.dependencies) ? ticket.data.dependencies : []
  }

  if (issueNumber) data.github_issue = issueNumber

  const raw = `${buildFrontmatter(data)}\n\n${buildNormalizedBody(ticket.content, domain)}`
  writeTicket(ticket.filePath, raw)

  const finalPath = moveTicket(ticket.filePath, 'backlog')

  if (push && issueNumber) {
    runGh(['issue', 'edit', String(issueNumber), '--body-file', finalPath])
  }

  return { path: finalPath, issueNumber, domain, pushed: Boolean(push && issueNumber) }
}

function pushFile(filePath) {
  const absolutePath = path.resolve(ROOT_DIR, filePath)
  const ticket = parseTicket(absolutePath)
  const issueNumber = inferIssueNumber(absolutePath, ticket.data)

  if (!issueNumber) {
    fail(t('normalize.noIssueNumber', { file: filePath }))
  }

  runGh(['issue', 'edit', String(issueNumber), '--body-file', absolutePath])
  console.log(t('normalize.issueUpdated', { issue: issueNumber, file: path.relative(ROOT_DIR, absolutePath) }))
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.push) {
    pushFile(args.push)
    return
  }

  if (!args.auto) {
    listPending({ json: args.json })
    return
  }

  const pending = args.file
    ? [parseTicket(path.resolve(ROOT_DIR, args.file))]
    : pendingTickets()

  if (pending.length === 0) {
    console.log(t('normalize.none'))
    return
  }

  let normalized = 0
  let failed = 0

  for (const ticket of pending) {
    if (ticket.data.status !== 'needs_formatting') continue

    try {
      const result = normalizeTicket(ticket, { push: !args.noPush })

      normalized += 1
      console.log(
        t('normalize.normalized', {
          file: path.relative(ROOT_DIR, result.path),
          domain: result.domain,
          suffix: result.pushed
            ? t('normalize.issueSuffix', { issue: result.issueNumber })
            : ''
        })
      )
    } catch (error) {
      failed += 1
      console.error(
        t('normalize.itemError', {
          file: path.relative(ROOT_DIR, ticket.filePath),
          error: error.message
        })
      )
    }
  }

  console.log(
    t('normalize.summary', { normalized, failed })
  )

  if (failed > 0) process.exitCode = 1
}

try {
  main()
} catch (error) {
  fail(error.message)
}
