const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test, after } = require('node:test')
const assert = require('node:assert/strict')

const ORIGINAL_CWD = process.cwd()
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-corp-analyze-test-'))

process.env.BRAIN_LANG = 'en'
process.chdir(TEMP_ROOT)

const tickets = require('../scripts/lib/tickets')
const { analyze } = require('../scripts/lib/brain/engine')

const TICKET_ID = 'TICK-028'
const REPO_ID = 'base-repo'

function writeFile(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

function setupWorkspace(tasksContent) {
  fs.rmSync(path.join(TEMP_ROOT, 'config'), { recursive: true, force: true })
  fs.rmSync(path.join(TEMP_ROOT, '.agents'), { recursive: true, force: true })
  fs.rmSync(path.join(TEMP_ROOT, REPO_ID), { recursive: true, force: true })
  fs.rmSync(path.join(TEMP_ROOT, 'sidecars'), { recursive: true, force: true })

  writeFile(
    path.join(TEMP_ROOT, 'config', 'system-map.json'),
    `${JSON.stringify(
      {
        version: '1.0.0',
        repositories: [{ id: REPO_ID, name: REPO_ID, path: REPO_ID }],
        relationships: []
      },
      null,
      2
    )}\n`
  )

  tickets.ensureTicketDirs(TEMP_ROOT)
  const frontmatter = tickets.buildFrontmatter({
    id: TICKET_ID,
    title: 'Workspace-relative tasks',
    author: 'Brain-Corp Analyst',
    target_domain: 'shared',
    status: 'backlog',
    created_at: '2026-11-12',
    dependencies: []
  })
  writeFile(
    path.join(TEMP_ROOT, '.agents', 'tickets', 'backlog', `${TICKET_ID}-workspace-relative-tasks.md`),
    `${frontmatter}\n\n## Context / Finding\n\nText.\n`
  )

  const featureDir = path.join(TEMP_ROOT, REPO_ID, '.brain', 'features', TICKET_ID)
  writeFile(path.join(featureDir, 'spec.md'), '# Spec\n\n- REQ-A-001: Works.\n')
  writeFile(path.join(featureDir, 'plan.md'), '# Plan\n')
  writeFile(path.join(featureDir, 'contract.md'), '# Contract\n')
  writeFile(path.join(featureDir, 'tasks.md'), tasksContent)
}

function analyzeTicket() {
  return analyze({ ticketId: TICKET_ID, repoId: REPO_ID, write: false }).report
}

function pathWarnings(report) {
  return report.warnings.filter(warning => warning.startsWith('Path referenced in tasks.md'))
}

after(() => {
  process.chdir(ORIGINAL_CWD)
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
})

test('analyze accepts workspace-relative and repo-relative task paths', () => {
  setupWorkspace(`# Tasks

- [x] T001 Update \`sidecars/forge-backend/src/app.js\` for REQ-A-001.
- [x] T002 Update \`src/local.js\` for REQ-A-001.
`)

  writeFile(path.join(TEMP_ROOT, 'sidecars', 'forge-backend', 'src', 'app.js'))
  writeFile(path.join(TEMP_ROOT, REPO_ID, 'src', 'local.js'))

  const report = analyzeTicket()

  assert.deepEqual(pathWarnings(report), [])
  assert.equal(report.status, 'ok')
})

test('analyze still warns about paths missing from both roots', () => {
  setupWorkspace(`# Tasks

- [x] T001 Update \`sidecars/forge-backend/src/missing.js\` for REQ-A-001.
`)

  const report = analyzeTicket()

  assert.deepEqual(pathWarnings(report), [
    'Path referenced in tasks.md does not exist in the repository: sidecars/forge-backend/src/missing.js'
  ])
})
