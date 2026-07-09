import { lexicalRelevance } from '../lexicalRelevance'
import {
    LEX_FLANK_COMBINE_BIAS,
    T_JOINT_ABS,
    T_JOINT_MARGIN,
    type RelevanceNormalizationParams,
} from '../thresholds'
import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'

/** biasMax (LEX_FLANK_COMBINE_BIAS) sweep grid. */
export const BIAS_MAX_VALUES = [2.6, 2.0, 1.5, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0] as const

/** Mirror morphology control: lexical must not prefer gem over don. */
export const MORPHOLOGY_SYMMETRY_EPSILON = 1e-9

export type FlankCombineBiasSweepRow = {
    lexFlankCombineBias: number
    aAxe: number
    gemStones: number
    donWimbledon: number
    gemDonLexDelta: number
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

export const scoreFlankCombineBiasSweepRow = (
    lexFlankCombineBias: number
): FlankCombineBiasSweepRow => {
    const params: RelevanceNormalizationParams = { lexFlankCombineBias }
    const aAxe = lexicalRelevance('a', 'axe', params)
    const gemStones = lexicalRelevance('gem', 'gemstones', params)
    const donWimbledon = lexicalRelevance('don', 'wimbledon', params)
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
        lexFlankCombineBias,
        aAxe,
        gemStones,
        donWimbledon,
        gemDonLexDelta: gemStones - donWimbledon,
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

export const runFlankCombineBiasSweep = (): FlankCombineBiasSweepRow[] => (
    BIAS_MAX_VALUES.map((lexFlankCombineBias) => scoreFlankCombineBiasSweepRow(lexFlankCombineBias))
)

export const rowPassesBiasSweepInvariants = (row: FlankCombineBiasSweepRow): boolean => (
    row.identityOk
    && row.axolotl > row.coaxial
    && row.gemMinusA > 0
    && row.rustyMinusAxle > 0
    && Math.abs(row.gemDonLexDelta) <= MORPHOLOGY_SYMMETRY_EPSILON
    && row.broom > 0.85
)

export const pickBestFlankCombineBiasSweepRow = (
    rows: readonly FlankCombineBiasSweepRow[] = runFlankCombineBiasSweep()
): FlankCombineBiasSweepRow | undefined => {
    const eligible = rows.filter(
        (row) => rowPassesBiasSweepInvariants(row) && row.aAxe < T_JOINT_ABS
    )
    if (eligible.length === 0) {
        return undefined
    }
    // Highest biasMax that still suppresses spurious a/axe below T_JOINT_ABS (Pareto).
    return eligible.sort((left, right) => right.lexFlankCombineBias - left.lexFlankCombineBias)[0]
}
