import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'
import {
    compareAllAdmissibilityArms,
    evaluateAdmissibilityRetirement,
} from './compareAdmissibilityArms'
import { lexicalRelevance } from '../lexicalRelevance'
import { T_JOINT_ABS, T_JOINT_MARGIN } from '../thresholds'

describe('compareAdmissibilityArms', () => {
    it('identity corpus ranking is unchanged between admissibility on and alwaysActive', () => {
        const verdict = evaluateAdmissibilityRetirement()
        const identityRegressions = verdict.comparisons
            .filter((entry) => entry.kind === 'identity-corpus' && entry.identityRankingRegression)
            .map((entry) => entry.caseId)
        expect(identityRegressions).toEqual([])
    })

    it('ax/axolotl ranks above ax/coaxial on lexical relevance', () => {
        const axolotl = lexicalRelevance('ax', 'axolotl')
        const coaxial = lexicalRelevance('ax', 'coaxial')
        expect(axolotl).toBeGreaterThan(coaxial)
    })

    it('short-span fixtures show spurious high lex without admissibility gate', () => {
        const verdict = evaluateAdmissibilityRetirement()
        expect(verdict.shortSpanRegressions).toEqual(
            expect.arrayContaining([
                'short-lex-001-length-1-a',
                'short-lex-002-ax-axe-only',
                'short-pool-001-length-1-a',
                'short-pool-002-ax-axe-only',
            ])
        )
    })

    it('admissibility retirement A/B fails --- gate required for length-1/2 spurious lex', () => {
        const verdict = evaluateAdmissibilityRetirement(compareAllAdmissibilityArms())
        expect(verdict.pass).toBe(false)
        expect(verdict.identityRankingRegressions).toEqual([])
    })
})

describe('simulateEmbeddingIdentityCorpus locked invariants', () => {
    it('returns one pool-metrics row per identity corpus case', () => {
        const results = simulateEmbeddingIdentityCorpus()
        expect(results).toHaveLength(6)
    })

    it('keeps absent-object head below paraphrase head on joint relevance', () => {
        const rows = simulateEmbeddingIdentityCorpus()
        const absent = rows.find((row) => row.caseId === 'identity-001-absent-sword')
        const paraphrase = rows.find((row) => row.caseId === 'identity-003-broom-paraphrase')
        expect(absent!.topJointRelevance).toBeLessThan(paraphrase!.topJointRelevance)
    })

    it('keeps unary-trap and absent heads below T_JOINT_ABS', () => {
        const rows = simulateEmbeddingIdentityCorpus()
        for (const caseId of ['identity-001-absent-sword', 'identity-002-unary-trap']) {
            const row = rows.find((entry) => entry.caseId === caseId)
            expect(row!.topJointRelevance).toBeLessThan(T_JOINT_ABS)
        }
    })

    it('paraphrase head clears T_JOINT_ABS with margin above T_JOINT_MARGIN', () => {
        const paraphrase = simulateEmbeddingIdentityCorpus().find(
            (row) => row.caseId === 'identity-003-broom-paraphrase'
        )
        expect(paraphrase!.topJointRelevance).toBeGreaterThanOrEqual(T_JOINT_ABS)
        expect(paraphrase!.topMargin).toBeGreaterThanOrEqual(T_JOINT_MARGIN)
    })

    it('duplicate shortName keeps thin margin below T_JOINT_MARGIN', () => {
        const duplicate = simulateEmbeddingIdentityCorpus().find(
            (row) => row.caseId === 'identity-004-duplicate-shortname'
        )
        expect(duplicate!.topMargin).toBeLessThan(T_JOINT_MARGIN)
    })
})
