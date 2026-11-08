import fs from 'node:fs'
import path from 'node:path'
import type { AuditFinding, AuditOptions, AuditReport } from './types'
import {
  loadSystemMap,
  readJson,
  readText,
  repositories,
  repoAbsolutePath,
  resolveRoot,
  toRelative,
  walkFiles
} from './utils'

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.prisma', '.sql', '.graphql']

interface SecurityControl {
  key: string
  keyword: RegExp
  control: RegExp
  severity: AuditFinding['severity']
  label: string
}

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..', '..')

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function securityControls(): SecurityControl[] {
  const languages = ['en', 'es']
  const merged = new Map<
    string,
    {
      key: string
      label: string
      keywords: Set<string>
      controls: Set<string>
      severity: AuditFinding['severity']
    }
  >()

  for (const language of languages) {
    const file = path.join(PACKAGE_ROOT, 'templates', 'i18n', language, 'validation.json')
    const pack = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      securityControls: Array<{
        key: string
        label: string
        keywords: string[]
        controls: string[]
        severity: AuditFinding['severity']
      }>
    }

    for (const control of pack.securityControls) {
      const current = merged.get(control.key) || {
        key: control.key,
        label: control.label,
        keywords: new Set<string>(),
        controls: new Set<string>(),
        severity: control.severity
      }

      control.keywords.forEach(keyword => current.keywords.add(keyword))
      control.controls.forEach(item => current.controls.add(item))
      merged.set(control.key, current)
    }
  }

  return [...merged.values()].map(control => ({
    key: control.key,
    label: control.label,
    severity: control.severity,
    keyword: new RegExp(`(${[...control.keywords].map(escapeRegExp).join('|')})`, 'i'),
    control: new RegExp(`(${[...control.controls].map(escapeRegExp).join('|')})`, 'i')
  }))
}

interface Requirement {
  id: string
  text: string
}

function parseRequirements(spec: string): Requirement[] {
  const requirements: Requirement[] = []
  const matcher = /\*\*(REQ-[A-Z]-\d{3})\*\*\s*(.+)/g
  let match = matcher.exec(spec)

  while (match) {
    requirements.push({ id: match[1], text: match[2].trim() })
    match = matcher.exec(spec)
  }

  return requirements
}

function findActiveTicket(
  root: string,
  repoDirs: Array<{ id: string; dir: string }>,
  ticket?: string
): { repoId: string; repoDir: string; ticketId: string; featureDir: string } | null {
  for (const repo of repoDirs) {
    if (ticket) {
      const featureDir = path.join(repo.dir, '.brain', 'features', ticket)
      if (fs.existsSync(path.join(featureDir, 'spec.md'))) {
        return { repoId: repo.id, repoDir: repo.dir, ticketId: ticket, featureDir }
      }
      continue
    }

    const active = readJson<{ ticketId?: string; featureDir?: string }>(
      path.join(repo.dir, '.brain', 'active.json')
    )

    if (!active?.ticketId) continue

    const featureDir = path.join(repo.dir, '.brain', 'features', active.ticketId)
    if (fs.existsSync(path.join(featureDir, 'spec.md'))) {
      return { repoId: repo.id, repoDir: repo.dir, ticketId: active.ticketId, featureDir }
    }
  }

  return null
}

function repositoryCode(repoDir: string): string {
  return walkFiles(repoDir, CODE_EXTENSIONS)
    .map(file => readText(file))
    .join('\n')
}

export function run(options: AuditOptions = {}): AuditReport {
  const root = resolveRoot(options.root)
  const map = loadSystemMap(root)
  const entries = repositories(root, map, options.repo)
  const repoDirs = entries.map(repository => ({
    id: repository.id,
    dir: repoAbsolutePath(root, repository)
  }))

  const context = findActiveTicket(root, repoDirs, options.ticket)

  if (!context) {
    return {
      audit: 'security-scan',
      repoRoot: root,
      generatedAt: new Date().toISOString(),
      summary:
        'No active feature with spec.md. Run /init-work and /specify, or pass --ticket <TICK-XXX>.',
      findings: [
        {
          severity: 'info',
          message: 'No active spec found to compare security controls.'
        }
      ],
      metrics: { repositories: entries.length, requirements: 0, findings: 0 }
    }
  }

  const specPath = path.join(context.featureDir, 'spec.md')
  const spec = readText(specPath)
  const requirements = parseRequirements(spec)
  const code = repositoryCode(context.repoDir)
  const controls = securityControls()
  const findings: AuditFinding[] = []

  for (const requirement of requirements) {
    const matchedControls = controls.filter(control => control.keyword.test(requirement.text))
    if (matchedControls.length === 0) continue

    for (const control of matchedControls) {
      if (control.control.test(code)) continue

      findings.push({
        severity: control.severity,
        repo: context.repoId,
        file: toRelative(root, specPath),
        message: `${requirement.id} requires ${control.label}, but no corresponding control was found in the code.`,
        detail: `Requirement: "${requirement.text.slice(0, 160)}".`
      })
    }
  }

  const critical = findings.filter(finding => finding.severity === 'critical').length
  const high = findings.filter(finding => finding.severity === 'high').length

  return {
    audit: 'security-scan',
    repoRoot: root,
    generatedAt: new Date().toISOString(),
    summary:
      findings.length === 0
        ? `No security deviations detected for ${context.ticketId}.`
        : `${findings.length} security deviation(s) for ${context.ticketId}${critical + high > 0 ? `, ${critical + high} high/critical severity` : ''}.`,
    findings,
    metrics: {
      ticket: context.ticketId,
      repository: context.repoId,
      requirements: requirements.length,
      findings: findings.length,
      critical,
      high
    }
  }
}
