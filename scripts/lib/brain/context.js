const fs = require('node:fs')
const path = require('node:path')
const { parseTicket, STATUS_DIRS } = require('../tickets')
const { getRegisteredRepositories, readSystemMap } = require('../system-map')
const { brainDir } = require('./state')

function ticketsDir(rootDir) {
  return path.join(rootDir, '.agents', 'tickets')
}

function normalizeTicketId(value) {
  return String(value || '').trim().toUpperCase()
}

function findTicket(rootDir, ticketId) {
  const normalized = normalizeTicketId(ticketId)
  if (!normalized) return null

  for (const state of STATUS_DIRS) {
    const directory = path.join(ticketsDir(rootDir), state)
    if (!fs.existsSync(directory)) continue

    for (const file of fs.readdirSync(directory)) {
      if (!file.endsWith('.md')) continue
      if (!file.toUpperCase().startsWith(normalized)) continue

      return parseTicket(path.join(directory, file))
    }
  }

  return null
}

function findRepository(repositories, repoId) {
  const normalized = String(repoId || '').trim().toLowerCase()
  if (!normalized) return null

  return (
    repositories.find(repository => {
      return (
        String(repository.id || '').toLowerCase() === normalized ||
        String(repository.name || '').toLowerCase() === normalized
      )
    }) || null
  )
}

function repositoryRelationships(map, repoId) {
  const relationships = Array.isArray(map.relationships) ? map.relationships : []

  return relationships.filter(relationship => {
    return relationship && (relationship.from === repoId || relationship.to === repoId)
  })
}

function requiresContract(map, repository, ticket) {
  const targetDomain = String(ticket?.data?.target_domain || '').trim().toLowerCase()
  if (targetDomain === 'shared') return true

  const relationships = repositoryRelationships(map, repository.id)
  if (relationships.length === 0) return false

  return relationships.some(relationship => {
    return relationship.from !== relationship.to
  })
}

function relatedRepositories(map, repository) {
  const relationships = repositoryRelationships(map, repository.id)

  return relationships.map(relationship => {
    const otherId = relationship.from === repository.id ? relationship.to : relationship.from
    return {
      id: otherId,
      direction: relationship.from === repository.id ? 'outgoing' : 'incoming',
      type: relationship.type || null
    }
  })
}

function resolveContext({ rootDir = process.cwd(), ticketId, repoId }) {
  if (!ticketId) {
    throw new Error('Missing ticket. Usage: <command> TICK-XXX [--repo <id>].')
  }

  const ticket = findTicket(rootDir, ticketId)
  if (!ticket) {
    throw new Error(`Ticket ${normalizeTicketId(ticketId)} was not found in .agents/tickets/.`)
  }

  const map = readSystemMap(rootDir)
  const repositories = getRegisteredRepositories(map)
  const targetDomain = String(ticket.data.target_domain || '').trim()

  let repository = repoId ? findRepository(repositories, repoId) : findRepository(repositories, targetDomain)

  if (!repository && targetDomain === 'shared') {
    throw new Error(
      'The ticket is "shared": specify the base repository with --repo <id> to locate the feature.'
    )
  }

  if (!repository) {
    throw new Error(
      `target_domain "${targetDomain}" does not match any registered repository.`
    )
  }

  const repoDir = path.resolve(rootDir, repository.path)
  const featureDir = path.join(brainDir(repoDir), 'features', normalizeTicketId(ticket.data.id || ticketId))
  const contractRequired = requiresContract(map, repository, ticket)

  return {
    rootDir,
    map,
    ticket,
    ticketId: normalizeTicketId(ticket.data.id || ticketId),
    targetDomain,
    repository,
    repoDir,
    featureDir,
    contractRequired,
    related: relatedRepositories(map, repository),
    variables: {
      TICKET_ID: normalizeTicketId(ticket.data.id || ticketId),
      TICKET_TITLE: String(ticket.data.title || ticketId),
      SOURCE_TICKET: path
        .relative(rootDir, ticket.filePath)
        .split(path.sep)
        .join('/'),
      REPO_ID: repository.id,
      TARGET_DOMAIN: targetDomain,
      DATE: new Date().toISOString().slice(0, 10)
    }
  }
}

module.exports = {
  findRepository,
  findTicket,
  normalizeTicketId,
  relatedRepositories,
  repositoryRelationships,
  requiresContract,
  resolveContext,
  ticketsDir
}
