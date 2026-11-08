const fs = require('node:fs')
const path = require('node:path')
const { resolveLanguage } = require('./config')

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..')
const PACK_DIR = path.join(PACKAGE_ROOT, 'templates', 'i18n')
const LANGUAGES = ['en', 'es']

const cache = new Map()

function normalizeLanguage(language) {
  const value = String(language || '').toLowerCase()
  return LANGUAGES.includes(value) ? value : 'en'
}

function loadPack(language) {
  const lang = normalizeLanguage(language)
  if (cache.has(lang)) return cache.get(lang)

  const file = path.join(PACK_DIR, lang, 'validation.json')
  if (!fs.existsSync(file)) {
    throw new Error(`Missing validation language pack: ${file}`)
  }

  const pack = JSON.parse(fs.readFileSync(file, 'utf8'))
  pack.language = lang
  cache.set(lang, pack)
  return pack
}

function loadAllPacks() {
  return LANGUAGES.map(language => loadPack(language))
}

function resolveLang(language, rootDir = process.cwd()) {
  return normalizeLanguage(language || resolveLanguage(rootDir))
}

function getTicketSections(language, rootDir) {
  return loadPack(resolveLang(language, rootDir)).ticketSections
}

function getLegacyTicketSections() {
  return [...new Set(loadAllPacks().flatMap(pack => Object.values(pack.ticketSections)))]
}

function getRequiredTicketSections(language, rootDir) {
  const sections = getTicketSections(language, rootDir)
  return [sections.context, sections.requirements, sections.architecture]
}

function getLegacyRequiredSections() {
  return [
    ...new Set(
      loadAllPacks().flatMap(pack => [
        pack.ticketSections.context,
        pack.ticketSections.requirements,
        pack.ticketSections.architecture
      ])
    )
  ]
}

function getApiPatterns(language, rootDir) {
  return loadPack(resolveLang(language, rootDir)).apiRequirementPatterns
}

function getAllApiPatterns() {
  return [...new Set(loadAllPacks().flatMap(pack => pack.apiRequirementPatterns))]
}

function getDeliveryConfig(language, rootDir) {
  const pack = loadPack(resolveLang(language, rootDir))
  return {
    section: pack.ticketSections.delivery,
    fields: pack.deliveryFields
  }
}

function getSecurityControls(language, rootDir) {
  return loadPack(resolveLang(language, rootDir)).securityControls
}

module.exports = {
  PACK_DIR,
  getAllApiPatterns,
  getApiPatterns,
  getDeliveryConfig,
  getLegacyRequiredSections,
  getLegacyTicketSections,
  getRequiredTicketSections,
  getSecurityControls,
  getTicketSections,
  loadAllPacks,
  loadPack,
  normalizeLanguage
}
