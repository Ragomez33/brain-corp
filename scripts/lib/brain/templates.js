const fs = require('node:fs')
const path = require('node:path')
const { resolveLanguage } = require('../config')
const { ensureBrainGitignore } = require('./state')

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
const TEMPLATE_LANGUAGES = ['en', 'es']

function normalizeTemplateLanguage(language) {
  const value = String(language || '').toLowerCase()
  return TEMPLATE_LANGUAGES.includes(value) ? value : 'en'
}

function languageDir(language) {
  return path.join(PACKAGE_TEMPLATES_DIR, normalizeTemplateLanguage(language))
}

function templatesDir(repoDir) {
  return path.join(repoDir, REPO_TEMPLATES_DIR)
}

function memoryDir(workspaceDir) {
  return path.join(workspaceDir, WORKSPACE_MEMORY_DIR)
}

function ensureTemplates(repoDir, { overwrite = false, language } = {}) {
  const target = templatesDir(repoDir)
  const sourceDir = languageDir(language || resolveLanguage(repoDir))
  fs.mkdirSync(target, { recursive: true })

  const created = []
  const skipped = []

  for (const file of TEMPLATE_FILES) {
    const source = path.join(sourceDir, file)
    const destination = path.join(target, file)

    if (!fs.existsSync(source)) {
      throw new Error(`Missing packaged template: ${file}`)
    }

    if (fs.existsSync(destination) && !overwrite) {
      skipped.push(destination)
      continue
    }

    fs.copyFileSync(source, destination)
    created.push(destination)
  }

  return { dir: target, created, skipped, language: normalizeTemplateLanguage(language) }
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
      throw new Error(`Missing packaged memory file: ${file}`)
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

function provisionBrainAssets(workspaceDir, { overwrite = false, language } = {}) {
  const resolvedLanguage = language || resolveLanguage(workspaceDir)
  const templates = ensureTemplates(workspaceDir, { overwrite, language: resolvedLanguage })
  const memory = ensureMemory(workspaceDir, { overwrite })
  const gitignore = ensureBrainGitignore(workspaceDir)

  return [
    ...templates.created.map(file => ({ created: true, path: file })),
    ...templates.skipped.map(file => ({ created: false, path: file })),
    ...memory.created.map(file => ({ created: true, path: file })),
    ...memory.skipped.map(file => ({ created: false, path: file })),
    { created: gitignore.created, path: gitignore.path }
  ]
}

function renderTemplate(content, variables) {
  return String(content).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? String(variables[key])
      : match
  })
}

function readPackageTemplate(name, language) {
  const file = path.join(languageDir(language), name)
  if (!fs.existsSync(file)) {
    throw new Error(`Missing packaged template: ${name}`)
  }
  return fs.readFileSync(file, 'utf8')
}

function scaffoldFromTemplate({
  repoDir,
  templateName,
  outputPath,
  variables,
  force = false,
  language
}) {
  if (fs.existsSync(outputPath) && !force) {
    return { created: false, path: outputPath }
  }

  const resolvedLanguage = language || resolveLanguage(repoDir)
  ensureTemplates(repoDir, { language: resolvedLanguage })

  const localTemplate = path.join(templatesDir(repoDir), templateName)
  const raw = fs.existsSync(localTemplate)
    ? fs.readFileSync(localTemplate, 'utf8')
    : readPackageTemplate(templateName, resolvedLanguage)
  const content = renderTemplate(raw, variables)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf8')

  return { created: true, path: outputPath, language: resolvedLanguage }
}

module.exports = {
  MEMORY_FILES,
  PACKAGE_MEMORY_DIR,
  PACKAGE_TEMPLATES_DIR,
  REPO_TEMPLATES_DIR,
  TEMPLATE_FILES,
  TEMPLATE_LANGUAGES,
  WORKSPACE_MEMORY_DIR,
  ensureMemory,
  ensureTemplates,
  languageDir,
  memoryDir,
  normalizeTemplateLanguage,
  provisionBrainAssets,
  readPackageTemplate,
  renderTemplate,
  scaffoldFromTemplate,
  templatesDir
}
