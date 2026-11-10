import type { OraclePiece } from './oraclePiece'
import { registeredRuleCell } from './ruleCell'

/** The pieces the probe can run, by name. */
export const oraclePieces: Record<string, OraclePiece> = { ruleCell: registeredRuleCell }
