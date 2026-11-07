const fs = require('node:fs')
const path = require('node:path')
const { provisionBrainAssets } = require('./brain/templates')

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..')

const TICKET_STATES = ['backlog', 'in-analysis', 'ready', 'done']

const AGENTS_MD = `# brain-corp

Este workspace está orquestado por brain-corp.

## Recursos

- Rol del analista: \`.agents/prompts/analyst.md\`
- Skills base: \`.agents/skills/\`
- Tickets: \`.agents/tickets/<estado>/TICK-XXX-<slug>.md\`
- SDD nativo: \`.brain/active.json\` y \`.brain/features/<ticket>/\`
- Constitución central: \`.brain/memory/constitution.md\`
- Topología de sidecars: \`config/system-map.json\`

## Comandos principales

- \`/cross-analyze <tema>\`: analiza el ecosistema y crea un ticket.
- \`/init-work <TICK-XXX>\`: crea la feature en \`.brain/features/<ticket>/\`.
- \`/specify\`, \`/plan\`, \`/tasks\`, \`/implement\`: flujo SDD nativo.
- \`/analyze\`: audita coherencia y detecta spec drift.
- \`/sanity\`: valida coherencia de tickets.
- \`/sync\`: publica el backlog como issues de GitHub.

## Reglas

1. Trabaja siempre desde la raíz del workspace; resuelve rutas de sidecars desde \`config/system-map.json\`.
2. No modifiques código de producto desde la raíz.
3. Todo cambio debe estar asociado a un ticket \`TICK-XXX\`.
4. Usa \`gh\` como única interfaz con GitHub; no persistas tokens.
`

const CURSOR_RULE = `---
description: brain-corp orchestration rules
alwaysApply: true
---

# brain-corp

Trabaja desde la raíz del workspace y usa \`config/system-map.json\` como fuente de verdad de los sidecars.

- Rol del analista: \`.agents/prompts/analyst.md\`
- Tickets: \`.agents/tickets/<estado>/TICK-XXX-<slug>.md\`
- SDD nativo: \`.brain/features/<ticket>/\`
- Constitución central: \`.brain/memory/constitution.md\`
- Comandos: \`/cross-analyze\`, \`/init-work\`, \`/specify\`, \`/plan\`, \`/tasks\`, \`/implement\`, \`/analyze\`, \`/sanity\`, \`/sync\`

No implementes código de producto desde la raíz. Todo cambio requiere ticket y trazabilidad.
`

const ANTIGRAVITY_RULE = `# brain-corp

Workspace orquestado por brain-corp.

- Analista: \`.agents/prompts/analyst.md\`
- Topología: \`config/system-map.json\`
- Tickets: \`.agents/tickets/\`
- SDD nativo: \`.brain/features/\`
- Constitución central: \`.brain/memory/constitution.md\`

Usa \`/cross-analyze\`, \`/init-work\`, \`/specify\`, \`/plan\`, \`/tasks\`, \`/implement\`, \`/analyze\`, \`/sanity\` y \`/sync\`.
`

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true })
}

function copyFile(source, target, { overwrite = false } = {}) {
  if (fs.existsSync(target) && !overwrite) {
    return { created: false, path: target }
  }

  ensureDirectory(path.dirname(target))
  fs.copyFileSync(source, target)

  try {
    fs.chmodSync(target, fs.statSync(source).mode)
  } catch {
    // En Windows los permisos POSIX no aplican.
  }

  return { created: true, path: target }
}

function copyDirectory(source, target, { overwrite = false } = {}) {
  if (!fs.existsSync(source)) return []

  const results = []
  ensureDirectory(target)

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const targetPath = path.join(target, entry.name)

    if (entry.isDirectory()) {
      results.push(...copyDirectory(sourcePath, targetPath, { overwrite }))
    } else if (entry.isFile()) {
      results.push(copyFile(sourcePath, targetPath, { overwrite }))
    }
  }

  return results
}

function writeFileIfMissing(target, content) {
  if (fs.existsSync(target)) return { created: false, path: target }

  ensureDirectory(path.dirname(target))
  fs.writeFileSync(target, content, 'utf8')
  return { created: true, path: target }
}

function ensureTicketStructure(workspaceDir) {
  const results = []

  for (const state of TICKET_STATES) {
    const directory = path.join(workspaceDir, '.agents', 'tickets', state)
    ensureDirectory(directory)
    results.push({ created: false, path: directory })
  }

  return results
}

function provisionCoreAssets({ workspaceDir = process.cwd(), overwrite = false } = {}) {
  const results = []

  results.push(
    ...copyDirectory(
      path.join(PACKAGE_ROOT, '.agents', 'prompts'),
      path.join(workspaceDir, '.agents', 'prompts'),
      { overwrite }
    )
  )

  results.push(
    ...copyDirectory(
      path.join(PACKAGE_ROOT, '.agents', 'skills'),
      path.join(workspaceDir, '.agents', 'skills'),
      { overwrite }
    )
  )

  results.push(...provisionBrainAssets(workspaceDir, { overwrite }))

  results.push(...ensureTicketStructure(workspaceDir))
  results.push(
    writeFileIfMissing(path.join(workspaceDir, 'AGENTS.md'), AGENTS_MD)
  )

  return results
}

function provisionOpencodeCommands(workspaceDir, overwrite) {
  return copyDirectory(
    path.join(PACKAGE_ROOT, '.opencode', 'commands'),
    path.join(workspaceDir, '.opencode', 'commands'),
    { overwrite }
  )
}

function provisionClaude(workspaceDir, overwrite) {
  const results = copyDirectory(
    path.join(PACKAGE_ROOT, '.opencode', 'commands'),
    path.join(workspaceDir, '.claude', 'commands'),
    { overwrite }
  )

  results.push(
    writeFileIfMissing(
      path.join(workspaceDir, 'CLAUDE.md'),
      `# brain-corp\n\nEste workspace está orquestado por brain-corp.\n\nLee \`.brain/memory/constitution.md\` (constitución central), \`.agents/prompts/analyst.md\`, usa \`config/system-map.json\` como topología y trabaja desde la raíz.\n\nComandos: \`/cross-analyze\`, \`/init-work\`, \`/specify\`, \`/plan\`, \`/tasks\`, \`/implement\`, \`/analyze\`, \`/sanity\` y \`/sync\`.\n`
    )
  )

  return results
}

function provisionCursor(workspaceDir, overwrite) {
  const results = [
    writeFileIfMissing(path.join(workspaceDir, 'AGENTS.md'), AGENTS_MD)
  ]

  if (overwrite || !fs.existsSync(path.join(workspaceDir, '.cursor', 'rules'))) {
    ensureDirectory(path.join(workspaceDir, '.cursor', 'rules'))
  }

  results.push(
    writeFileIfMissing(
      path.join(workspaceDir, '.cursor', 'rules', 'brain-corp.mdc'),
      CURSOR_RULE
    )
  )

  return results
}

function provisionAntigravity(workspaceDir, overwrite) {
  const results = [
    writeFileIfMissing(path.join(workspaceDir, 'AGENTS.md'), AGENTS_MD)
  ]

  if (
    overwrite ||
    !fs.existsSync(path.join(workspaceDir, '.antigravity', 'rules'))
  ) {
    ensureDirectory(path.join(workspaceDir, '.antigravity', 'rules'))
  }

  results.push(
    writeFileIfMissing(
      path.join(workspaceDir, '.antigravity', 'rules', 'brain-corp.md'),
      ANTIGRAVITY_RULE
    )
  )

  return results
}

function provisionAgentAssets({
  agent = 'opencode',
  workspaceDir = process.cwd(),
  overwrite = false
} = {}) {
  const normalizedAgent = String(agent || 'opencode').toLowerCase()
  const results = provisionCoreAssets({ workspaceDir, overwrite })

  if (normalizedAgent.includes('opencode')) {
    results.push(...provisionOpencodeCommands(workspaceDir, overwrite))
  } else if (normalizedAgent.includes('claude')) {
    results.push(...provisionClaude(workspaceDir, overwrite))
  } else if (normalizedAgent.includes('cursor')) {
    results.push(...provisionCursor(workspaceDir, overwrite))
  } else if (normalizedAgent.includes('antigravity')) {
    results.push(...provisionAntigravity(workspaceDir, overwrite))
  }

  const created = results.filter(result => result.created)
  const skipped = results.filter(result => !result.created)

  return {
    agent: normalizedAgent,
    workspaceDir,
    created,
    skipped,
    total: results.length
  }
}

module.exports = {
  PACKAGE_ROOT,
  provisionAgentAssets,
  provisionCoreAssets
}
