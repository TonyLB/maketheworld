import { lexicalRelevance } from '../lexicalRelevance'
import type { RelevanceNormalizationParams } from '../thresholds'
import { T_JOINT_ABS } from '../thresholds'
import { evaluateAdmissibilityRetirement } from './compareAdmissibilityArms'
import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'

const COVERAGE_SCALES = [3, 4, 5] as const
const ADJOINED_DAMP_SCALES = [2, 3] as const
const ADJOINED_FLANK_SCALES = [1.0, 1.5] as const

const identityJointOrderingHolds = (): boolean => {
    const rows = simulateEmbeddingIdentityCorpus()
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
    )
}

const shortSpanInvariantsHold = (params: RelevanceNormalizationParams): boolean => {
    const axolotl = lexicalRelevance('ax', 'axolotl', params)
    const coaxial = lexicalRelevance('ax', 'coaxial', params)
    const exactBroom = lexicalRelevance('broom', 'broom', params)
    const aAxe = lexicalRelevance('a', 'axe', params)
    const gemStones = lexicalRelevance('gem', 'gemstones', params)
    const rustyAx = lexicalRelevance('ax', 'rusty ax', params)
    const axle = lexicalRelevance('ax', 'axle', params)
    return (
        axolotl > coaxial
        && exactBroom > 0.97
        && gemStones > aAxe
        && rustyAx > axle
    )
}

describe('FT-1.3.2 / FT-1.3.3 sensitivity bounds around locked constants', () => {
    it('locked constants preserve identity corpus joint ordering', () => {
        expect(identityJointOrderingHolds()).toBe(true)
    })

    it('locked constants preserve short-span + proportionate-coverage invariants', () => {
        expect(shortSpanInvariantsHold({})).toBe(true)
    })

    it.each(
        COVERAGE_SCALES.flatMap((lexBiasCoverageScale) =>
            ADJOINED_DAMP_SCALES.map((lexAdjoinedPosDampScale) => ({
                lexBiasCoverageScale,
                lexAdjoinedPosDampScale,
            }))
        )
    )(
        'coverage=$lexBiasCoverageScale adjoinedDamp=$lexAdjoinedPosDampScale keeps invariants',
        (params) => {
            expect(identityJointOrderingHolds()).toBe(true)
            expect(shortSpanInvariantsHold(params)).toBe(true)
        }
    )

    it.each(ADJOINED_FLANK_SCALES)(
        'ratio-invariant adjoined scale=%s keeps invariants',
        (lexAdjoinedFlankScale) => {
            expect(identityJointOrderingHolds()).toBe(true)
            expect(shortSpanInvariantsHold({ lexAdjoinedFlankScale })).toBe(true)
        }
    )

    it('diverse-catalog length-1 regression remains; unary shorthand excluded from spurious bound', () => {
        const verdict = evaluateAdmissibilityRetirement()
        expect(verdict.shortSpanRegressions).toEqual(
            expect.arrayContaining(['short-lex-001-length-1-a', 'short-pool-001-length-1-a'])
        )
        expect(verdict.shortSpanRegressions).not.toContain('short-lex-005-unary-a-axe-shorthand')
    })

    it('full retirement still fails on expectTopLexBelow 0.35 bound (a/axe lex clears T_JOINT_ABS only)', () => {
        const verdict = evaluateAdmissibilityRetirement()
        expect(verdict.pass).toBe(false)
        expect(verdict.identityRankingRegressions).toEqual([])
        expect(verdict.shortSpanRegressions).not.toContain('short-lex-005-unary-a-axe-shorthand')
    })
})
