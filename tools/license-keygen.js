#!/usr/bin/env node

const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

function fail(message) {
  console.error(`[license-keygen] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(`brain-corp license keygen (internal)

Usage:
  node tools/license-keygen.js [options]

Options:
  --out-dir <dir>   Output directory (default: ~/.brain/license-keys).
  --force           Overwrite an existing keypair.
  --json            Print the result as JSON.
  --help            Show this help.

Generates an Ed25519 keypair:
  brain-license-private.pem  (0600, keep offline, never commit or publish)
  brain-license-public.pem   (distribute to customers)`)
}

function parseArgs(argv) {
  const args = {
    outDir: path.join(os.homedir(), '.brain', 'license-keys'),
    force: false,
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

    if (current === '--out-dir') args.outDir = path.resolve(next())
    else if (current === '--force') args.force = true
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else fail(`Unknown option: ${current}`)
  }

  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    return
  }

  const privatePath = path.join(args.outDir, 'brain-license-private.pem')
  const publicPath = path.join(args.outDir, 'brain-license-public.pem')

  if (fs.existsSync(privatePath) && !args.force) {
    fail(`${privatePath} already exists. Use --force to overwrite.`)
  }

  fs.mkdirSync(args.outDir, { recursive: true, mode: 0o700 })

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  fs.writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600
  })
  fs.writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }), {
    mode: 0o644
  })

  if (args.json) {
    console.log(JSON.stringify({ privateKey: privatePath, publicKey: publicPath }, null, 2))
    return
  }

  console.log(`[license-keygen] Private key: ${privatePath}`)
  console.log(`[license-keygen] Public key:  ${publicPath}`)
  console.log('[license-keygen] Keep the private key offline. Distribute only the public key.')
}

main()
