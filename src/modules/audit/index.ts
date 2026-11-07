import { requireEnterpriseLicense, type LicenseInfo } from '../../middleware/auth'
import * as contractGuard from './contract-guard'
import * as deadCode from './dead-code'
import * as debtRadar from './debt-radar'
import * as securityScan from './security-scan'
import type { AuditOptions, AuditReport } from './types'

export const AUDIT_COMMANDS = [
  'dead-code',
  'debt-radar',
  'contract-guard',
  'security-scan'
] as const

export type AuditName = (typeof AUDIT_COMMANDS)[number]

export function isAuditName(value: string): value is AuditName {
  return (AUDIT_COMMANDS as readonly string[]).includes(value)
}

const RUNNERS: Record<AuditName, (options: AuditOptions) => AuditReport> = {
  'dead-code': deadCode.run,
  'debt-radar': debtRadar.run,
  'contract-guard': contractGuard.run,
  'security-scan': securityScan.run
}

export function runAudit(
  name: AuditName,
  options: AuditOptions = {}
): { report: AuditReport; license: LicenseInfo } {
  const license = requireEnterpriseLicense()
  const report = RUNNERS[name](options)
  return { report, license }
}
