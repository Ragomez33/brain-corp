const path = require('node:path')
const { listTickets, normalizeTicketId } = require('./tickets')
const {
  getAllApiPatterns,
  getRequiredTicketSections,
  loadAllPacks
} = require('./validation')
const {
  getRegisteredRepositories,
  getTargetDomains,
  readSystemMap
} = require('./system-map')

const REQUIRED_SECTIONS = getRequiredTicketSections()
const REQUIRED_SECTION_GROUPS = loadAllPacks().map(pack => [
  pack.ticketSections.context,
  pack.ticketSections.requirements,
  pack.ticketSections.architecture
])
const ID_PATTERN = /^TICK-\d{3}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const API_REQUIREMENT_PATTERNS = getAllApiPatterns().map(source => new RegExp(source, 'i'))

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

function requiresBackendWork(text) {
  return API_REQUIREMENT_PATTERNS.some(pattern => pattern.test(text))
}

function isProviderDomain(domain, domainRoles) {
  return domain === 'shared' || domainRoles.get(domain) === 'provider'
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
  const systemMap = readSystemMap()
  const allowedDomains = getTargetDomains(systemMap)
  const domainRoles = new Map(
    getRegisteredRepositories(systemMap).map(repository => [
      repository.id,
      repository.role
    ])
  )
  const errors = []
  const warnings = []
  const byId = new Map()
  const dependencies = new Map()
  const titles = new Map()
  const fileNames = new Map()
  const issueNumbers = new Map()
  const canonicalIds = new Map()

  for (const ticket of tickets) {
    const label = ticketLabel(ticket)
    const data = ticket.data || {}
    const fileName = path.basename(ticket.filePath)

    if (!data.id) {
      errors.push(`${fileName}: missing required field "id".`)
    } else if (!ID_PATTERN.test(String(data.id))) {
      errors.push(`${fileName}: "id" is invalid (${data.id}); expected TICK-XXX.`)
    }

    if (!data.title) errors.push(`${fileName}: missing required field "title".`)
    if (!data.author) errors.push(`${fileName}: missing required field "author".`)
    if (!data.target_domain) {
      errors.push(`${fileName}: missing required field "target_domain".`)
    } else if (!allowedDomains.has(data.target_domain)) {
      errors.push(
        `${fileName}: invalid "target_domain" (${data.target_domain}); allowed: ${[...allowedDomains].join(', ')}.`
      )
    }

    if (!data.status) {
      errors.push(`${fileName}: missing required field "status".`)
    } else if (data.status !== ticket.dir) {
      errors.push(
        `${fileName}: "status" (${data.status}) does not match folder (${ticket.dir}).`
      )
    }

    if (!data.created_at) {
      errors.push(`${fileName}: missing required field "created_at".`)
    } else if (!DATE_PATTERN.test(String(data.created_at))) {
      errors.push(`${fileName}: "created_at" is invalid (${data.created_at}); expected YYYY-MM-DD.`)
    }

    if (data.dependencies === undefined) {
      errors.push(`${fileName}: missing required field "dependencies".`)
    } else if (!Array.isArray(data.dependencies)) {
      errors.push(`${fileName}: "dependencies" must be a YAML list.`)
    }

    if (data.github_issue !== undefined) {
      const issue = Number(data.github_issue)
      if (!Number.isInteger(issue) || issue <= 0) {
        errors.push(`${fileName}: "github_issue" is invalid (${data.github_issue}).`)
      } else if (issueNumbers.has(issue)) {
        errors.push(
          `${fileName}: "github_issue" (${issue}) is duplicated; also used by ${issueNumbers.get(issue)}.`
        )
      } else {
        issueNumbers.set(issue, fileName)
      }
    }

    const content = String(ticket.content || '')
    const hasCompleteSectionGroup = REQUIRED_SECTION_GROUPS.some(group =>
      group.every(section => content.includes(section))
    )

    if (!hasCompleteSectionGroup) {
      for (const section of REQUIRED_SECTIONS) {
        errors.push(`${fileName}: missing required section "${section}".`)
      }
    }

    if (data.id) {
      if (byId.has(data.id)) {
        errors.push(
          `${fileName}: "id" duplicated ${data.id}; also exists in ${path.basename(
            byId.get(data.id).filePath
          )}.`
        )
      } else {
        byId.set(data.id, ticket)
      }

      const canonicalId =
        normalizeTicketId(data.id) || String(data.id).trim().toUpperCase()

      if (canonicalIds.has(canonicalId)) {
        errors.push(
          `${fileName}: canonical id ${canonicalId} is duplicated; also exists in ${path.basename(
            canonicalIds.get(canonicalId).filePath
          )}.`
        )
      } else {
        canonicalIds.set(canonicalId, ticket)
      }

      if (!fileName.startsWith(`${data.id}-`) && fileName !== `${data.id}.md`) {
        errors.push(
          `${fileName}: file name does not start with id ${data.id}. Run "brain sync" or "brain sync:pull" to repair it automatically.`
        )
      }

      if (fileNames.has(fileName)) {
        errors.push(`${fileName}: duplicate file name in the backlog.`)
      } else {
        fileNames.set(fileName, ticket)
      }
    }

    const normalizedTitle = normalizeText(data.title)
    if (normalizedTitle) {
      if (titles.has(normalizedTitle)) {
        warnings.push(
          `${label}: title is equivalent to ${titles.get(normalizedTitle)}; check for a possible duplicate.`
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
        errors.push(`${label}: dependency has invalid format "${dep}".`)
        continue
      }

      if (dep === ticket.data.id) {
        errors.push(`${label}: cannot depend on itself.`)
        continue
      }

      if (!byId.has(dep)) {
        errors.push(`${label}: dependency ${dep} does not exist in any ticket state.`)
      }
    }

    if (
      domainRoles.get(ticket.data.target_domain) === 'client' &&
      requiresBackendWork(ticket.content)
    ) {
      const hasProviderDependency = deps.some(dep => {
        const depTicket = byId.get(dep)
        return depTicket
          ? isProviderDomain(depTicket.data.target_domain, domainRoles)
          : false
      })

      if (!hasProviderDependency) {
        errors.push(
          `${label}: a client sidecar ticket requires API/backend work but does not declare a dependency on a provider or shared ticket.`
        )
      }
    }
  }

  for (const cycle of detectCycles(byId, dependencies)) {
    errors.push(`Dependency cycle detected: ${cycle.join(' -> ')}.`)
  }

  const ticketResults = tickets
    .filter(ticket => ticket.dir === 'backlog')
    .map(ticket => {
      const label = ticket.data.id
      const ticketErrors = errors.filter(error => error.startsWith(`${label}:`))
      const ticketWarnings = warnings.filter(warning => warning.startsWith(`${label}:`))

      return {
        id: label || path.basename(ticket.filePath, '.md'),
        file: path.relative(process.cwd(), ticket.filePath),
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
  REQUIRED_SECTIONS,
  runSanityCheck,
  requiresBackendWork
}
