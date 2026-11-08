const fs = require('node:fs')
const path = require('node:path')
const matter = require('gray-matter')
const { getRegisteredRepositories, readSystemMap } = require('./system-map')

// The workspace root is the user's cwd; scripts live in the package.
const ROOT_DIR = process.cwd()
const TICKETS_DIR = path.join(ROOT_DIR, '.agents', 'tickets')
const STATUS_DIRS = ['backlog', 'in-analysis', 'ready', 'done']
const REQUIRED_FIELDS = [
  'id',
  'title',
  'author',
  'target_domain',
  'status',
  'created_at',
  'dependencies'
]

const FRONTMATTER_ORDER = [
  'id',
  'title',
  'author',
  'target_domain',
  'status',
  'created_at',
  'dependencies',
  'github_issue'
]

function ensureTicketDirs() {
  for (const dir of STATUS_DIRS) {
    fs.mkdirSync(path.join(TICKETS_DIR, dir), { recursive: true })
  }
}

function slugify(value, maxLength = 60) {
  const slug = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')

  return slug || 'ticket'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatYamlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => JSON.stringify(String(item))).join(', ')}]`
  }
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(String(value))
}

function buildFrontmatter(data) {
  const keys = [
    ...FRONTMATTER_ORDER.filter(key => data[key] !== undefined),
    ...Object.keys(data).filter(key => !FRONTMATTER_ORDER.includes(key))
  ]

  const lines = keys.map(key => `${key}: ${formatYamlValue(data[key])}`)

  return `---\n${lines.join('\n')}\n---`
}

function parseTicket(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = matter(raw)

  return {
    filePath,
    dir: path.basename(path.dirname(filePath)),
    raw,
    data: parsed.data,
    content: parsed.content
  }
}

function listTickets() {
  ensureTicketDirs()

  const tickets = []

  for (const dir of STATUS_DIRS) {
    const absoluteDir = path.join(TICKETS_DIR, dir)
    const files = fs.readdirSync(absoluteDir).filter(file => file.endsWith('.md'))

    for (const file of files) {
      tickets.push(parseTicket(path.join(absoluteDir, file)))
    }
  }

  return tickets
}

function hasStrictFrontmatter(raw) {
  if (!/^---\r?\n/.test(raw)) return false

  try {
    const parsed = matter(raw)
    return REQUIRED_FIELDS.every(
      field => parsed.data[field] !== undefined && parsed.data[field] !== null
    )
  } catch {
    return false
  }
}

function inferIssueNumber(filePath, data = {}) {
  const fromData = Number(data.github_issue)
  return Number.isInteger(fromData) && fromData > 0 ? fromData : null
}

function findTicketByIssue(issueNumber) {
  const target = Number(issueNumber)
  if (!Number.isInteger(target) || target <= 0) return null

  return (
    listTickets().find(ticket => {
      const ticketIssue = inferIssueNumber(ticket.filePath, ticket.data)
      return ticketIssue === target
    }) || null
  )
}

function updateFrontmatter(raw, updates) {
  const lines = raw.split(/\r?\n/)
  const openIndex = lines.findIndex(line => line.trim() === '---')

  if (openIndex === -1) {
    return `${buildFrontmatter(updates)}\n\n${raw.replace(/^\s+/, '')}`
  }

  let closeIndex = lines.findIndex(
    (line, index) => index > openIndex && line.trim() === '---'
  )

  if (closeIndex === -1) {
    throw new Error('Unclosed YAML frontmatter')
  }

  for (const [key, value] of Object.entries(updates)) {
    const newLine = `${key}: ${formatYamlValue(value)}`
    const existingIndex = lines.findIndex(
      (line, index) =>
        index > openIndex && index < closeIndex && new RegExp(`^${key}\\s*:`).test(line)
    )

    if (existingIndex !== -1) {
      lines[existingIndex] = newLine
    } else {
      lines.splice(closeIndex, 0, newLine)
      closeIndex += 1
    }
  }

  return lines.join('\n')
}

function writeTicket(filePath, raw) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, raw.endsWith('\n') ? raw : `${raw}\n`, 'utf8')
}

function moveTicket(filePath, targetStatus) {
  const targetDir = path.join(TICKETS_DIR, targetStatus)
  const targetPath = path.join(targetDir, path.basename(filePath))

  if (path.resolve(filePath) === path.resolve(targetPath)) return targetPath

  fs.mkdirSync(targetDir, { recursive: true })
  fs.renameSync(filePath, targetPath)

  return targetPath
}

function inferTargetDomain(text) {
  const normalized = String(text || '').toLowerCase()
  const repositories = getRegisteredRepositories(readSystemMap(ROOT_DIR))

  if (repositories.length === 0) return 'shared'

  const scores = new Map()

  for (const repository of repositories) {
    const id = String(repository.id || repository.name || '').toLowerCase()
    if (!id) continue

    const values = [
      repository.id,
      repository.name,
      repository.type,
      ...(Array.isArray(repository.domains) ? repository.domains : []),
      ...(Array.isArray(repository.keywords) ? repository.keywords : []),
      ...(Array.isArray(repository.stack) ? repository.stack : [])
    ]

    const keywords = [
      ...new Set(
        values
          .filter(Boolean)
          .map(value => String(value).toLowerCase().trim())
          .filter(value => value.length >= 3)
      )
    ]

    let score = normalized.includes(id) ? 3 : 0

    for (const keyword of keywords) {
      if (normalized.includes(keyword)) score += 1
    }

    scores.set(id, score)
  }

  const entries = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const [bestDomain, bestScore] = entries[0] || ['shared', 0]
  const [, secondScore] = entries[1] || ['shared', 0]

  if (bestScore === 0) return 'shared'
  if (bestScore === secondScore) return 'shared'

  return bestDomain
}

module.exports = {
  ROOT_DIR,
  TICKETS_DIR,
  STATUS_DIRS,
  ensureTicketDirs,
  slugify,
  today,
  buildFrontmatter,
  parseTicket,
  listTickets,
  hasStrictFrontmatter,
  inferIssueNumber,
  findTicketByIssue,
  updateFrontmatter,
  writeTicket,
  moveTicket,
  inferTargetDomain
}
