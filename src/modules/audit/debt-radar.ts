import path from 'node:path'
import type { AuditFinding, AuditOptions, AuditReport, RepositoryEntry } from './types'
import {
  contractFilesFor,
  daysSince,
  hasRelationship,
  lastCommitDate,
  loadSystemMap,
  readText,
  repositories,
  repoAbsolutePath,
  resolveRoot,
  toRelative,
  walkFiles
} from './utils'

const CODE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.prisma',
  '.sql',
  '.graphql',
  '.gql'
]

const MARKERS = /\b(TODO|FIXME|HACK|XXX)\b/i
const ANY_USAGE = /(?::\s*any\b|\bas\s+any\b|<any>)/

function severityForAge(ageDays: number | null, isAny: boolean): AuditFinding['severity'] {
  if (ageDays !== null && ageDays >= 90) return 'high'
  if (ageDays !== null && ageDays >= 30) return 'medium'
  if (isAny) return 'medium'
  return 'low'
}

function analyzeRepository(root: string, repository: RepositoryEntry): AuditFinding[] {
  const repoDir = repoAbsolutePath(root, repository)
  const files = walkFiles(repoDir, CODE_EXTENSIONS)
  const findings: AuditFinding[] = []

  for (const file of files) {
    const text = readText(file)
    if (!text) continue

    const lines = text.split(/\r?\n/)
    const markerLines: number[] = []
    const anyLines: number[] = []

    lines.forEach((line, index) => {
      if (MARKERS.test(line)) markerLines.push(index + 1)
      if (ANY_USAGE.test(line)) anyLines.push(index + 1)
    })

    if (markerLines.length === 0 && anyLines.length === 0) continue

    const ageDays = daysSince(lastCommitDate(repoDir, path.relative(repoDir, file)))

    if (markerLines.length > 0) {
      findings.push({
        severity: severityForAge(ageDays, false),
        repo: repository.id,
        file: toRelative(root, file),
        line: markerLines[0],
        message: `${markerLines.length} pending technical marker(s) (${[
          ...new Set(
            markerLines
              .map(lineNumber => lines[lineNumber - 1].match(MARKERS)?.[1]?.toUpperCase())
              .filter(Boolean) as string[]
          )
        ].join(', ') || 'TODO'}).`,
        detail:
          ageDays === null
            ? 'No git history available to estimate age.'
            : `Age of last change: ${ageDays} day(s).`
      })
    }

    if (anyLines.length > 0) {
      findings.push({
        severity: severityForAge(ageDays, true),
        repo: repository.id,
        file: toRelative(root, file),
        line: anyLines[0],
        message: `${anyLines.length} unjustified "any" usage(s).`,
        detail: 'Weak typing detected; check whether a typed alternative exists.'
      })
    }
  }

  return findings
}

function crossSidecarFriction(root: string, map: ReturnType<typeof loadSystemMap>): AuditFinding[] {
  const relationships = Array.isArray(map.relationships) ? map.relationships : []
  const entries = Array.isArray(map.repositories) ? map.repositories : []
  const findings: AuditFinding[] = []

  for (const relationship of relationships) {
    if (relationship.from === relationship.to) continue

    const from = entries.find(repository => repository.id === relationship.from)
    const to = entries.find(repository => repository.id === relationship.to)
    if (!from || !to) continue

    const fromContracts = contractFilesFor(repoAbsolutePath(root, from)).length
    const toContracts = contractFilesFor(repoAbsolutePath(root, to)).length

    if (fromContracts === 0 && toContracts === 0) {
      findings.push({
        severity: 'medium',
        repo: relationship.from,
        message: `Integration "${relationship.from} → ${relationship.to}" has no contract.md registered in either repository.`,
        detail: `Relationship type: ${relationship.type || 'unknown'}.`
      })
    }
  }

  return findings
}

export function run(options: AuditOptions = {}): AuditReport {
  const root = resolveRoot(options.root)
  const map = loadSystemMap(root)
  const targets = repositories(root, map, options.repo)

  const findings: AuditFinding[] = []

  for (const repository of targets) {
    findings.push(...analyzeRepository(root, repository))
    if (hasRelationship(map, repository.id)) {
      findings.push(...crossSidecarFriction(root, map))
    }
  }

  const unique = new Map<string, AuditFinding>()
  for (const finding of findings) {
    const key = `${finding.repo}|${finding.file || ''}|${finding.message}`
    if (!unique.has(key)) unique.set(key, finding)
  }

  const result = [...unique.values()]
  const high = result.filter(finding => finding.severity === 'high').length

  return {
    audit: 'debt-radar',
    repoRoot: root,
    generatedAt: new Date().toISOString(),
    summary:
      result.length === 0
        ? 'No relevant technical debt detected.'
        : `${result.length} technical debt finding(s)${high > 0 ? `, ${high} high severity` : ''}.`,
    findings: result,
    metrics: {
      repositories: targets.length,
      findings: result.length,
      highSeverity: high
    }
  }
}

export function markerFileList(root: string, repository: RepositoryEntry): string[] {
  const repoDir = repoAbsolutePath(root, repository)
  return walkFiles(repoDir, CODE_EXTENSIONS).map(file => path.relative(root, file))
}
