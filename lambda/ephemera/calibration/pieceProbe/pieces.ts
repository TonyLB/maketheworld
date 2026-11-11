import type { RegisteredPiece } from './oraclePiece'
import { registeredPlayByPlay } from '../imaginationPieces/playByPlay'
import { registeredRuleCell } from '../oraclePieces/ruleCell'

/** The pieces the probe can run, by name. */
export const pieces: Record<string, RegisteredPiece> = { ruleCell: registeredRuleCell, playByPlay: registeredPlayByPlay }
