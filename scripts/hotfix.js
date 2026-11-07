#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const {
  ROOT_DIR,
  TICKETS_DIR,
  listTickets,
  slugify,
  today,
  buildFrontmatter,
  writeTicket,
  updateFrontmatter
} = require('./lib/tickets')
const { getTargetDomains } = require('./lib/system-map')

const SYSTEM_MAP_PATH = path.join(ROOT_DIR, 'config', 'system-map.json')
const BRAINRC_PATH = path.join(ROOT_DIR, '.brainrc.json')

function fail(message) {
  console.error(`[hotfix] ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {
    title: null,
    domain: null,
    module: null,
    slug: null,
    repo: null,
    context: null,
    specImpact: null,
    publish: false,
    noBranch: false,
    base: null,
    fetch: false,
    json: false,
    dryRun: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`Falta el valor para ${current}`)
      index += 1
      return value
    }

    if (current === '--title') args.title = next()
    else if (current === '--domain') args.domain = next()
    else if (current === '--module') args.module = next()
    else if (current === '--slug') args.slug = next()
    else if (current === '--repo') args.repo = next()
    else if (current === '--context') args.context = next()
    else if (current === '--spec-impact') args.specImpact = next()
    else if (current === '--base') args.base = next()
    else if (current === '--publish') args.publish = true
    else if (current === '--no-branch') args.noBranch = true
    else if (current === '--fetch') args.fetch = true
    else if (current === '--json') args.json = true
    else if (current === '--dry-run') args.dryRun = true
    else fail(`Argumento no reconocido: ${current}`)
  }

  if (!args.title) fail('Falta --title (título del hotfix).')
  if (!args.domain) fail('Falta --domain (id de sidecar registrado o "shared").')
  if (!args.module) fail('Falta --module (módulo del commit, ej. inventory).')
  if (!args.specImpact) {
    fail('Falta --spec-impact. Usa "none" o una referencia a la enmienda de la spec/tasks.md.')
  }

  args.title = String(args.title).replace(/\s+/g, ' ').trim()
  args.module = String(args.module).trim().toLowerCase().replace(/\s+/g, '-')
  args.specImpact = String(args.specImpact).trim()
  if (args.specImpact.toLowerCase() === 'none') args.specImpact = 'none'

  if (args.domain === 'shared' && !args.repo) {
    fail('El dominio "shared" requiere --repo con el sidecar o "root" para brain-corp.')
  }

  return args
}

function loadSystemMap() {
  try {
    return JSON.parse(fs.readFileSync(SYSTEM_MAP_PATH, 'utf8'))
  } catch (error) {
    fail(`No se pudo leer config/system-map.json: ${error.message}`)
  }
}

function resolveRepoPath({ domain, repoArg, systemMap }) {
  if (repoArg) {
    if (repoArg === 'root' || repoArg === '.') return { path: ROOT_DIR, id: 'root' }
    const byId = systemMap.repositories.find(repository => repository.id === repoArg)
    if (byId) return { path: path.join(ROOT_DIR, byId.path), id: byId.id }
    return { path: path.resolve(ROOT_DIR, repoArg), id: 'custom' }
  }

  const entry = systemMap.repositories.find(repository => repository.id === domain)
  if (!entry) fail(`No hay repositorio configurado para el dominio ${domain}. Usa --repo.`)
  return { path: path.join(ROOT_DIR, entry.path), id: entry.id }
}

function runGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function runGh(args) {
  return execFileSync('gh', args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function nextTicketId() {
  const max = listTickets().reduce((acc, ticket) => {
    const match = String(ticket.data.id || '').match(/^TICK-(\d{3})$/)
    return match ? Math.max(acc, Number(match[1])) : acc
  }, 0)

  const next = max + 1
  if (next > 999) fail('No quedan IDs TICK disponibles (máximo TICK-999).')
  return `TICK-${String(next).padStart(3, '0')}`
}

function readIssueRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO
  if (!fs.existsSync(BRAINRC_PATH)) return null

  try {
    return JSON.parse(fs.readFileSync(BRAINRC_PATH, 'utf8')).repo || null
  } catch {
    return null
  }
}

function extractIssueNumber(output) {
  const match = output.match(/\/issues\/(\d+)/)
  return match ? Number(match[1]) : null
}

function buildTicketBody({ title, context, specImpact, module, domain, repoRelative, branch }) {
  const impactLabel =
    specImpact === 'none' ? 'none (sin spec gobernante afectada).' : specImpact

  const contextText =
    context && context.trim()
      ? context.trim()
      : 'Corrección urgente fuera del flujo SDD completo. El alcance debe mantenerse mínimo y verificable.'

  return [
    '## Contexto / Hallazgo',
    '',
    `Hotfix de emergencia: ${title}.`,
    '',
    contextText,
    '',
    `Impacto declarado en especificaciones: ${impactLabel}`,
    '',
    '## Requerimientos Técnicos',
    '',
    `- Registrar el cambio con commit \`fix(${module}): ${title}\`.`,
    `- Trabajar en la rama \`${branch}\` del repositorio \`${repoRelative}\`.`,
    '- Validar el cambio con los quality gates del sidecar (typecheck/build/tests).',
    `- Impacto en especificaciones: ${impactLabel}`,
    '- Si el cambio altera una spec existente, incluir la enmienda en el mismo PR.',
    '',
    '## Impacto en la Arquitectura',
    '',
    `- Dominio: \`${domain}\`.`,
    `- Repositorio: \`${repoRelative}\`.`,
    `- Rama: \`${branch}\`.`,
    `- Alcance limitado al hotfix; cualquier extensión requiere ticket adicional.`
  ].join('\n')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const systemMap = loadSystemMap()
  const allowedDomains = getTargetDomains(systemMap)

  if (!allowedDomains.has(args.domain)) {
    fail(
      `Dominio inválido: ${args.domain}. Registra el sidecar en config/system-map.json o usa uno de: ${[...allowedDomains].join(', ')}.`
    )
  }

  const repo = resolveRepoPath({
    domain: args.domain,
    repoArg: args.repo,
    systemMap
  })

  try {
    runGit(repo.path, ['rev-parse', '--is-inside-work-tree'])
  } catch {
    fail(`La ruta ${repo.path} no es un repositorio git válido.`)
  }

  const id = nextTicketId()
  const slug = args.slug ? slugify(args.slug) : slugify(args.title)
  const branch = `fix/${id}-${slug}`
  const repoRelative = path.relative(ROOT_DIR, repo.path) || '.'
  const ticketPath = path.join(TICKETS_DIR, 'backlog', `${id}-${slug}.md`)
  const commitMessage = `fix(${args.module}): ${args.title}`

  const data = {
    id,
    title: args.title,
    author: 'Brain-Corp Analyst',
    target_domain: args.domain,
    status: 'backlog',
    created_at: today(),
    dependencies: []
  }

  const body = buildTicketBody({
    title: args.title,
    context: args.context,
    specImpact: args.specImpact,
    module: args.module,
    domain: args.domain,
    repoRelative,
    branch
  })
  const raw = `${buildFrontmatter(data)}\n\n${body}\n`

  let branchCreated = false
  let branchReused = false
  let branchError = null
  let ticketWritten = false
  let githubIssue = null
  let publishError = null

  if (!args.dryRun) {
    writeTicket(ticketPath, raw)
    ticketWritten = true
  }

  if (!args.noBranch) {
    try {
      if (args.fetch) runGit(repo.path, ['fetch', 'origin'])

      const dirty = runGit(repo.path, ['status', '--porcelain'])
      if (dirty) {
        console.warn(
          `[hotfix] El repositorio ${repoRelative} tiene cambios sin commitear; la rama se creará sobre el estado actual.`
        )
      }

      let exists = false
      try {
        runGit(repo.path, ['show-ref', '--verify', `refs/heads/${branch}`])
        exists = true
      } catch {
        exists = false
      }

      if (args.dryRun) {
        branchCreated = !exists
        branchReused = exists
      } else if (exists) {
        runGit(repo.path, ['checkout', branch])
        branchReused = true
      } else if (args.base) {
        runGit(repo.path, ['checkout', '-b', branch, args.base])
        branchCreated = true
      } else {
        runGit(repo.path, ['checkout', '-b', branch])
        branchCreated = true
      }
    } catch (error) {
      branchError = error.stderr ? error.stderr.toString().trim() : error.message
    }
  }

  if (args.publish && !args.dryRun) {
    try {
      const issueRepo = readIssueRepo()
      const ghArgs = [
        'issue',
        'create',
        '--title',
        `[${args.domain.toUpperCase()}] ${args.title}`,
        '--body-file',
        ticketPath
      ]
      if (issueRepo) ghArgs.push('--repo', issueRepo)

      const output = runGh(ghArgs)
      githubIssue = extractIssueNumber(output)

      if (githubIssue) {
        const current = fs.readFileSync(ticketPath, 'utf8')
        writeTicket(ticketPath, updateFrontmatter(current, { github_issue: githubIssue }))
      }
    } catch (error) {
      publishError = error.stderr ? error.stderr.toString().trim() : error.message
    }
  }

  const result = {
    id,
    title: args.title,
    domain: args.domain,
    module: args.module,
    ticket: ticketWritten ? path.relative(ROOT_DIR, ticketPath) : null,
    repo: repoRelative,
    branch,
    branch_created: branchCreated,
    branch_reused: branchReused,
    branch_error: branchError,
    spec_impact: args.specImpact,
    commit_message: commitMessage,
    github_issue: githubIssue,
    publish_error: publishError,
    dry_run: Boolean(args.dryRun)
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    if (ticketWritten) console.log(`[hotfix] Ticket creado: ${result.ticket}`)
    else console.log('[hotfix] dry-run: no se escribió el ticket.')
    console.log(`[hotfix] Rama: ${branch} (${repoRelative})`)
    console.log(`[hotfix] Commit sugerido: ${commitMessage}`)
    console.log(`[hotfix] Spec impact: ${args.specImpact}`)
    console.log('[hotfix] Siguiente: node scripts/sanity-check.js --write')
    if (githubIssue) console.log(`[hotfix] Issue #${githubIssue} creado.`)
    if (branchError) console.error(`[hotfix] Error al crear la rama: ${branchError}`)
    if (publishError) console.error(`[hotfix] Error al publicar el issue: ${publishError}`)
  }

  if (branchError || publishError) process.exitCode = 1
}

main()
