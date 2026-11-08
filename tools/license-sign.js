#!/usr/bin/env node

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

function fail(message) {
  console.error(`[license-sign] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(`brain-corp license sign (internal)

Usage:
  node tools/license-sign.js --private-key <file> [options]

Options:
  --private-key <file>  Ed25519 private key PEM (or BRAIN_LICENSE_PRIVATE_KEY_FILE).
  --sub <id>            License subject, e.g. customer email (default: customer).
  --plan <plan>         enterprise | enterprise-plus (default: enterprise).
  --features <list>     Comma-separated features (default: audit:*).
  --days <n>            Days until expiry (default: 365).
  --exp <date|epoch>    Explicit expiry (ISO date or Unix seconds).
  --out <file>          Write the token to a file instead of stdout.
  --json                Print token and payload as JSON.
  --help                Show this help.

Environment:
  BRAIN_LICENSE_PRIVATE_KEY       Inline private key PEM.
  BRAIN_LICENSE_PRIVATE_KEY_FILE  Path to the private key PEM.

Output token format: base64url(payload).base64url(ed25519-signature)`)
}

function parseArgs(argv) {
  const args = {
    privateKey: null,
    sub: 'customer',
    plan: 'enterprise',
    features: ['audit:*'],
    days: 365,
    exp: null,
    out: null,
    json: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) fail(`Missing value for ${current}`)
      index += 1
      return value
    }

    if (current === '--private-key') args.privateKey = path.resolve(next())
    else if (current === '--sub') args.sub = next()
    else if (current === '--plan') args.plan = next()
    else if (current === '--features') {
      args.features = next()
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    } else if (current === '--days') args.days = Number(next())
    else if (current === '--exp') args.exp = next()
    else if (current === '--out') args.out = path.resolve(next())
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else fail(`Unknown option: ${current}`)
  }

  return args
}

function readPrivateKey(args) {
  const inline = process.env.BRAIN_LICENSE_PRIVATE_KEY
  if (inline && inline.trim()) return inline.replace(/\\n/g, '\n')

  const file = args.privateKey || process.env.BRAIN_LICENSE_PRIVATE_KEY_FILE
  if (!file) fail('Missing --private-key (or BRAIN_LICENSE_PRIVATE_KEY_FILE).')
  if (!fs.existsSync(file)) fail(`Private key not found: ${file}`)

  return fs.readFileSync(file, 'utf8')
}

function resolveExpiry(args) {
  const now = Math.floor(Date.now() / 1000)

  if (args.exp) {
    if (/^\d+$/.test(args.exp)) return Number(args.exp)
    const parsed = Date.parse(args.exp)
    if (Number.isNaN(parsed)) fail(`Invalid --exp value: ${args.exp}`)
    return Math.floor(parsed / 1000)
  }

  if (!Number.isFinite(args.days) || args.days <= 0) fail('--days must be a positive number.')
  return now + Math.floor(args.days * 86400)
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const privateKey = readPrivateKey(args)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: args.sub,
    plan: args.plan,
    features: args.features,
    iat: now,
    exp: resolveExpiry(args)
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .sign(null, Buffer.from(encodedPayload, 'utf8'), privateKey)
    .toString('base64url')
  const token = `${encodedPayload}.${signature}`

  if (args.out) {
    fs.writeFileSync(args.out, `${token}\n`, { mode: 0o600 })
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          token,
          payload,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          out: args.out
        },
        null,
        2
      )
    )
    return
  }

  if (!args.out) console.log(token)
  else console.log(`[license-sign] Token written to ${args.out}`)
}

main()
