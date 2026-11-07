import * as ts from 'typescript'
import type { AuditFinding, AuditOptions, AuditReport, RepositoryEntry } from './types'
import {
  loadSystemMap,
  readText,
  repositories,
  repoAbsolutePath,
  resolveRoot,
  toRelative,
  walkFiles
} from './utils'

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']

interface SourceInfo {
  file: string
  source: ts.SourceFile
  size: number
  exports: string[]
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return Boolean(modifiers && modifiers.some(modifier => modifier.kind === kind))
}

function isExported(node: ts.Node): boolean {
  return (
    hasModifier(node, ts.SyntaxKind.ExportKeyword) ||
    hasModifier(node, ts.SyntaxKind.DefaultKeyword)
  )
}

function declaredNames(node: ts.Node): string[] {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
    return node.name ? [node.name.text] : []
  }
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    return [node.name.text]
  }
  if (ts.isVariableStatement(node)) {
    const names: string[] = []
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text)
    }
    return names
  }
  return []
}

function collectExports(source: ts.SourceFile): string[] {
  const names = new Set<string>()

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add((element.name || element.propertyName)?.text || '')
        }
      }
      continue
    }

    if (isExported(statement)) {
      for (const name of declaredNames(statement)) {
        if (name) names.add(name)
      }
    }
  }

  names.delete('')
  return [...names]
}

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent
  if (!parent) return false

  if (
    (ts.isFunctionDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isEnumDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertySignature(parent)) &&
    parent.name === node
  ) {
    return true
  }

  return false
}

function isPropertyAccessName(node: ts.Identifier): boolean {
  const parent = node.parent
  if (!parent) return false
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isQualifiedName(parent) && parent.right === node)
  )
}

function collectUsage(source: ts.SourceFile): Map<string, number> {
  const usage = new Map<string, number>()

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !isDeclarationName(node) && !isPropertyAccessName(node)) {
      const name = node.text
      usage.set(name, (usage.get(name) || 0) + 1)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return usage
}

function analyzeRepository(root: string, repository: RepositoryEntry): {
  findings: AuditFinding[]
  metrics: Record<string, number | string>
} {
  const repoDir = repoAbsolutePath(root, repository)
  const files = walkFiles(repoDir, SOURCE_EXTENSIONS).filter(
    file => !file.endsWith('.d.ts')
  )

  const sources: SourceInfo[] = files.map(file => {
    const text = readText(file)
    return {
      file,
      source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true),
      size: Buffer.byteLength(text, 'utf8'),
      exports: [] as string[]
    }
  })

  const globalUsage = new Map<string, number>()
  for (const info of sources) {
    info.exports = collectExports(info.source)
    for (const [name, count] of collectUsage(info.source)) {
      globalUsage.set(name, (globalUsage.get(name) || 0) + count)
    }
  }

  const findings: AuditFinding[] = []
  let orphanSymbols = 0
  let estimatedSavingsBytes = 0

  for (const info of sources) {
    if (info.exports.length === 0) continue

    const orphans = info.exports.filter(name => (globalUsage.get(name) || 0) === 0)
    if (orphans.length === 0) continue

    orphanSymbols += orphans.length
    const estimated = Math.round(info.size / info.exports.length) * orphans.length
    estimatedSavingsBytes += estimated

    findings.push({
      severity: orphans.length === info.exports.length ? 'medium' : 'low',
      repo: repository.id,
      file: toRelative(root, info.file),
      message: `${orphans.length} export(s) sin referencias internas: ${orphans
        .slice(0, 8)
        .join(', ')}${orphans.length > 8 ? '…' : ''}`,
      detail: `Ahorro estimado de bundle: ~${estimated} bytes. Heurística: no detecta consumidores externos.`
    })
  }

  return {
    findings,
    metrics: {
      filesScanned: sources.length,
      orphanSymbols,
      estimatedSavingsBytes
    }
  }
}

export function run(options: AuditOptions = {}): AuditReport {
  const root = resolveRoot(options.root)
  const map = loadSystemMap(root)
  const targets = repositories(root, map, options.repo)

  const findings: AuditFinding[] = []
  let filesScanned = 0
  let orphanSymbols = 0
  let estimatedSavingsBytes = 0

  for (const repository of targets) {
    const result = analyzeRepository(root, repository)
    findings.push(...result.findings)
    filesScanned += Number(result.metrics.filesScanned)
    orphanSymbols += Number(result.metrics.orphanSymbols)
    estimatedSavingsBytes += Number(result.metrics.estimatedSavingsBytes)
  }

  return {
    audit: 'dead-code',
    repoRoot: root,
    generatedAt: new Date().toISOString(),
    summary:
      orphanSymbols === 0
        ? 'No se detectaron exports huérfanos con la heurística interna.'
        : `${orphanSymbols} export(s) potencialmente huérfanos en ${findings.length} archivo(s).`,
    findings,
    metrics: {
      repositories: targets.length,
      filesScanned,
      orphanSymbols,
      estimatedSavingsBytes
    }
  }
}
