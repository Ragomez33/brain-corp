const fs = require('node:fs')
const path = require('node:path')
const {
  ROOT_DIR,
  buildFrontmatter,
  listTickets,
  normalizeTicketId,
  ticketSlugFromFileName,
  writeTicket
} = require('./tickets')
const { t } = require('./i18n')

function samePath(first, second) {
  const a = path.resolve(first)
  const b = path.resolve(second)
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/')
}

/**
 * Aligns existing ticket files with their canonical id without touching GitHub.
 *
 * - Normalizes ids such as TICK-7 to TICK-007 when there is no collision.
 * - Rewrites dependencies that point to a normalized id.
 * - Renames files to TICK-XXX-<slug>.md when the file name does not match the id.
 * - Never moves tickets between status folders.
 *
 * Anything ambiguous is reported and left untouched so sanity-check remains the
 * blocking gate.
 */
function repairTickets({ rootDir = ROOT_DIR } = {}) {
  const tickets = listTickets(rootDir)
  const results = { normalized: [], renamed: [], errors: [] }

  const canonicalCounts = new Map()

  for (const ticket of tickets) {
    const canonical = normalizeTicketId(ticket.data.id)
    if (!canonical) continue
    canonicalCounts.set(canonical, (canonicalCounts.get(canonical) || 0) + 1)
  }

  const remap = new Map()

  for (const ticket of tickets) {
    const raw = String(ticket.data.id || '').trim().toUpperCase()
    const canonical = normalizeTicketId(raw)

    if (!canonical || canonical === raw) continue

    if ((canonicalCounts.get(canonical) || 0) > 1) {
      results.errors.push(
        `${path.basename(ticket.filePath)}: cannot normalize ${raw} to ${canonical}; the canonical id is used by more than one ticket.`
      )
      continue
    }

    remap.set(raw, canonical)
  }

  const plan = []

  for (const ticket of tickets) {
    const raw = String(ticket.data.id || '').trim().toUpperCase()
    const canonical = normalizeTicketId(raw)

    if (!canonical) {
      results.errors.push(
        `${path.basename(ticket.filePath)}: "id" is not a valid TICK id (${ticket.data.id}).`
      )
      continue
    }

    const targetPath = path.join(
      path.dirname(ticket.filePath),
      `${canonical}-${ticketSlugFromFileName(ticket.filePath, ticket.data.title)}.md`
    )

    const item = { ticket, raw, canonical, targetPath, conflict: false }

    if ((canonicalCounts.get(canonical) || 0) > 1) {
      item.conflict = true
      results.errors.push(
        `${path.basename(ticket.filePath)}: canonical id ${canonical} is duplicated; resolve the duplicate before repairing names.`
      )
    }

    plan.push(item)
  }

  const targets = new Map()

  for (const item of plan) {
    if (item.conflict) continue

    const resolved = path.resolve(item.targetPath)
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved
    const other = targets.get(key)

    if (other) {
      item.conflict = true
      other.conflict = true
      results.errors.push(
        `${path.basename(item.ticket.filePath)} and ${path.basename(other.ticket.filePath)} would both become ${path.basename(item.targetPath)}.`
      )
      continue
    }

    targets.set(key, item)
  }

  for (const item of plan) {
    if (item.conflict) continue

    if (!samePath(item.ticket.filePath, item.targetPath) && fs.existsSync(item.targetPath)) {
      item.conflict = true
      results.errors.push(
        `${path.basename(item.ticket.filePath)}: cannot rename to ${path.basename(item.targetPath)}; the target already exists.`
      )
    }
  }

  for (const item of plan) {
    if (item.conflict) continue

    const { ticket, raw, canonical } = item
    const updates = {}

    if (canonical !== raw) updates.id = canonical

    const deps = Array.isArray(ticket.data.dependencies)
      ? ticket.data.dependencies.map(String)
      : []

    const nextDeps = deps.map(dep => {
      const depRaw = String(dep).trim().toUpperCase()

      if (remap.has(depRaw)) return remap.get(depRaw)

      const depCanonical = normalizeTicketId(depRaw)
      if (
        depCanonical &&
        depCanonical !== depRaw &&
        (canonicalCounts.get(depCanonical) || 0) === 1
      ) {
        return depCanonical
      }

      return dep
    })

    if (nextDeps.some((dep, index) => dep !== deps[index])) {
      updates.dependencies = nextDeps
    }

    if (Object.keys(updates).length > 0) {
      const nextData = { ...ticket.data, ...updates }
      const nextRaw = `${buildFrontmatter(nextData)}\n\n${String(
        ticket.content || ''
      ).replace(/^\s+/, '')}`

      writeTicket(ticket.filePath, nextRaw)

      if (updates.id) {
        results.normalized.push({
          from: raw,
          to: canonical,
          file: relative(rootDir, ticket.filePath)
        })
      }
    }

    if (!samePath(ticket.filePath, item.targetPath)) {
      fs.renameSync(ticket.filePath, item.targetPath)
      results.renamed.push({
        from: relative(rootDir, ticket.filePath),
        to: relative(rootDir, item.targetPath)
      })
    }
  }

  return results
}

function logRepair(result) {
  for (const item of result.normalized) {
    console.log(t('repair.normalized', item))
  }

  for (const item of result.renamed) {
    console.log(t('repair.renamed', item))
  }

  for (const error of result.errors) {
    console.warn(t('repair.error', { error }))
  }
}

module.exports = {
  logRepair,
  repairTickets
}
