#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const matter = require('gray-matter')
const { runSanityCheck } = require('./lib/sanity')

const ROOT_DIR = process.cwd()
const TICKETS_DIR = path.join(ROOT_DIR, '.agents', 'tickets', 'backlog')
const BRAINRC_PATH = path.join(ROOT_DIR, '.brainrc.json')

function labelColor(label) {
  let hash = 0

  for (const character of String(label || '')) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return (hash & 0xffffff).toString(16).padStart(6, '0')
}

function fail(message) {
  console.error(`[sync-github] ${message}`)
  process.exit(1)
}

function readBrainConfig() {
  if (!fs.existsSync(BRAINRC_PATH)) {
    console.warn(
      '[sync-github] No existe .brainrc.json. Ejecuta "npm run init-brain". Se usarán flags/variables globales si están presentes.'
    )
    return {}
  }

  try {
    return JSON.parse(fs.readFileSync(BRAINRC_PATH, 'utf8'))
  } catch (error) {
    fail(`.brainrc.json no es JSON válido: ${error.message}`)
  }
}

function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        fail(`Falta el valor para ${current}`)
      }
      index += 1
      return value
    }

    if (current === '--project') args.project = next()
    else if (current === '--owner') args.owner = next()
    else if (current === '--repo') args.repo = next()
    else if (current === '--skip-sanity') args.skipSanity = true
    else fail(`Argumento no reconocido: ${current}`)
  }

  return args
}

function runGh(ghArgs) {
  try {
    return execFileSync('gh', ghArgs, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString().trim() : ''
    throw new Error(stderr || error.message)
  }
}

function validateGhCli() {
  try {
    runGh(['--version'])
  } catch {
    fail(
      'No se encontró el CLI de GitHub (gh). Instálalo desde https://cli.github.com/ y ejecuta "gh auth login".'
    )
  }

  try {
    runGh(['auth', 'status'])
  } catch {
    fail('El CLI de GitHub no tiene una sesión activa. Ejecuta "gh auth login".')
  }
}

function runPreflightSanity(args) {
  if (args.skipSanity || process.env.BRAIN_SKIP_SANITY === '1') {
    console.warn('[sync-github] Sanity check omitido por configuración explícita.')
    return
  }

  const result = runSanityCheck()

  for (const warning of result.warnings) {
    console.warn(`[sync-github] Sanity WARN: ${warning}`)
  }

  if (!result.ok) {
    const details = result.errors.map(error => `  - ${error}`).join('\n')
    fail(
      `El sanity check bloqueó la sincronización con ${result.errors.length} error(es):\n${details}\nCorrige los tickets o ejecuta con --skip-sanity.`
    )
  }

  console.log(
    `[sync-github] Sanity check OK: ${result.totals.backlog} ticket(s) de backlog listos para sync.`
  )
}

function listTicketFiles() {
  if (!fs.existsSync(TICKETS_DIR)) {
    fail(`No existe el directorio de tickets: ${TICKETS_DIR}`)
  }

  return fs
    .readdirSync(TICKETS_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(TICKETS_DIR, file))
    .sort()
}

function buildTitle(data, fileName) {
  const target = (data.target_domain || 'shared').toUpperCase()
  const title = data.title || path.basename(fileName, '.md')

  return `[${target}] ${title}`
}

function ensureLabel(label) {
  const color = labelColor(label)

  try {
    runGh(['label', 'create', label, '--color', color, '--force'])
  } catch (error) {
    console.warn(`[sync-github] No se pudo asegurar la etiqueta "${label}": ${error.message}`)
  }
}

function createIssue({ title, ticketPath, label, repo }) {
  const ghArgs = ['issue', 'create', '--title', title, '--body-file', ticketPath]

  if (label) ghArgs.push('--label', label)
  if (repo) ghArgs.push('--repo', repo)

  return runGh(ghArgs)
}

function extractIssueUrl(output) {
  const match = output.match(/https?:\/\/\S+\/issues\/\d+/)
  return match ? match[0] : null
}

function extractIssueNumber(issueUrl) {
  const match = issueUrl.match(/\/issues\/(\d+)$/)
  return match ? Number(match[1]) : null
}

function addToProject({ issueUrl, projectNumber, owner }) {
  if (!projectNumber) return

  if (!owner) {
    console.warn(
      '[sync-github] Se solicitó añadir al Project, pero no se pudo determinar el propietario. Usa --owner o GITHUB_PROJECT_OWNER.'
    )
    return
  }

  try {
    runGh([
      'project',
      'item-add',
      String(projectNumber),
      '--owner',
      owner,
      '--url',
      issueUrl
    ])
    console.log(`[sync-github] Issue añadido al Project ${projectNumber}.`)
  } catch (error) {
    console.warn(`[sync-github] No se pudo añadir el issue al Project: ${error.message}`)
  }
}

function writeIssueNumber(filePath, rawContent, issueNumber) {
  const lines = rawContent.split(/\r?\n/)
  const openIndex = lines.findIndex(line => line.trim() === '---')

  if (openIndex === -1) {
    const fallback = matter.stringify(rawContent, { github_issue: issueNumber })
    fs.writeFileSync(filePath, fallback, 'utf8')
    return
  }

  const closeIndex = lines.findIndex(
    (line, index) => index > openIndex && line.trim() === '---'
  )

  if (closeIndex === -1) {
    throw new Error(`Frontmatter YAML sin cierre en ${filePath}`)
  }

  lines.splice(closeIndex, 0, `github_issue: ${issueNumber}`)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  validateGhCli()

  runPreflightSanity(args)

  const brainConfig = readBrainConfig()

  const repo = args.repo || process.env.GITHUB_REPO || brainConfig.repo || null
  const projectNumber =
    args.project || process.env.GITHUB_PROJECT_NUM || brainConfig.projectId || null
  const projectOwner =
    args.owner ||
    process.env.GITHUB_PROJECT_OWNER ||
    brainConfig.projectOwner ||
    brainConfig.githubUser ||
    null

  if (projectNumber) {
    console.log(
      `[sync-github] Project configurado: #${projectNumber} (owner: ${projectOwner || 'desconocido'}).`
    )
  }

  const files = listTicketFiles()

  if (files.length === 0) {
    console.log('[sync-github] No hay tickets en backlog/. Nada que sincronizar.')
    return
  }

  let created = 0
  let skipped = 0
  let failed = 0

  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const rawContent = fs.readFileSync(filePath, 'utf8')
    const parsed = matter(rawContent)
    const data = parsed.data

    if (data.github_issue) {
      console.log(`[sync-github] ${fileName}: ya tiene issue #${data.github_issue}, se omite.`)
      skipped += 1
      continue
    }

    const title = buildTitle(data, fileName)
    const label = data.target_domain || null

    try {
      if (label) ensureLabel(label)

      const output = createIssue({ title, ticketPath: filePath, label, repo })
      const issueUrl = extractIssueUrl(output)
      const issueNumber = issueUrl ? extractIssueNumber(issueUrl) : null

      if (!issueNumber) {
        throw new Error(`No se pudo extraer el número de issue de la salida de gh: ${output}`)
      }

      writeIssueNumber(filePath, rawContent, issueNumber)
      console.log(`[sync-github] ${fileName}: issue #${issueNumber} creado (${issueUrl}).`)

      if (issueUrl && projectNumber) {
        const owner = projectOwner || issueUrl.split('/')[3]
        addToProject({ issueUrl, projectNumber, owner })
      }

      created += 1
    } catch (error) {
      console.error(`[sync-github] ${fileName}: error al crear el issue -> ${error.message}`)
      failed += 1
    }
  }

  console.log(
    `[sync-github] Resumen: ${created} creados, ${skipped} omitidos, ${failed} con error.`
  )

  if (failed > 0) {
    process.exitCode = 1
  }
}

main()
