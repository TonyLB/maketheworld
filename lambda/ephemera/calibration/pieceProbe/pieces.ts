import type { RegistryEntry } from './oraclePiece'
import { registeredConsequences } from '../imaginationPieces/consequences'
import { registeredPlayByPlay } from '../imaginationPieces/playByPlay'
import { registeredNonRuleCell } from '../oraclePieces/nonRuleCell'
import { registeredRuleCell } from '../oraclePieces/ruleCell'
import { registeredSceneReading } from '../oraclePieces/sceneReading'
import { registeredStepConsiderations } from '../oraclePieces/stepConsiderations'
import { registeredTrial } from '../oraclePieces/trial'

/** The pieces the probe can run, by name, and the families of them (the trial). `sceneReading` is the trial question plan's step 0 probe. */
export const pieces: Record<string, RegistryEntry> = {
    ruleCell: registeredRuleCell, nonRuleCell: registeredNonRuleCell, playByPlay: registeredPlayByPlay, consequences: registeredConsequences,
    stepConsiderations: registeredStepConsiderations, trial: registeredTrial, sceneReading: registeredSceneReading,
}
