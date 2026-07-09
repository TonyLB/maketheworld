import { embedRelevance } from '../embedRelevance'
import { lexicalRelevance } from '../lexicalRelevance'
import { weightedRmsJointRelevance } from '../relevanceCombine'
import {
    C_MIN,
    JOINT_RELEVANCE_W_E,
    JOINT_RELEVANCE_W_L,
    T_JOINT_ABS,
} from '../thresholds'
import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'

describe('FT-1.3 mocked calibration sweep', () => {
    it('c_min 0.05 spreads paraphrase embed relevance above absent-object band', () => {
        const paraphraseEmbed = embedRelevance(0.158, { cMin: C_MIN })
        const absentEmbed = embedRelevance(0.253, { cMin: C_MIN })
        expect(paraphraseEmbed).toBeGreaterThan(0.35)
        expect(absentEmbed).toBeGreaterThan(paraphraseEmbed)
    })

    it('c_min 0.08 does not invert paraphrase vs absent ordering', () => {
        const paraphrase05 = embedRelevance(0.158, { cMin: 0.05 })
        const absent05 = embedRelevance(0.253, { cMin: 0.05 })
        const paraphrase08 = embedRelevance(0.158, { cMin: 0.08 })
        const absent08 = embedRelevance(0.253, { cMin: 0.08 })
        expect(paraphrase05).toBeLessThan(absent05)
        expect(paraphrase08).toBeLessThan(absent08)
    })

    it('locked w_l/w_e preserve identity corpus bucket ordering on joint relevance', () => {
        const rows = simulateEmbeddingIdentityCorpus()
        const paraphrase = rows.find((row) => row.caseId === 'identity-003-broom-paraphrase')
        const absent = rows.find((row) => row.caseId === 'identity-001-absent-sword')
        const unary = rows.find((row) => row.caseId === 'identity-002-unary-trap')
        expect(paraphrase!.topJointRelevance).toBeGreaterThan(absent!.topJointRelevance)
        expect(paraphrase!.topJointRelevance).toBeGreaterThan(unary!.topJointRelevance)
        expect(unary!.topJointRelevance).toBeLessThan(T_JOINT_ABS)
    })

    it('paraphrase token-free span keeps lexical below exact shortName match', () => {
        const exact = lexicalRelevance('broom', 'broom')
        const paraphrase = lexicalRelevance('sweeping tool', 'broom')
        expect(paraphrase).toBeLessThan(exact)
        expect(paraphrase).toBeLessThan(0.5)
    })

    it('equal RMS weights match explicit w_l/w_e params', () => {
        const joint = weightedRmsJointRelevance({ lex: 0.6, embed: 0.4 })
        const explicit = weightedRmsJointRelevance(
            { lex: 0.6, embed: 0.4 },
            { jointRelevanceWL: JOINT_RELEVANCE_W_L, jointRelevanceWE: JOINT_RELEVANCE_W_E }
        )
        expect(joint).toBe(explicit)
    })
})
