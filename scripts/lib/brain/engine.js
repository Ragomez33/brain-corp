const fs = require('node:fs')
const path = require('node:path')
const { resolveContext } = require('./context')
const { readActive, writeActive, updateActive, ensureBrainGitignore } = require('./state')
const { ensureTemplates, scaffoldFromTemplate } = require('./templates')
const { resolveLanguage } = require('../config')

const FEATURE_FILES = {
  spec: 'spec.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
  contract: 'contract.md',
  analysis: 'analysis.md'
}

function featurePath(ctx, key) {
  return path.join(ctx.featureDir, FEATURE_FILES[key])
}

function ensureFeatureDir(ctx) {
  if (!fs.existsSync(ctx.featureDir)) {
    throw new Error(
      `La feature ${ctx.ticketId} no existe en ${path.relative(
        ctx.rootDir,
        ctx.featureDir
      )}. Ejecuta primero "brain init-work ${ctx.ticketId}".`
    )
  }
}

function ensureFile(ctx, key) {
  const file = featurePath(ctx, key)
  if (!fs.existsSync(file)) {
    throw new Error(
      `Falta ${FEATURE_FILES[key]} en .brain/features/${ctx.ticketId}/. Ejecuta la fase anterior.`
    )
  }
  return file
}

function relativeFeatureDir(ctx) {
  return path.relative(ctx.repoDir, ctx.featureDir).split(path.sep).join('/')
}

function initWork({ ticketId, repoId, force = false }) {
  const ctx = resolveContext({ ticketId, repoId })
  const language = resolveLanguage(ctx.rootDir)

  fs.mkdirSync(ctx.featureDir, { recursive: true })
  const templates = ensureTemplates(ctx.repoDir, { language })
  const gitignore = ensureBrainGitignore(ctx.repoDir)

  let contract = null
  if (ctx.contractRequired) {
    contract = scaffoldFromTemplate({
      repoDir: ctx.repoDir,
      templateName: 'contract-template.md',
      outputPath: featurePath(ctx, 'contract'),
      variables: ctx.variables,
      force,
      language
    })
  }

  writeActive(ctx.repoDir, {
    ticketId: ctx.ticketId,
    repoId: ctx.repository.id,
    targetDomain: ctx.targetDomain,
    phase: 'init',
    featureDir: relativeFeatureDir(ctx),
    contract: ctx.contractRequired,
    language,
    mode: null
  })

  return { ctx, templates, contract, language, gitignore }
}

function specify({ ticketId, repoId, force = false }) {
  const ctx = resolveContext({ ticketId, repoId })
  const language = resolveLanguage(ctx.rootDir)
  ensureFeatureDir(ctx)

  const result = scaffoldFromTemplate({
    repoDir: ctx.repoDir,
    templateName: 'spec-template.md',
    outputPath: featurePath(ctx, 'spec'),
    variables: ctx.variables,
    force,
    language
  })

  updateActive(ctx.repoDir, { phase: 'specify', language })

  return { ctx, result, language }
}

function plan({ ticketId, repoId, force = false }) {
  const ctx = resolveContext({ ticketId, repoId })
  const language = resolveLanguage(ctx.rootDir)
  ensureFeatureDir(ctx)
  ensureFile(ctx, 'spec')

  const result = scaffoldFromTemplate({
    repoDir: ctx.repoDir,
    templateName: 'plan-template.md',
    outputPath: featurePath(ctx, 'plan'),
    variables: ctx.variables,
    force,
    language
  })

  updateActive(ctx.repoDir, { phase: 'plan', language })

  return { ctx, result, language }
}

function tasks({ ticketId, repoId, force = false }) {
  const ctx = resolveContext({ ticketId, repoId })
  const language = resolveLanguage(ctx.rootDir)
  ensureFeatureDir(ctx)
  ensureFile(ctx, 'plan')

  const result = scaffoldFromTemplate({
    repoDir: ctx.repoDir,
    templateName: 'tasks-template.md',
    outputPath: featurePath(ctx, 'tasks'),
    variables: ctx.variables,
    force,
    language
  })

  updateActive(ctx.repoDir, { phase: 'tasks', language })

  return { ctx, result, language }
}

function parseTasks(content) {
  const tasks = []
  const lines = String(content).split(/\r?\n/)

  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)- \[( |x|X)\] (T\d+)(.*)$/)
    if (!match) return

    tasks.push({
      id: match[3],
      done: match[2].toLowerCase() === 'x',
      parallel: /\[P\]/.test(match[4]),
      description: match[4].replace(/\[P\]/, '').trim(),
      line: index + 1,
      raw: line
    })
  })

  return tasks
}

function implement({ ticketId, repoId, mode = 'checkpoint', taskId = null }) {
  const ctx = resolveContext({ ticketId, repoId })
  ensureFeatureDir(ctx)
  const file = ensureFile(ctx, 'tasks')

  let content = fs.readFileSync(file, 'utf8')
  let tasksList = parseTasks(content)
  const previous = readActive(ctx.repoDir) || {}

  if (mode === 'batch') {
    updateActive(ctx.repoDir, { phase: 'implement', mode: 'batch' })
    return {
      ctx,
      mode,
      pending: tasksList.filter(item => !item.done),
      completed: tasksList.filter(item => item.done)
    }
  }

  if (taskId) {
    const normalized = String(taskId).trim().toUpperCase()
    const target = tasksList.find(item => item.id === normalized)

    if (!target) {
      throw new Error(`No existe la tarea ${normalized} en tasks.md.`)
    }

    content = content
      .split(/\r?\n/)
      .map((line, index) => {
        if (index + 1 !== target.line) return line
        return line.replace(/- \[ \]/, '- [x]')
      })
      .join('\n')

    fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
    tasksList = parseTasks(content)

    updateActive(ctx.repoDir, { phase: 'implement', mode: 'checkpoint' })

    const next = tasksList.find(item => !item.done) || null
    return { ctx, mode, completedTask: normalized, next, remaining: tasksList.filter(item => !item.done).length }
  }

  const next = tasksList.find(item => !item.done) || null
  if (!next) {
    updateActive(ctx.repoDir, { phase: 'implement', mode: 'checkpoint' })
  }

  return {
    ctx,
    mode,
    next,
    remaining: tasksList.filter(item => !item.done).length,
    previousMode: previous.mode || null
  }
}

function extractMatches(text, regex) {
  const matches = []
  const matcher = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`)
  let result = matcher.exec(text)

  while (result) {
    matches.push(result[1] !== undefined ? result[1] : result[0])
    result = matcher.exec(text)
  }

  return [...new Set(matches)]
}

function analyze({ ticketId, repoId, write = true }) {
  const ctx = resolveContext({ ticketId, repoId })
  ensureFeatureDir(ctx)

  const errors = []
  const warnings = []

  const specFile = featurePath(ctx, 'spec')
  const planFile = featurePath(ctx, 'plan')
  const tasksFile = featurePath(ctx, 'tasks')
  const contractFile = featurePath(ctx, 'contract')

  if (!fs.existsSync(specFile)) errors.push('Falta spec.md (ejecuta "brain specify").')
  if (!fs.existsSync(planFile)) warnings.push('Falta plan.md (ejecuta "brain plan").')
  if (!fs.existsSync(tasksFile)) warnings.push('Falta tasks.md (ejecuta "brain tasks").')
  if (ctx.contractRequired && !fs.existsSync(contractFile)) {
    warnings.push('La feature cruza sidecars pero falta contract.md (ejecuta "brain init-work" con --force).')
  }

  const spec = fs.existsSync(specFile) ? fs.readFileSync(specFile, 'utf8') : ''
  const tasksContent = fs.existsSync(tasksFile) ? fs.readFileSync(tasksFile, 'utf8') : ''

  const requirements = extractMatches(spec, /(REQ-[A-Z]-\d{3})/g)
  const taskItems = parseTasks(tasksContent)
  const taskText = taskItems.map(item => item.description).join('\n')
  const covered = new Set(extractMatches(taskText, /(REQ-[A-Z]-\d{3})/g))

  for (const requirement of requirements) {
    if (!covered.has(requirement)) {
      warnings.push(`El requisito ${requirement} no está referenciado en tasks.md.`)
    }
  }

  if (taskItems.length === 0) {
    warnings.push('tasks.md no contiene tareas en el formato "- [ ] TXXX ...".')
  }

  const pending = taskItems.filter(item => !item.done)
  if (pending.length > 0) {
    warnings.push(`Quedan ${pending.length} tarea(s) sin completar.`)
  }

  const pathMatches = extractMatches(taskText, /`([^`]+\.(?:js|jsx|ts|tsx|prisma|sql|graphql|gql|json|md|py|go|rs))`/g)
  for (const candidate of pathMatches) {
    if (candidate.startsWith('.brain/') || candidate.startsWith('.agents/') || candidate.startsWith('config/')) {
      continue
    }
    if (candidate.includes('*') || candidate.includes('<') || candidate.includes('[')) continue

    const absolute = path.resolve(ctx.repoDir, candidate)
    if (!fs.existsSync(absolute)) {
      warnings.push(`La ruta referida en tasks.md no existe en el repositorio: ${candidate}`)
    }
  }

  const report = {
    ticketId: ctx.ticketId,
    repoId: ctx.repository.id,
    featureDir: relativeFeatureDir(ctx),
    generatedAt: new Date().toISOString(),
    status: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'attention' : 'ok',
    errors,
    warnings,
    requirements: requirements.length,
    coveredRequirements: covered.size,
    tasks: {
      total: taskItems.length,
      done: taskItems.filter(item => item.done).length,
      pending: pending.length
    }
  }

  if (write) {
    const lines = [
      `# Análisis SDD: ${ctx.ticketId}`,
      '',
      `- **Generado**: ${report.generatedAt}`,
      `- **Repositorio**: ${report.repoId}`,
      `- **Estado**: ${report.status}`,
      '',
      '## Errores',
      '',
      errors.length > 0 ? errors.map(item => `- ${item}`).join('\n') : '- Ninguno.',
      '',
      '## Advertencias',
      '',
      warnings.length > 0 ? warnings.map(item => `- ${item}`).join('\n') : '- Ninguna.',
      '',
      '## Cobertura de requisitos',
      '',
      `- Requisitos en spec.md: ${report.requirements}`,
      `- Referenciados en tasks.md: ${report.coveredRequirements}`,
      '',
      '## Tareas',
      '',
      `- Totales: ${report.tasks.total}`,
      `- Completadas: ${report.tasks.done}`,
      `- Pendientes: ${report.tasks.pending}`,
      ''
    ]

    fs.writeFileSync(featurePath(ctx, 'analysis'), lines.join('\n'), 'utf8')
  }

  return { ctx, report }
}

module.exports = {
  FEATURE_FILES,
  analyze,
  featurePath,
  implement,
  initWork,
  parseTasks,
  plan,
  relativeFeatureDir,
  specify,
  tasks
}
