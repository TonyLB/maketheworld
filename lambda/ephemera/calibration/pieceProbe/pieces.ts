import type { RegisteredPiece } from './oraclePiece'
import { registeredConsequences } from '../imaginationPieces/consequences'
import { registeredPlayByPlay } from '../imaginationPieces/playByPlay'
import { registeredNonRuleCell } from '../oraclePieces/nonRuleCell'
import { registeredRuleCell } from '../oraclePieces/ruleCell'

/** The pieces the probe can run, by name. */
export const pieces: Record<string, RegisteredPiece> = {
    ruleCell: registeredRuleCell, nonRuleCell: registeredNonRuleCell, playByPlay: registeredPlayByPlay, consequences: registeredConsequences,
}
