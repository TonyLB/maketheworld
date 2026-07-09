import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'
import {
    compareAllAdmissibilityArms,
    evaluateAdmissibilityRetirement,
} from './compareAdmissibilityArms'
import { compareFlankCombineLegacyRows } from './compareFlankCombineLegacy'
import { buildShortSpanPoolVectors } from './mockVectors'
import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'
import { lexicalRelevance } from '../lexicalRelevance'
import { T_JOINT_ABS, T_JOINT_MARGIN } from '../thresholds'

describe('compareAdmissibilityArms', () => {
    it('identity corpus ranking is unchanged between legacy and alwaysActive', () => {
        const verdict = evaluateAdmissibilityRetirement()
        expect(verdict.identityRankingRegressions).toEqual([])
    })

    it('ax/axolotl ranks above ax/coaxial on lexical relevance', () => {
        const axolotl = lexicalRelevance('ax', 'axolotl')
        const coaxial = lexicalRelevance('ax', 'coaxial')
        expect(axolotl).toBeGreaterThan(coaxial)
    })

    it('FT-1.3.6 biasMax sweep lowers spurious a/axe lexical below T_JOINT_ABS', () => {
        const [row] = compareFlankCombineLegacyRows([{ span: 'a', shortName: 'axe' }])
        expect(row.mitigatedLex).toBeLessThan(row.legacyFlankScore)
        expect(row.mitigatedLex).toBeLessThan(T_JOINT_ABS)
    })

    it('gem/gemstones scores above a/axe at equal embed coverage (FT-1.3.3)', () => {
        expect(lexicalRelevance('gem', 'gemstones')).toBeGreaterThan(lexicalRelevance('a', 'axe'))
    })

    it('don/wimbledon is precisely symmetric with gem/gemstones (morphology guardrail)', () => {
        const gemLex = lexicalRelevance('gem', 'gemstones')
        const donLex = lexicalRelevance('don', 'wimbledon')
        expect(donLex).toBeCloseTo(gemLex, 9)
    })

    it('gate-off (alwaysActive) retirement harness passes with revised fixture intent', () => {
        const verdict = evaluateAdmissibilityRetirement(compareAllAdmissibilityArms())
        expect(verdict.pass).toBe(true)
        expect(verdict.identityRankingRegressions).toEqual([])
        expect(verdict.shortSpanRegressions).toEqual([])
    })

    it('ax/rusty axe shorthand clears T_JOINT_ABS under alwaysActive (success case)', () => {
        const { spanEmbedding, candidates } = buildShortSpanPoolVectors(
            ['rusty axe'],
            'OBJECT#short-pool-002',
            { kind: 'unary-below-floor', similarity: 0.11 }
        )
        const simulation = simulateEmbeddingIdentityWithPool(spanEmbedding, candidates, 'ax', {})
        expect(simulation.pool.candidates[0]!.label).toBe('rusty axe')
        expect(simulation.metrics.topJointRelevance).toBeGreaterThanOrEqual(T_JOINT_ABS)
    })

    it('diverse-catalog length-1 stays below T_JOINT_ABS under alwaysActive', () => {
        const row = evaluateAdmissibilityRetirement().comparisons.find(
            (entry) => entry.caseId === 'short-pool-001-length-1-a'
        )
        expect(row).toBeDefined()
        expect(row!.gateOff.topJointRelevance).toBeLessThan(T_JOINT_ABS)
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
