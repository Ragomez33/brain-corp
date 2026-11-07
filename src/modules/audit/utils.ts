import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { RepositoryEntry, SystemMap } from './types'

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.expo',
  '.turbo',
  '.cache',
  '.brain',
  'vendor'
])

export function resolveRoot(optionsRoot?: string): string {
  return path.resolve(optionsRoot || process.env.BRAIN_AUDIT_ROOT || process.cwd())
}

export function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

export function loadSystemMap(root: string): SystemMap {
  return readJson<SystemMap>(path.join(root, 'config', 'system-map.json')) || {}
}

export function repositories(root: string, map: SystemMap, repoId?: string): RepositoryEntry[] {
  const entries = Array.isArray(map.repositories) ? map.repositories : []

  if (repoId) {
    return entries.filter(repository => repository.id === repoId)
  }

  if (entries.length === 0) {
    return [{ id: 'workspace', path: '.' }]
  }

  return entries
}

export function repoAbsolutePath(root: string, repository: RepositoryEntry): string {
  return path.resolve(root, repository.path || '.')
}

export function walkFiles(
  directory: string,
  extensions: string[],
  { maxFiles = 20000 }: { maxFiles?: number } = {}
): string[] {
  const results: string[] = []
  const stack = [directory]
  const allowed = new Set(extensions.map(extension => extension.toLowerCase()))

  while (stack.length > 0 && results.length < maxFiles) {
    const current = stack.pop() as string
    let entries: fs.Dirent[]

    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') {
        if (entry.isDirectory()) continue
      }

      const absolute = path.join(current, entry.name)

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(absolute)
        continue
      }

      if (!entry.isFile()) continue
      if (allowed.size > 0 && !allowed.has(path.extname(entry.name).toLowerCase())) continue

      results.push(absolute)
    }
  }

  return results
}

export function readText(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

export function runGit(args: string[], cwd: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return null
  }
}

export function toRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

export function lastCommitDate(repoDir: string, file: string): string | null {
  const value = runGit(['log', '-1', '--format=%cs', '--', file], repoDir)
  return value || null
}

export function daysSince(date: string | null): number | null {
  if (!date) return null
  const parsed = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000))
}

export function hasRelationship(map: SystemMap, repoId: string): boolean {
  const relationships = Array.isArray(map.relationships) ? map.relationships : []
  return relationships.some(relationship => relationship.from === repoId || relationship.to === repoId)
}

export function contractFilesFor(repoDir: string): string[] {
  const featuresDir = path.join(repoDir, '.brain', 'features')
  if (!fs.existsSync(featuresDir)) return []

  const results: string[] = []

  for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const contract = path.join(featuresDir, entry.name, 'contract.md')
    if (fs.existsSync(contract)) results.push(contract)
  }

  return results
}
