const fs = require('node:fs')
const path = require('node:path')
const { provisionBrainAssets } = require('./brain/templates')
const { resolveLanguage } = require('./config')

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..')
const AGENTS_ASSETS_DIR = path.join(PACKAGE_ROOT, 'templates', 'agents')

const TICKET_STATES = ['backlog', 'in-analysis', 'ready', 'done']
const ASSET_LANGUAGES = ['en', 'es']

function normalizeAssetLanguage(language) {
  const value = String(language || '').toLowerCase()
  return ASSET_LANGUAGES.includes(value) ? value : 'en'
}

function assetsDir(language) {
  return path.join(AGENTS_ASSETS_DIR, normalizeAssetLanguage(language))
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true })
}

function copyFile(source, target, { overwrite = false } = {}) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing packaged asset: ${source}`)
  }

  if (fs.existsSync(target) && !overwrite) {
    return { created: false, path: target }
  }

  ensureDirectory(path.dirname(target))
  fs.copyFileSync(source, target)

  try {
    fs.chmodSync(target, fs.statSync(source).mode)
  } catch {
    // POSIX permissions do not apply on Windows.
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

function ensureTicketStructure(workspaceDir) {
  const results = []

  for (const state of TICKET_STATES) {
    const directory = path.join(workspaceDir, '.agents', 'tickets', state)
    ensureDirectory(directory)
    results.push({ created: false, path: directory })
  }

  return results
}

function provisionCoreAssets({ workspaceDir = process.cwd(), overwrite = false, language } = {}) {
  const resolvedLanguage = normalizeAssetLanguage(language || resolveLanguage(workspaceDir))
  const source = assetsDir(resolvedLanguage)
  const results = []

  results.push(
    ...copyDirectory(path.join(source, 'prompts'), path.join(workspaceDir, '.agents', 'prompts'), {
      overwrite
    })
  )

  results.push(
    ...copyDirectory(path.join(source, 'skills'), path.join(workspaceDir, '.agents', 'skills'), {
      overwrite
    })
  )

  results.push(
    copyFile(path.join(source, 'AGENTS.md'), path.join(workspaceDir, 'AGENTS.md'), { overwrite })
  )

  results.push(...provisionBrainAssets(workspaceDir, { overwrite }))
  results.push(...ensureTicketStructure(workspaceDir))

  return results
}

function provisionOpencodeCommands(workspaceDir, overwrite, language) {
  return copyDirectory(
    path.join(assetsDir(language), 'commands'),
    path.join(workspaceDir, '.opencode', 'commands'),
    { overwrite }
  )
}

function provisionClaude(workspaceDir, overwrite, language) {
  const source = assetsDir(language)
  const results = copyDirectory(
    path.join(source, 'commands'),
    path.join(workspaceDir, '.claude', 'commands'),
    { overwrite }
  )

  results.push(copyFile(path.join(source, 'CLAUDE.md'), path.join(workspaceDir, 'CLAUDE.md'), { overwrite }))

  return results
}

function provisionCursor(workspaceDir, overwrite, language) {
  const source = assetsDir(language)
  const results = [
    copyFile(path.join(source, 'AGENTS.md'), path.join(workspaceDir, 'AGENTS.md'), { overwrite })
  ]

  results.push(
    copyFile(
      path.join(source, 'rules', 'cursor.mdc'),
      path.join(workspaceDir, '.cursor', 'rules', 'brain-corp.mdc'),
      { overwrite }
    )
  )

  return results
}

function provisionAntigravity(workspaceDir, overwrite, language) {
  const source = assetsDir(language)
  const results = [
    copyFile(path.join(source, 'AGENTS.md'), path.join(workspaceDir, 'AGENTS.md'), { overwrite })
  ]

  results.push(
    copyFile(
      path.join(source, 'rules', 'antigravity.md'),
      path.join(workspaceDir, '.antigravity', 'rules', 'brain-corp.md'),
      { overwrite }
    )
  )

  return results
}

function provisionAgentAssets({
  agent = 'opencode',
  workspaceDir = process.cwd(),
  overwrite = false,
  language
} = {}) {
  const normalizedAgent = String(agent || 'opencode').toLowerCase()
  const resolvedLanguage = normalizeAssetLanguage(language || resolveLanguage(workspaceDir))
  const results = provisionCoreAssets({ workspaceDir, overwrite, language: resolvedLanguage })

  if (normalizedAgent.includes('opencode')) {
    results.push(...provisionOpencodeCommands(workspaceDir, overwrite, resolvedLanguage))
  } else if (normalizedAgent.includes('claude')) {
    results.push(...provisionClaude(workspaceDir, overwrite, resolvedLanguage))
  } else if (normalizedAgent.includes('cursor')) {
    results.push(...provisionCursor(workspaceDir, overwrite, resolvedLanguage))
  } else if (normalizedAgent.includes('antigravity')) {
    results.push(...provisionAntigravity(workspaceDir, overwrite, resolvedLanguage))
  }

  const created = results.filter(result => result.created)
  const skipped = results.filter(result => !result.created)

  return {
    agent: normalizedAgent,
    workspaceDir,
    language: resolvedLanguage,
    created,
    skipped,
    total: results.length
  }
}

module.exports = {
  AGENTS_ASSETS_DIR,
  PACKAGE_ROOT,
  assetsDir,
  provisionAgentAssets,
  provisionCoreAssets
}
