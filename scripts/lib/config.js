const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const LANGUAGES = ['en', 'es']
const DEFAULT_LANGUAGE = 'en'

function normalizeLanguage(value) {
  const lang = String(value || '').trim().toLowerCase()
  return LANGUAGES.includes(lang) ? lang : null
}

function projectConfigPath(rootDir = process.cwd()) {
  return path.join(rootDir, '.brain', 'config.json')
}

function globalConfigPath() {
  return path.join(os.homedir(), '.brain', 'config.json')
}

function readJson(file) {
  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function readProjectConfig(rootDir = process.cwd()) {
  return readJson(projectConfigPath(rootDir)) || {}
}

function writeProjectConfig(rootDir, patch) {
  const file = projectConfigPath(rootDir)
  const current = readProjectConfig(rootDir)
  const next = { ...current, ...patch }

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return file
}

function resolveLanguage(rootDir = process.cwd()) {
  const fromEnv = normalizeLanguage(process.env.BRAIN_LANG)
  if (fromEnv) return fromEnv

  const project = normalizeLanguage(readProjectConfig(rootDir).language)
  if (project) return project

  const globalConfig = readJson(globalConfigPath()) || {}
  const globalLanguage = normalizeLanguage(globalConfig.language)
  if (globalLanguage) return globalLanguage

  return DEFAULT_LANGUAGE
}

function setLanguage(rootDir, language) {
  const normalized = normalizeLanguage(language)
  if (!normalized) {
    throw new Error(`Invalid language: ${language}. Use en or es.`)
  }

  writeProjectConfig(rootDir, { language: normalized })
  return normalized
}

module.exports = {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  globalConfigPath,
  normalizeLanguage,
  projectConfigPath,
  readJson,
  readProjectConfig,
  resolveLanguage,
  setLanguage,
  writeProjectConfig
}
