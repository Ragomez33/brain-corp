const path = require('node:path')
const { listTickets } = require('./tickets')

const ALLOWED_DOMAINS = new Set(['forge-backend', 'forge-front', 'foundly-pos', 'shared'])
const REQUIRED_SECTIONS = [
  '## Contexto / Hallazgo',
  '## Requerimientos Técnicos',
  '## Impacto en la Arquitectura'
]
const ID_PATTERN = /^TICK-\d{3}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const API_REQUIREMENT_PATTERNS = [
  /\b(falta|faltan)\s+(la\s+|el\s+|una\s+|un\s+)?(mutaci[oó]n|mutation|query|endpoint|resolver|migraci[oó]n)\b/i,
  /\b(no existe|no existen|no hay)\s+(la\s+|el\s+|una\s+|un\s+)?(mutaci[oó]n|mutation|query|endpoint|resolver|migraci[oó]n)\b/i,
  /\b(agregar|crear|exponer|añadir|anadir)\s+(la\s+|el\s+|una\s+|un\s+)?(mutaci[oó]n|mutation|query|endpoint|resolver|migraci[oó]n)\b/i,
  /\b(cambio|modificaci[oó]n|actualizaci[oó]n)\b[^\n]{0,80}\b(schema\.prisma|schema\.gql|contrato graphql)\b/i,
  /\bmodelo\s+prisma\s+sin\b/i,
  /\b(mutaci[oó]n|mutation)\b[^\n]{0,40}\b(faltante|inexistente|no expuest[ao])\b/i,
  /\b(query|endpoint|resolver)\b[^\n]{0,40}\b(faltante|inexistente|no expuest[ao])\b/i
]

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function ticketLabel(ticket) {
  return ticket.data.id || path.basename(ticket.filePath)
}

function isBackendTicket(ticket) {
  return ticket.data.target_domain === 'forge-backend' || ticket.data.target_domain === 'shared'
}

function requiresBackendWork(text) {
  return API_REQUIREMENT_PATTERNS.some(pattern => pattern.test(text))
}

function detectCycles(byId, dependencies) {
  const cycles = []
  const visiting = new Set()
  const visited = new Set()
  const stack = []

  function visit(id) {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      const start = stack.indexOf(id)
      cycles.push([...stack.slice(start), id])
      return
    }

    visiting.add(id)
    stack.push(id)

    for (const dep of dependencies.get(id) || []) {
      if (byId.has(dep)) visit(dep)
    }

    stack.pop()
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of byId.keys()) visit(id)
  return cycles
}

function runSanityCheck() {
  const tickets = listTickets()
  const errors = []
  const warnings = []
  const byId = new Map()
  const dependencies = new Map()
  const titles = new Map()
  const fileNames = new Map()

  for (const ticket of tickets) {
    const label = ticketLabel(ticket)
    const data = ticket.data || {}
    const fileName = path.basename(ticket.filePath)

    if (!data.id) {
      errors.push(`${fileName}: falta el campo obligatorio "id".`)
    } else if (!ID_PATTERN.test(String(data.id))) {
      errors.push(`${fileName}: "id" inválido (${data.id}); se espera TICK-XXX.`)
    }

    if (!data.title) errors.push(`${fileName}: falta el campo obligatorio "title".`)
    if (!data.author) errors.push(`${fileName}: falta el campo obligatorio "author".`)
    if (!data.target_domain) {
      errors.push(`${fileName}: falta el campo obligatorio "target_domain".`)
    } else if (!ALLOWED_DOMAINS.has(data.target_domain)) {
      errors.push(`${fileName}: "target_domain" inválido (${data.target_domain}).`)
    }

    if (!data.status) {
      errors.push(`${fileName}: falta el campo obligatorio "status".`)
    } else if (data.status !== ticket.dir) {
      errors.push(
        `${fileName}: "status" (${data.status}) no coincide con la carpeta (${ticket.dir}).`
      )
    }

    if (!data.created_at) {
      errors.push(`${fileName}: falta el campo obligatorio "created_at".`)
    } else if (!DATE_PATTERN.test(String(data.created_at))) {
      errors.push(`${fileName}: "created_at" inválido (${data.created_at}); se espera YYYY-MM-DD.`)
    }

    if (data.dependencies === undefined) {
      errors.push(`${fileName}: falta el campo obligatorio "dependencies".`)
    } else if (!Array.isArray(data.dependencies)) {
      errors.push(`${fileName}: "dependencies" debe ser una lista YAML.`)
    }

    if (data.github_issue !== undefined) {
      const issue = Number(data.github_issue)
      if (!Number.isInteger(issue) || issue <= 0) {
        errors.push(`${fileName}: "github_issue" inválido (${data.github_issue}).`)
      }
    }

    for (const section of REQUIRED_SECTIONS) {
      if (!String(ticket.content || '').includes(section)) {
        errors.push(`${fileName}: falta la sección obligatoria "${section}".`)
      }
    }

    if (data.id) {
      if (byId.has(data.id)) {
        errors.push(
          `${fileName}: "id" duplicado ${data.id}; también existe en ${path.basename(
            byId.get(data.id).filePath
          )}.`
        )
      } else {
        byId.set(data.id, ticket)
      }

      if (!fileName.startsWith(`${data.id}-`) && fileName !== `${data.id}.md`) {
        warnings.push(`${fileName}: el nombre no comienza con el id ${data.id}.`)
      }

      if (fileNames.has(fileName)) {
        errors.push(`${fileName}: nombre de archivo duplicado en el backlog.`)
      } else {
        fileNames.set(fileName, ticket)
      }
    }

    const normalizedTitle = normalizeText(data.title)
    if (normalizedTitle) {
      if (titles.has(normalizedTitle)) {
        warnings.push(
          `${label}: título equivalente al de ${titles.get(normalizedTitle)}; revisar posible duplicado.`
        )
      } else {
        titles.set(normalizedTitle, label)
      }
    }

    dependencies.set(
      data.id,
      Array.isArray(data.dependencies) ? data.dependencies.map(String) : []
    )
  }

  for (const ticket of tickets) {
    const label = ticketLabel(ticket)
    const deps = dependencies.get(ticket.data.id) || []

    for (const dep of deps) {
      if (!ID_PATTERN.test(dep)) {
        errors.push(`${label}: dependencia con formato inválido "${dep}".`)
        continue
      }

      if (dep === ticket.data.id) {
        errors.push(`${label}: no puede depender de sí mismo.`)
        continue
      }

      if (!byId.has(dep)) {
        errors.push(`${label}: la dependencia ${dep} no existe en ningún estado de tickets.`)
      }
    }

    if (ticket.data.target_domain === 'forge-front' && requiresBackendWork(ticket.content)) {
      const hasBackendDependency = deps.some(dep => {
        const depTicket = byId.get(dep)
        return depTicket ? isBackendTicket(depTicket) : false
      })

      if (!hasBackendDependency) {
        errors.push(
          `${label}: el ticket de frontend requiere trabajo de API/backend pero no declara una dependencia a un ticket forge-backend/shared.`
        )
      }
    }
  }

  for (const cycle of detectCycles(byId, dependencies)) {
    errors.push(`Ciclo de dependencias detectado: ${cycle.join(' -> ')}.`)
  }

  const ticketResults = tickets
    .filter(ticket => ticket.dir === 'backlog')
    .map(ticket => {
      const label = ticket.data.id
      const ticketErrors = errors.filter(error => error.startsWith(`${label}:`))
      const ticketWarnings = warnings.filter(warning => warning.startsWith(`${label}:`))

      return {
        id: label || path.basename(ticket.filePath, '.md'),
        file: path.relative(path.resolve(__dirname, '..', '..'), ticket.filePath),
        status: ticketErrors.length > 0 ? 'error' : 'ok',
        fixes: [],
        warnings: ticketWarnings
      }
    })

  return {
    ok: errors.length === 0,
    ready_for_sync: errors.length === 0,
    checked_at: new Date().toISOString(),
    totals: {
      tickets: tickets.length,
      backlog: ticketResults.length,
      errors: errors.length,
      warnings: warnings.length
    },
    errors,
    warnings,
    tickets: ticketResults
  }
}

module.exports = {
  ALLOWED_DOMAINS,
  REQUIRED_SECTIONS,
  runSanityCheck,
  requiresBackendWork
}
