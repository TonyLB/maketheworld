import type { RegisteredPiece } from './oraclePiece'
import { registeredPlayByPlay } from './playByPlay'
import { registeredRuleCell } from './ruleCell'

/** The pieces the probe can run, by name. */
export const oraclePieces: Record<string, RegisteredPiece> = { ruleCell: registeredRuleCell, playByPlay: registeredPlayByPlay }
