import path from 'node:path'
import type { AuditFinding, AuditOptions, AuditReport, RepositoryEntry } from './types'
import {
  contractFilesFor,
  hasRelationship,
  loadSystemMap,
  repoAbsolutePath,
  resolveRoot,
  runGit,
  toRelative
} from './utils'

const CONTRACT_FILE = /\.(prisma|graphql|gql|sql)$/i
const CONTRACT_NAME = /(^|[/\\])(schema|openapi|swagger|contract|api)(\.[^/\\]+)?$/i
const MIGRATION_DIR = /(^|[/\\])(migrations|migrations?[/\\]|prisma[/\\]migrations)/i

const BREAKING_LINE = [
  /^-\s*(model|type|interface|input|enum|union|scalar)\s+[A-Za-z_]/i,
  /^-\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*[A-Za-z_\[\]!]+/,
  /^-\s*(query|mutation|subscription)\s+[A-Za-z_]/i,
  /^-\s*(export\s+)?(function|class|const|let|var)\s+[A-Za-z_]/,
  /^-\s*["']?\/[A-Za-z0-9_./{}-]*["']?\s*:/,
  /^-\s*[A-Za-z_][A-Za-z0-9_]*\s+(String|Int|Float|Boolean|DateTime|Json|Bytes|BigInt|Decimal|[A-Z][A-Za-z0-9_]*)(\[\])?(\?)?(\s+@.*)?$/
]

function isContractFile(file: string): boolean {
  return CONTRACT_FILE.test(file) || CONTRACT_NAME.test(file) || MIGRATION_DIR.test(file)
}

function isBreakingLine(line: string): boolean {
  if (line.startsWith('---') || line.startsWith('+++')) return false
  return BREAKING_LINE.some(pattern => pattern.test(line))
}

function analyzeRepository(
  root: string,
  repository: RepositoryEntry,
  crossSidecar: boolean
): { findings: AuditFinding[]; filesInspected: number } {
  const repoDir = repoAbsolutePath(root, repository)
  const diff = runGit(
    ['diff', 'HEAD', '--no-color', '--unified=0', '--relative', '--', '.'],
    repoDir
  )

  if (!diff) {
    return { findings: [], filesInspected: 0 }
  }

  const findings: AuditFinding[] = []
  const filesInspected = new Set<string>()
  let currentFile: string | null = null

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      currentFile = line.replace(/^diff --git a\/[^\s]+ b\//, '')
      continue
    }

    if (!currentFile || !isContractFile(currentFile)) continue
    filesInspected.add(currentFile)

    if (!isBreakingLine(line)) continue

    findings.push({
      severity: crossSidecar ? 'high' : 'medium',
      repo: repository.id,
      file: toRelative(root, path.join(repoDir, currentFile)),
      message: `Possible contract breaking change: ${line.replace(/^-\s*/, '').slice(0, 120)}`,
      detail: crossSidecar
        ? 'The repository participates in a system-map relationship: an incompatible change may break consumers.'
        : 'Verify backward compatibility before publishing.'
    })
  }

  return { findings, filesInspected: filesInspected.size }
}

function missingContracts(
  root: string,
  map: ReturnType<typeof loadSystemMap>
): AuditFinding[] {
  const relationships = Array.isArray(map.relationships) ? map.relationships : []
  const entries = Array.isArray(map.repositories) ? map.repositories : []
  const findings: AuditFinding[] = []

  for (const relationship of relationships) {
    if (relationship.from === relationship.to) continue

    const from = entries.find(repository => repository.id === relationship.from)
    const to = entries.find(repository => repository.id === relationship.to)
    if (!from || !to) continue

    const contracts =
      contractFilesFor(repoAbsolutePath(root, from)).length +
      contractFilesFor(repoAbsolutePath(root, to)).length

    if (contracts === 0) {
      findings.push({
        severity: 'low',
        repo: relationship.from,
        message: `Relationship "${relationship.from} → ${relationship.to}" has no contract.md backing the change.`,
        detail: `Type: ${relationship.type || 'unknown'}.`
      })
    }
  }

  return findings
}

export function run(options: AuditOptions = {}): AuditReport {
  const root = resolveRoot(options.root)
  const map = loadSystemMap(root)
  const entries = Array.isArray(map.repositories) ? map.repositories : []
  const targets = options.repo
    ? entries.filter(repository => repository.id === options.repo)
    : entries.length > 0
      ? entries
      : [{ id: 'workspace', path: '.' }]

  const findings: AuditFinding[] = []
  let filesInspected = 0

  for (const repository of targets) {
    const result = analyzeRepository(root, repository, hasRelationship(map, repository.id))
    findings.push(...result.findings)
    filesInspected += result.filesInspected
  }

  findings.push(...missingContracts(root, map))

  const high = findings.filter(finding => finding.severity === 'high').length

  return {
    audit: 'contract-guard',
    repoRoot: root,
    generatedAt: new Date().toISOString(),
    summary:
      findings.length === 0
        ? 'No contract breaking changes or unbacked relationships detected.'
        : `${findings.length} contract finding(s)${high > 0 ? `, ${high} blocking` : ''}.`,
    findings,
    metrics: {
      repositories: targets.length,
      filesInspected,
      findings: findings.length,
      highSeverity: high
    }
  }
}
