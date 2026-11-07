import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type LicenseFailureReason =
  | 'missing-token'
  | 'missing-public-key'
  | 'invalid-format'
  | 'invalid-signature'
  | 'invalid-payload'
  | 'expired'
  | 'invalid-plan'

export interface LicensePayload {
  sub?: string
  plan?: string
  features?: string[]
  exp?: number
  iat?: number
  [key: string]: unknown
}

export interface LicenseInfo {
  payload: LicensePayload
  source: 'env' | 'config' | 'bypass'
  bypass?: 'development' | 'env-flag' | 'master-key'
  expiresAt: string | null
}

export class LicenseError extends Error {
  readonly reason: LicenseFailureReason

  constructor(reason: LicenseFailureReason, message: string) {
    super(message)
    this.name = 'LicenseError'
    this.reason = reason
  }
}

const ENTERPRISE_PLANS = new Set(['enterprise', 'enterprise-plus', 'enterprise_plus'])
const FOUNDER_MASTER_KEY_HASH =
  'b60210cfa0f110f9fb8c87a10794cb75f803f4227bf69f1fda8119108ae3fef6'

type Lang = 'en' | 'es'

const AUTH_MESSAGES: Record<Lang, Record<string, string>> = {
  en: {
    'missing-token': 'No active Enterprise license found in this environment.',
    'missing-public-key': 'Missing public key to validate the Enterprise license.',
    'invalid-format': 'The Enterprise token has an invalid format. Expected <payload>.<signature>.',
    'invalid-payload': 'The Enterprise token payload is not valid JSON.',
    'signature-error': 'Could not verify the token signature: {error}',
    'invalid-signature': 'The Enterprise token signature is invalid.',
    'expired': 'The Enterprise license expired on {date}.',
    'invalid-plan': 'The token does not correspond to an Enterprise plan with audit access.'
  },
  es: {
    'missing-token': 'No hay una licencia Enterprise activa en este entorno.',
    'missing-public-key': 'Falta la clave pública para validar la licencia Enterprise.',
    'invalid-format': 'El token Enterprise tiene un formato inválido. Debe ser <payload>.<firma>.',
    'invalid-payload': 'El payload del token Enterprise no es JSON válido.',
    'signature-error': 'No se pudo verificar la firma del token: {error}',
    'invalid-signature': 'La firma del token Enterprise no es válida.',
    'expired': 'La licencia Enterprise expiró el {date}.',
    'invalid-plan': 'El token no corresponde a un plan Enterprise con acceso a auditorías.'
  }
}

function readLanguageFrom(file: string): Lang | null {
  try {
    if (!fs.existsSync(file)) return null
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { language?: string }
    return data.language === 'en' || data.language === 'es' ? data.language : null
  } catch {
    return null
  }
}

export function resolveLanguage(): Lang {
  const fromEnv = process.env.BRAIN_LANG
  if (fromEnv === 'en' || fromEnv === 'es') return fromEnv

  const project = readLanguageFrom(path.join(process.cwd(), '.brain', 'config.json'))
  if (project) return project

  const globalConfig = readLanguageFrom(path.join(os.homedir(), '.brain', 'config.json'))
  if (globalConfig) return globalConfig

  return 'en'
}

function msg(key: string, params: Record<string, string> = {}): string {
  const language = resolveLanguage()
  const template = AUTH_MESSAGES[language][key] || AUTH_MESSAGES.en[key] || key
  return template.replace(/\{\{?\s*([A-Za-z0-9_.-]+)\s*\}?\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match
  })
}

function safeEqualHex(left: string, right: string): boolean {
  let leftBuffer: Buffer
  let rightBuffer: Buffer

  try {
    leftBuffer = Buffer.from(left, 'hex')
    rightBuffer = Buffer.from(right, 'hex')
  } catch {
    return false
  }

  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function founderLicense(bypass: LicenseInfo['bypass']): LicenseInfo {
  return {
    payload: {
      sub: 'founder',
      plan: 'enterprise',
      features: ['*'],
      iat: Math.floor(Date.now() / 1000)
    },
    source: 'bypass',
    bypass,
    expiresAt: null
  }
}

export function resolveBypass(): LicenseInfo | null {
  if (process.env.BRAIN_ENV === 'development') {
    return founderLicense('development')
  }

  if (String(process.env.BRAIN_BYPASS_LICENSE || '').trim().toLowerCase() === 'true') {
    return founderLicense('env-flag')
  }

  const masterKey = String(process.env.BRAIN_MASTER_KEY || '').trim()
  if (!masterKey) return null

  const actual = crypto.createHash('sha256').update(masterKey).digest('hex')
  const expected = String(process.env.BRAIN_MASTER_KEY_HASH || FOUNDER_MASTER_KEY_HASH)
    .trim()
    .toLowerCase()

  return safeEqualHex(actual, expected) ? founderLicense('master-key') : null
}

export function configPath(): string {
  return process.env.BRAIN_CONFIG_PATH || path.join(os.homedir(), '.brain', 'config.json')
}

function readConfig(): Record<string, unknown> | null {
  const file = configPath()
  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function nestedValue(source: unknown, keys: string[]): unknown {
  let current: unknown = source
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function readTokenFromConfig(config: Record<string, unknown> | null): string | null {
  if (!config) return null

  const candidates = [
    ['enterpriseLicense'],
    ['enterprise', 'license'],
    ['enterprise', 'token'],
    ['license']
  ]

  for (const keys of candidates) {
    const value = nestedValue(config, keys)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

export function resolveLicenseToken(): { token: string; source: 'env' | 'config' } | null {
  const fromEnv = process.env.BRAIN_LICENSE_TOKEN
  if (fromEnv && fromEnv.trim()) {
    return { token: fromEnv.trim(), source: 'env' }
  }

  const fromConfig = readTokenFromConfig(readConfig())
  if (fromConfig) {
    return { token: fromConfig, source: 'config' }
  }

  return null
}

function readPublicKeyFile(file: string): string | null {
  if (!fs.existsSync(file)) return null

  try {
    const content = fs.readFileSync(file, 'utf8').trim()
    return content || null
  } catch {
    return null
  }
}

export function resolvePublicKey(): string | null {
  const inline = process.env.BRAIN_LICENSE_PUBLIC_KEY
  if (inline && inline.trim()) {
    return inline.replace(/\\n/g, '\n').trim()
  }

  const fileEnv = process.env.BRAIN_LICENSE_PUBLIC_KEY_FILE
  if (fileEnv) {
    const fromFile = readPublicKeyFile(fileEnv)
    if (fromFile) return fromFile
  }

  const defaultFile = path.join(os.homedir(), '.brain', 'license-public.pem')
  return readPublicKeyFile(defaultFile)
}

function hasEnterprisePlan(payload: LicensePayload): boolean {
  const plan = typeof payload.plan === 'string' ? payload.plan.toLowerCase() : ''
  if (ENTERPRISE_PLANS.has(plan)) return true

  const features = Array.isArray(payload.features) ? payload.features : []
  return features.some(feature => {
    const value = String(feature).toLowerCase()
    return value === '*' || value === 'audit' || value.startsWith('audit:')
  })
}

export function verifyLicenseToken(
  token: string,
  publicKey: string,
  source: 'env' | 'config'
): LicenseInfo {
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new LicenseError(
      'invalid-format',
      msg('invalid-format')
    )
  }

  const [payloadPart, signaturePart] = parts
  let payload: LicensePayload

  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as LicensePayload
  } catch {
    throw new LicenseError(
      'invalid-payload',
      msg('invalid-payload')
    )
  }

  let signatureValid = false

  try {
    signatureValid = crypto.verify(
      null,
      Buffer.from(payloadPart, 'utf8'),
      publicKey,
      Buffer.from(signaturePart, 'base64url')
    )
  } catch (error) {
    throw new LicenseError(
      'invalid-signature',
      msg('signature-error', { error: (error as Error).message })
    )
  }

  if (!signatureValid) {
    throw new LicenseError(
      'invalid-signature',
      msg('invalid-signature')
    )
  }

  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
    throw new LicenseError(
      'expired',
      msg('expired', {
        date: new Date(payload.exp * 1000).toISOString().slice(0, 10)
      })
    )
  }

  if (!hasEnterprisePlan(payload)) {
    throw new LicenseError(
      'invalid-plan',
      msg('invalid-plan')
    )
  }

  return {
    payload,
    source,
    expiresAt:
      typeof payload.exp === 'number'
        ? new Date(payload.exp * 1000).toISOString()
        : null
  }
}

export function requireEnterpriseLicense(): LicenseInfo {
  const bypass = resolveBypass()
  if (bypass) return bypass

  const resolved = resolveLicenseToken()

  if (!resolved) {
    throw new LicenseError(
      'missing-token',
      msg('missing-token')
    )
  }

  const publicKey = resolvePublicKey()
  if (!publicKey) {
    throw new LicenseError(
      'missing-public-key',
      msg('missing-public-key')
    )
  }

  return verifyLicenseToken(resolved.token, publicKey, resolved.source)
}

export function licenseHelpMessage(language?: Lang): string {
  const lang = language || resolveLanguage()
  const config = configPath()
  const publicKeyPath = path.join(os.homedir(), '.brain', 'license-public.pem')

  if (lang === 'es') {
    return [
      '╭──────────────────────────────────────────────────────────────╮',
      '│  brain-corp · Auditorías Enterprise                          │',
      '╰──────────────────────────────────────────────────────────────╯',
      '',
      'Esta capacidad requiere una licencia Enterprise activa.',
      '',
      'Activa tu token de una de estas formas:',
      '',
      '  1) Variable de entorno (recomendado en CI):',
      '     export BRAIN_LICENSE_TOKEN="<payload>.<firma>"',
      '',
      '  2) Archivo local de configuración:',
      `     ${config}`,
      '     { "enterpriseLicense": "<payload>.<firma>" }',
      '',
      'La validación es local con firma Ed25519. Puedes indicar la clave',
      'pública con BRAIN_LICENSE_PUBLIC_KEY, BRAIN_LICENSE_PUBLIC_KEY_FILE',
      `o en ${publicKeyPath}.`,
      '',
      'Solicita tu token al administrador de tu organización.',
      ''
    ].join('\n')
  }

  return [
    '╭──────────────────────────────────────────────────────────────╮',
    '│  brain-corp · Enterprise audits                              │',
    '╰──────────────────────────────────────────────────────────────╯',
    '',
    'This capability requires an active Enterprise license.',
    '',
    'Activate your token in one of these ways:',
    '',
    '  1) Environment variable (recommended in CI):',
    '     export BRAIN_LICENSE_TOKEN="<payload>.<signature>"',
    '',
    '  2) Local configuration file:',
    `     ${config}`,
    '     { "enterpriseLicense": "<payload>.<signature>" }',
    '',
    'Validation is local with an Ed25519 signature. Provide the public key',
    'with BRAIN_LICENSE_PUBLIC_KEY, BRAIN_LICENSE_PUBLIC_KEY_FILE',
    `or at ${publicKeyPath}.`,
    '',
    'Request your token from your organization administrator.',
    ''
  ].join('\n')
}
