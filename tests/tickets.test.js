const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, after } = require('node:test')
const assert = require('node:assert/strict')

const ORIGINAL_CWD = process.cwd()
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-corp-test-'))

process.env.BRAIN_LANG = 'en'
process.chdir(TEMP_ROOT)

const tickets = require('../scripts/lib/tickets')
const { repairTickets } = require('../scripts/lib/repair')
const { buildNewTicket } = require('../scripts/sync-pull')
const { runSanityCheck } = require('../scripts/lib/sanity')
const { findTicket } = require('../scripts/lib/brain/context')

function reset() {
  fs.rmSync(path.join(TEMP_ROOT, '.agents'), { recursive: true, force: true })
  tickets.ensureTicketDirs(TEMP_ROOT)
}

function ticketBody({ id, title = 'Ticket', dependencies = [], issue = null }) {
  const data = {
    id,
    title,
    author: 'Brain-Corp Analyst',
    target_domain: 'shared',
    status: 'backlog',
    created_at: '2026-11-11',
    dependencies
  }

  if (issue) data.github_issue = issue

  return `${tickets.buildFrontmatter(data)}

## Context / Finding

Text.

## Technical Requirements

Text.

## Architecture Impact

Text.
`
}

function writeTicketFile(name, content) {
  const file = path.join(TEMP_ROOT, '.agents', 'tickets', 'backlog', name)
  fs.writeFileSync(file, content, 'utf8')
  return file
}

function readTicket(file) {
  return tickets.parseTicket(file).data
}

after(() => {
  process.chdir(ORIGINAL_CWD)
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
})

test('sync-pull names strict tickets from the frontmatter id', () => {
  reset()

  const result = buildNewTicket({
    number: 6,
    title: 'Onboarding wizard',
    state: 'OPEN',
    body: ticketBody({ id: 'TICK-014' })
  })

  assert.equal(path.basename(result.path), 'TICK-014-onboarding-wizard.md')
  assert.equal(readTicket(result.path).id, 'TICK-014')
  assert.equal(readTicket(result.path).github_issue, 6)
})

test('sync-pull normalizes legacy one-digit ids', () => {
  reset()

  const result = buildNewTicket({
    number: 7,
    title: 'Brevo',
    state: 'OPEN',
    body: ticketBody({ id: 'TICK-7' })
  })

  assert.equal(path.basename(result.path), 'TICK-007-brevo.md')
  assert.equal(readTicket(result.path).id, 'TICK-007')
})

test('sync-pull refuses to reuse an existing ticket id', () => {
  reset()
  writeTicketFile('TICK-014-existing.md', ticketBody({ id: 'TICK-014' }))

  assert.throws(
    () =>
      buildNewTicket({
        number: 6,
        title: 'Another ticket',
        state: 'OPEN',
        body: ticketBody({ id: 'TICK-014' })
      }),
    /already exists/
  )
})

test('repair renames files to match their canonical id', () => {
  reset()
  const original = writeTicketFile('TICK-6-avatar.md', ticketBody({ id: 'TICK-014' }))
  const target = path.join(path.dirname(original), 'TICK-014-avatar.md')

  const result = repairTickets({ rootDir: TEMP_ROOT })

  assert.equal(fs.existsSync(original), false)
  assert.equal(fs.existsSync(target), true)
  assert.equal(readTicket(target).id, 'TICK-014')
  assert.equal(result.renamed.length, 1)
})

test('repair normalizes ids and rewrites dependencies', () => {
  reset()
  writeTicketFile('TICK-7-brevo.md', ticketBody({ id: 'TICK-7' }))
  const consumer = writeTicketFile(
    'TICK-020-consumer.md',
    ticketBody({ id: 'TICK-020', dependencies: ['TICK-7'] })
  )

  repairTickets({ rootDir: TEMP_ROOT })

  assert.equal(
    fs.existsSync(
      path.join(TEMP_ROOT, '.agents', 'tickets', 'backlog', 'TICK-007-brevo.md')
    ),
    true
  )
  assert.deepEqual(readTicket(consumer).dependencies, ['TICK-007'])
})

test('repair rewrites block-style dependency lists safely', () => {
  reset()
  writeTicketFile('TICK-7-brevo.md', ticketBody({ id: 'TICK-7' }))
  const consumer = writeTicketFile(
    'TICK-021-block.md',
    `---
id: "TICK-021"
title: "Block dependencies"
author: "Brain-Corp Analyst"
target_domain: "shared"
status: "backlog"
created_at: "2026-11-11"
dependencies:
  - TICK-7
---

## Context / Finding

Text.

## Technical Requirements

Text.

## Architecture Impact

Text.
`
  )

  repairTickets({ rootDir: TEMP_ROOT })

  assert.deepEqual(readTicket(consumer).dependencies, ['TICK-007'])
})

test('repair leaves a previously mismatched workspace sane', () => {
  reset()
  writeTicketFile('TICK-6-avatar.md', ticketBody({ id: 'TICK-014' }))
  writeTicketFile('TICK-7-brevo.md', ticketBody({ id: 'TICK-7' }))
  writeTicketFile(
    'TICK-020-consumer.md',
    ticketBody({ id: 'TICK-020', dependencies: ['TICK-7'] })
  )

  repairTickets({ rootDir: TEMP_ROOT })

  const result = runSanityCheck()
  assert.equal(result.ok, true, result.errors.join('\n'))
})

test('sanity blocks a file name that does not match the id', () => {
  reset()
  writeTicketFile('TICK-6-avatar.md', ticketBody({ id: 'TICK-014' }))

  const result = runSanityCheck()

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(error =>
      error.includes('file name does not start with id TICK-014')
    )
  )
})

test('sanity blocks a duplicated github_issue', () => {
  reset()
  writeTicketFile('TICK-030-first.md', ticketBody({ id: 'TICK-030', issue: 42 }))
  writeTicketFile('TICK-031-second.md', ticketBody({ id: 'TICK-031', issue: 42 }))

  const result = runSanityCheck()

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(error => error.includes('"github_issue" (42) is duplicated'))
  )
})

test('sanity blocks canonical id collisions', () => {
  reset()
  writeTicketFile('TICK-7-brevo.md', ticketBody({ id: 'TICK-7' }))
  writeTicketFile('TICK-007-other.md', ticketBody({ id: 'TICK-007' }))

  const result = runSanityCheck()

  assert.equal(result.ok, false)
  assert.ok(
    result.errors.some(error => error.includes('canonical id TICK-007 is duplicated'))
  )
})

test('SDD lookup resolves the canonical id when the file name is wrong', () => {
  reset()
  writeTicketFile('TICK-6-avatar.md', ticketBody({ id: 'TICK-014' }))

  const ticket = findTicket(TEMP_ROOT, 'TICK-014')

  assert.ok(ticket)
  assert.equal(ticket.data.id, 'TICK-014')
})
