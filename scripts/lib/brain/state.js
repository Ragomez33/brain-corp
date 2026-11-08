const fs = require('node:fs')
const path = require('node:path')

function brainDir(repoDir) {
  return path.join(repoDir, '.brain')
}

function activePath(repoDir) {
  return path.join(brainDir(repoDir), 'active.json')
}

function readActive(repoDir) {
  const file = activePath(repoDir)
  if (!fs.existsSync(file)) return null

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`Could not read ${path.relative(repoDir, file)}: ${error.message}`)
  }
}

function writeActive(repoDir, data) {
  const file = activePath(repoDir)
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const payload = {
    ...data,
    updatedAt: new Date().toISOString()
  }

  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return file
}

function updateActive(repoDir, updates) {
  const current = readActive(repoDir) || {}
  return writeActive(repoDir, { ...current, ...updates })
}

function ensureBrainGitignore(repoDir) {
  const file = path.join(brainDir(repoDir), '.gitignore')
  if (fs.existsSync(file)) return { created: false, path: file }

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, 'active.json\n', 'utf8')
  return { created: true, path: file }
}

module.exports = {
  activePath,
  brainDir,
  ensureBrainGitignore,
  readActive,
  updateActive,
  writeActive
}
