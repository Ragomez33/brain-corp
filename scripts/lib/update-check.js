const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildCommand } = require('./shell')

const PACKAGE_PATH = path.join(__dirname, '..', '..', 'package.json')
const DEFAULT_TIMEOUT_MS = 1800
const DEFAULT_REGISTRY = 'https://registry.npmjs.org'

function readLocalPackageInfo(packagePath = PACKAGE_PATH) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    if (!pkg || !pkg.name || !pkg.version) return null

    return {
      name: String(pkg.name),
      version: String(pkg.version)
    }
  } catch {
    return null
  }
}

function parseVersion(value) {
  const match = String(value || '')
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)

  if (!match) return null

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  }
}

function comparePrereleaseIdentifiers(a, b) {
  if (a === b) return 0
  if (a === undefined) return -1
  if (b === undefined) return 1

  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)

  if (aNumeric && bNumeric) {
    return Number(a) === Number(b) ? 0 : Number(a) > Number(b) ? 1 : -1
  }

  if (aNumeric) return -1
  if (bNumeric) return 1

  return a === b ? 0 : a > b ? 1 : -1
}

/**
 * Semver comparison (major/minor/patch + prerelease). Returns -1, 0 or 1.
 * Invalid versions are treated as equal to avoid false update prompts.
 */
function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)

  if (!a || !b) return 0

  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1
  }

  const aPre = a.prerelease
  const bPre = b.prerelease

  if (aPre.length === 0 && bPre.length === 0) return 0
  if (aPre.length === 0) return 1
  if (bPre.length === 0) return -1

  const length = Math.max(aPre.length, bPre.length)

  for (let index = 0; index < length; index += 1) {
    const result = comparePrereleaseIdentifiers(aPre[index], bPre[index])
    if (result !== 0) return result
  }

  return 0
}

function encodePackageName(packageName) {
  return String(packageName).startsWith('@')
    ? String(packageName).replace('/', '%2F')
    : encodeURIComponent(packageName)
}

function resolveRegistry(registryUrl) {
  const value = String(
    registryUrl || process.env.npm_config_registry || DEFAULT_REGISTRY
  ).trim()

  return (value || DEFAULT_REGISTRY).replace(/\/+$/, '')
}

async function fetchLatestVersion({
  packageName,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  registryUrl = null,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!packageName || typeof fetchImpl !== 'function') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(
      `${resolveRegistry(registryUrl)}/${encodePackageName(packageName)}/latest`,
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'brain-corp-update-check'
        },
        signal: controller.signal
      }
    )

    if (!response || !response.ok) return null

    const data = await response.json()
    return data && typeof data.version === 'string' ? data.version : null
  } catch {
    // Offline, DNS failure, timeout, proxy error... the check is optional.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Checks NPM for a newer version without logging or throwing.
 *
 * @returns {Promise<{
 *   updateAvailable: boolean,
 *   currentVersion: string|null,
 *   latestVersion: string|null,
 *   packageName: string|null,
 *   installCommand: string|null
 * }>}
 */
async function checkForUpdate({
  currentVersion,
  packageName,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  registryUrl = null,
  fetchImpl = globalThis.fetch
} = {}) {
  const empty = {
    updateAvailable: false,
    currentVersion: currentVersion || null,
    latestVersion: null,
    packageName: packageName || null,
    installCommand: packageName
      ? `npm install -g ${packageName}@latest`
      : null
  }

  if (!currentVersion || !packageName) return empty

  try {
    const latestVersion = await fetchLatestVersion({
      packageName,
      timeoutMs,
      registryUrl,
      fetchImpl
    })

    if (!latestVersion) return empty

    return {
      ...empty,
      latestVersion,
      updateAvailable: compareVersions(latestVersion, currentVersion) > 0
    }
  } catch {
    return empty
  }
}

function checkCliForUpdate({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  registryUrl = null,
  fetchImpl = globalThis.fetch,
  packagePath = PACKAGE_PATH
} = {}) {
  const local = readLocalPackageInfo(packagePath)

  if (!local) {
    return Promise.resolve({
      updateAvailable: false,
      currentVersion: null,
      latestVersion: null,
      packageName: null,
      installCommand: null
    })
  }

  return checkForUpdate({
    currentVersion: local.version,
    packageName: local.name,
    timeoutMs,
    registryUrl,
    fetchImpl
  })
}

function installUpdate({
  packageName,
  version = 'latest',
  cwd = process.cwd(),
  stdio = 'inherit'
} = {}) {
  const installCommand = packageName
    ? `npm install -g ${packageName}@${version}`
    : null

  if (!packageName) {
    return {
      ok: false,
      command: installCommand,
      error: 'Package name is required.'
    }
  }

  const result = spawnSync(
    buildCommand('npm', ['install', '-g', `${packageName}@${version}`]),
    {
      cwd,
      stdio,
      shell: true
    }
  )

  if (result.error) {
    return { ok: false, command: installCommand, error: result.error.message }
  }

  return {
    ok: result.status === 0,
    command: installCommand,
    status: result.status,
    error:
      result.status === 0
        ? null
        : `"npm install -g" exited with code ${result.status}.`
  }
}

function isUpdateCheckDisabled(env = process.env) {
  return (
    String(env.BRAIN_SKIP_UPDATE_CHECK || '')
      .trim()
      .toLowerCase() === '1' ||
    String(env.BRAIN_SKIP_UPDATE_CHECK || '')
      .trim()
      .toLowerCase() === 'true' ||
    String(env.NO_UPDATE_NOTIFIER || '').trim() === '1'
  )
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  checkCliForUpdate,
  checkForUpdate,
  compareVersions,
  fetchLatestVersion,
  installUpdate,
  isUpdateCheckDisabled,
  parseVersion,
  readLocalPackageInfo
}
