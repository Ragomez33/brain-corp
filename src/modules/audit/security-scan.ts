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

const SECURITY_CONTROLS: SecurityControl[] = [
  {
    key: 'auth',
    keyword: /(auth|autenticaci[oó]n|autorizaci[oó]n|permiso|rol(es)?|sesi[oó]n|jwt)/i,
    control: /(auth|authoriz|permission|rbac|guard|jwt|session|role)/i,
    severity: 'high',
    label: 'autenticación/autorización'
  },
  {
    key: 'validation',
    keyword: /(validaci[oó]n|validar|sanitiz|escape|entrada|input)/i,
    control: /(validat|sanitiz|escape|zod|joi|yup|class-validator|schema)/i,
    severity: 'high',
    label: 'validación de entrada'
  },
  {
    key: 'injection',
    keyword: /(inyecci[oó]n|sql|query|consulta|parametriz)/i,
    control: /(parameteri[sz]ed|prepared|placeholder|\$\d+|prisma|knex|drizzle|query builder|escape)/i,
    severity: 'critical',
    label: 'prevención de inyección'
  },
  {
    key: 'secrets',
    keyword: /(secreto|secret|token|credencial|password|contrase[nñ]a)/i,
    control: /(process\.env|config\.|vault|secret manager|env\[)/i,
    severity: 'high',
    label: 'manejo de secretos'
  },
  {
    key: 'rate-limit',
    keyword: /(rate.?limit|throttl|abuso|fuerza bruta)/i,
    control: /(rate.?limit|throttl|limiter|slowdown)/i,
    severity: 'medium',
    label: 'rate limiting'
  }
]

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
        'No hay una feature activa con spec.md. Usa /init-work y /specify, o pasa --ticket <TICK-XXX>.',
      findings: [
        {
          severity: 'info',
          message: 'No se encontró spec activa para contrastar controles de seguridad.'
        }
      ],
      metrics: { repositories: entries.length, requirements: 0, findings: 0 }
    }
  }

  const specPath = path.join(context.featureDir, 'spec.md')
  const spec = readText(specPath)
  const requirements = parseRequirements(spec)
  const code = repositoryCode(context.repoDir)
  const findings: AuditFinding[] = []

  for (const requirement of requirements) {
    const matchedControls = SECURITY_CONTROLS.filter(control => control.keyword.test(requirement.text))
    if (matchedControls.length === 0) continue

    for (const control of matchedControls) {
      if (control.control.test(code)) continue

      findings.push({
        severity: control.severity,
        repo: context.repoId,
        file: toRelative(root, specPath),
        message: `${requirement.id} exige ${control.label}, pero no se encontró un control correspondiente en el código.`,
        detail: `Requisito: "${requirement.text.slice(0, 160)}".`
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
        ? `Sin desvíos de seguridad detectados para ${context.ticketId}.`
        : `${findings.length} desvío(s) de seguridad para ${context.ticketId}${critical + high > 0 ? `, ${critical + high} de severidad alta/crítica` : ''}.`,
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
