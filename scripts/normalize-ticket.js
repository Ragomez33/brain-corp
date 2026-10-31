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

const DOMAIN_IMPACT = {
  'forge-backend':
    'API GraphQL/NestJS, servicios de dominio, Prisma/PostgreSQL y migraciones.',
  'forge-front':
    'panel Next.js, componentes MUI, servicios GraphQL y flujos de UI.',
  'foundly-pos':
    'app Expo/React Native, SQLite/Drizzle, stores y flujos locales del POS.',
  shared:
    'contratos compartidos entre sidecars, mapeo de datos y posibles integraciones Forge ↔ Foundly.'
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
      fail(`Argumento no reconocido: ${current}`)
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
    console.log('[normalize-ticket] No hay tickets con status "needs_formatting".')
    return
  }

  console.log(`[normalize-ticket] ${pending.length} ticket(s) pendiente(s):\n`)

  for (const ticket of pending) {
    const issue = inferIssueNumber(ticket.filePath, ticket.data)
    const domain = inferTargetDomain(`${ticket.data.title || ''}\n${ticket.content}`)

    console.log(`- ${path.relative(ROOT_DIR, ticket.filePath)}`)
    console.log(`  issue: ${issue ? `#${issue}` : 'sin issue'}`)
    console.log(`  título: ${ticket.data.title || '(sin título)'}`)
    console.log(`  domain inferido: ${domain}`)
    console.log(`  preview: ${ticket.content.trim().slice(0, 140).replace(/\n/g, ' ')}`)
  }
}

function buildNormalizedBody(text, domain) {
  const context = text.trim() || '(Sin descripción proporcionada en el issue.)'

  return `## Contexto / Hallazgo

${context}

> _Ticket normalizado automáticamente por brain-corp. Pendiente de refinamiento por el Arquitecto Analista._

## Requerimientos Técnicos

- Completar el análisis funcional del requerimiento descrito en el contexto.
- Definir los contratos de datos, endpoints, queries o mutaciones afectados en \`${domain}\`.
- Especificar validaciones, manejo de errores y criterios de aceptación verificables.
- Identificar migraciones, compatibilidad y datos existentes que deban preservarse.

## Impacto en la Arquitectura

- Repositorio objetivo: \`${domain}\`.
- Capas afectadas: ${DOMAIN_IMPACT[domain] || DOMAIN_IMPACT.shared}
- Revisar dependencias con otros sidecars y el impacto en multi-tenancy y sincronización.
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
    fail(`No se pudo determinar el número de issue para ${filePath}`)
  }

  runGh(['issue', 'edit', String(issueNumber), '--body-file', absolutePath])
  console.log(`[normalize-ticket] Issue #${issueNumber} actualizado desde ${path.relative(ROOT_DIR, absolutePath)}.`)
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
    console.log('[normalize-ticket] No hay tickets con status "needs_formatting".')
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
        `[normalize-ticket] ${path.relative(ROOT_DIR, result.path)} -> ${result.domain}${result.pushed ? ` (issue #${result.issueNumber} actualizado)` : ''}`
      )
    } catch (error) {
      failed += 1
      console.error(
        `[normalize-ticket] ${path.relative(ROOT_DIR, ticket.filePath)}: error -> ${error.message}`
      )
    }
  }

  console.log(
    `[normalize-ticket] Resumen: ${normalized} normalizados, ${failed} con error.`
  )

  if (failed > 0) process.exitCode = 1
}

try {
  main()
} catch (error) {
  fail(error.message)
}
