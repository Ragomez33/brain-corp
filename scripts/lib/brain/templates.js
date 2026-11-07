const fs = require('node:fs')
const path = require('node:path')

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..', '..')
const PACKAGE_TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates', 'brain')
const PACKAGE_MEMORY_DIR = path.join(PACKAGE_TEMPLATES_DIR, 'memory')
const REPO_TEMPLATES_DIR = path.join('.brain', 'templates')
const WORKSPACE_MEMORY_DIR = path.join('.brain', 'memory')

const TEMPLATE_FILES = [
  'spec-template.md',
  'plan-template.md',
  'tasks-template.md',
  'contract-template.md'
]

const MEMORY_FILES = ['constitution.md', 'constitution-template.json']

function templatesDir(repoDir) {
  return path.join(repoDir, REPO_TEMPLATES_DIR)
}

function memoryDir(workspaceDir) {
  return path.join(workspaceDir, WORKSPACE_MEMORY_DIR)
}

function ensureTemplates(repoDir, { overwrite = false } = {}) {
  const target = templatesDir(repoDir)
  fs.mkdirSync(target, { recursive: true })

  const created = []
  const skipped = []

  for (const file of TEMPLATE_FILES) {
    const source = path.join(PACKAGE_TEMPLATES_DIR, file)
    const destination = path.join(target, file)

    if (!fs.existsSync(source)) {
      throw new Error(`Falta la plantilla empaquetada: ${file}`)
    }

    if (fs.existsSync(destination) && !overwrite) {
      skipped.push(destination)
      continue
    }

    fs.copyFileSync(source, destination)
    created.push(destination)
  }

  return { dir: target, created, skipped }
}

function ensureMemory(workspaceDir, { overwrite = false } = {}) {
  const target = memoryDir(workspaceDir)
  fs.mkdirSync(target, { recursive: true })

  const created = []
  const skipped = []

  for (const file of MEMORY_FILES) {
    const source = path.join(PACKAGE_MEMORY_DIR, file)
    const destination = path.join(target, file)

    if (!fs.existsSync(source)) {
      throw new Error(`Falta el archivo de memoria empaquetado: ${file}`)
    }

    if (fs.existsSync(destination) && !overwrite) {
      skipped.push(destination)
      continue
    }

    fs.copyFileSync(source, destination)
    created.push(destination)
  }

  return { dir: target, created, skipped }
}

function provisionBrainAssets(workspaceDir, { overwrite = false } = {}) {
  const templates = ensureTemplates(workspaceDir, { overwrite })
  const memory = ensureMemory(workspaceDir, { overwrite })

  return [
    ...templates.created.map(file => ({ created: true, path: file })),
    ...templates.skipped.map(file => ({ created: false, path: file })),
    ...memory.created.map(file => ({ created: true, path: file })),
    ...memory.skipped.map(file => ({ created: false, path: file }))
  ]
}

function renderTemplate(content, variables) {
  return String(content).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? String(variables[key])
      : match
  })
}

function readPackageTemplate(name) {
  const file = path.join(PACKAGE_TEMPLATES_DIR, name)
  if (!fs.existsSync(file)) {
    throw new Error(`Falta la plantilla empaquetada: ${name}`)
  }
  return fs.readFileSync(file, 'utf8')
}

function scaffoldFromTemplate({ repoDir, templateName, outputPath, variables, force = false }) {
  if (fs.existsSync(outputPath) && !force) {
    return { created: false, path: outputPath }
  }

  ensureTemplates(repoDir)

  const localTemplate = path.join(templatesDir(repoDir), templateName)
  const raw = fs.existsSync(localTemplate)
    ? fs.readFileSync(localTemplate, 'utf8')
    : readPackageTemplate(templateName)
  const content = renderTemplate(raw, variables)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf8')

  return { created: true, path: outputPath }
}

module.exports = {
  MEMORY_FILES,
  PACKAGE_MEMORY_DIR,
  PACKAGE_TEMPLATES_DIR,
  REPO_TEMPLATES_DIR,
  TEMPLATE_FILES,
  WORKSPACE_MEMORY_DIR,
  ensureMemory,
  ensureTemplates,
  memoryDir,
  provisionBrainAssets,
  readPackageTemplate,
  renderTemplate,
  scaffoldFromTemplate,
  templatesDir
}
