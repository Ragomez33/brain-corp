export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface AuditFinding {
  severity: Severity
  message: string
  file?: string
  line?: number
  repo?: string
  detail?: string
}

export interface AuditOptions {
  root?: string
  repo?: string
  ticket?: string
}

export interface AuditReport {
  audit: string
  repoRoot: string
  generatedAt: string
  summary: string
  findings: AuditFinding[]
  metrics: Record<string, number | string | boolean | null>
}

export interface RepositoryEntry {
  id: string
  name?: string
  path: string
  role?: string
  [key: string]: unknown
}

export interface RelationshipEntry {
  from: string
  to: string
  type?: string
  [key: string]: unknown
}

export interface SystemMap {
  repositories?: RepositoryEntry[]
  relationships?: RelationshipEntry[]
  [key: string]: unknown
}
