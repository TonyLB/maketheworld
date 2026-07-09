import { lexicalRelevance } from '../lexicalRelevance'
import {
    T_JOINT_ABS,
    T_JOINT_MARGIN,
    type RelevanceNormalizationParams,
} from '../thresholds'
import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'

const ADJOINED_WEIGHTS = [1.0, 1.5, 2.0, 2.5, 3.0] as const
const REMOTE_WEIGHTS = [0.4, 0.6, 0.8, 0.9, 1.0] as const

export type FlankWeightSweepRow = {
    lexAdjoinedFlankWeight: number
    lexRemoteFlankWeight: number
    aAxe: number
    gemStones: number
    gemMinusA: number
    rustyAx: number
    axle: number
    rustyMinusAxle: number
    axolotl: number
    coaxial: number
    broom: number
    identityOk: boolean
    paraphraseJoint: number
    paraphraseMargin: number
}

const identityOrderingHolds = (params: RelevanceNormalizationParams): boolean => {
    const rows = simulateEmbeddingIdentityCorpus(params)
    const paraphrase = rows.find((row) => row.caseId === 'identity-003-broom-paraphrase')
    const absent = rows.find((row) => row.caseId === 'identity-001-absent-sword')
    const unary = rows.find((row) => row.caseId === 'identity-002-unary-trap')
    if (!paraphrase || !absent || !unary) {
        return false
    }
    return (
        paraphrase.topJointRelevance > absent.topJointRelevance
        && paraphrase.topJointRelevance > unary.topJointRelevance
        && unary.topJointRelevance < T_JOINT_ABS
        && paraphrase.topJointRelevance >= T_JOINT_ABS
        && paraphrase.topMargin >= T_JOINT_MARGIN
    )
}

export const scoreFlankWeightSweepRow = (
    lexAdjoinedFlankWeight: number,
    lexRemoteFlankWeight: number
): FlankWeightSweepRow => {
    const params: RelevanceNormalizationParams = {
        lexAdjoinedFlankWeight,
        lexRemoteFlankWeight,
    }
    const aAxe = lexicalRelevance('a', 'axe', params)
    const gemStones = lexicalRelevance('gem', 'gemstones', params)
    const rustyAx = lexicalRelevance('ax', 'rusty ax', params)
    const axle = lexicalRelevance('ax', 'axle', params)
    const axolotl = lexicalRelevance('ax', 'axolotl', params)
    const coaxial = lexicalRelevance('ax', 'coaxial', params)
    const broom = lexicalRelevance('broom', 'broom', params)
    const paraphrase = simulateEmbeddingIdentityCorpus(params).find(
        (row) => row.caseId === 'identity-003-broom-paraphrase'
    )
    const identityOk = identityOrderingHolds(params)

    return {
        lexAdjoinedFlankWeight,
        lexRemoteFlankWeight,
        aAxe,
        gemStones,
        gemMinusA: gemStones - aAxe,
        rustyAx,
        axle,
        rustyMinusAxle: rustyAx - axle,
        axolotl,
        coaxial,
        broom,
        identityOk,
        paraphraseJoint: paraphrase?.topJointRelevance ?? 0,
        paraphraseMargin: paraphrase?.topMargin ?? 0,
    }
}

export const runFlankWeightSweep = (): FlankWeightSweepRow[] => (
    ADJOINED_WEIGHTS.flatMap((lexAdjoinedFlankWeight) =>
        REMOTE_WEIGHTS.map((lexRemoteFlankWeight) =>
            scoreFlankWeightSweepRow(lexAdjoinedFlankWeight, lexRemoteFlankWeight)
        )
    )
)

const rowPassesInvariants = (row: FlankWeightSweepRow): boolean => (
    row.identityOk
    && row.axolotl > row.coaxial
    && row.gemMinusA > 0
    && row.broom > 0.97
)

export const pickBestFlankWeightSweepRow = (
    rows: readonly FlankWeightSweepRow[] = runFlankWeightSweep()
): FlankWeightSweepRow | undefined => {
    const eligible = rows.filter(rowPassesInvariants)
    if (eligible.length === 0) {
        return undefined
    }
    return eligible.sort((left, right) => {
        const leftScore = left.rustyMinusAxle * 3 + left.gemMinusA * 2 - left.aAxe
        const rightScore = right.rustyMinusAxle * 3 + right.gemMinusA * 2 - right.aAxe
        return rightScore - leftScore
    })[0]
}
