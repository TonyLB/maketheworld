import { EMBEDDING_CALIBRATION_IDENTITY_CASES } from '../../../../../../calibration/objectMatch/corpus'

import { simulateEmbeddingIdentityCorpus } from './simulateEmbeddingIdentityCorpus'
import { buildCandidatesFromIdentityCase } from './mockVectors'
import { simulateEmbeddingIdentityWithPool } from '../simulateEmbeddingIdentity'

describe('simulateEmbeddingIdentityCorpus', () => {
    it('returns one pool-metrics row per identity corpus case', () => {
        const results = simulateEmbeddingIdentityCorpus()
        expect(results).toHaveLength(EMBEDDING_CALIBRATION_IDENTITY_CASES.length)
    })

    it('ranks broom first for paraphrase case on joint relevance', () => {
        const paraphrase = simulateEmbeddingIdentityCorpus().find(
            (row) => row.caseId === 'identity-003-broom-paraphrase'
        )
        expect(paraphrase).toBeDefined()
        expect(paraphrase!.topJointRelevance).toBeGreaterThan(0.2)
        expect(paraphrase!.shortlistSize).toBeGreaterThanOrEqual(1)
    })

    it('keeps absent-object head joint relevance below paraphrase head', () => {
        const rows = simulateEmbeddingIdentityCorpus()
        const absent = rows.find((row) => row.caseId === 'identity-001-absent-sword')
        const paraphrase = rows.find((row) => row.caseId === 'identity-003-broom-paraphrase')
        expect(absent).toBeDefined()
        expect(paraphrase).toBeDefined()
        expect(absent!.topJointRelevance).toBeLessThan(paraphrase!.topJointRelevance)
    })

    it('keeps unary-trap head joint relevance low', () => {
        const unary = simulateEmbeddingIdentityCorpus().find(
            (row) => row.caseId === 'identity-002-unary-trap'
        )
        expect(unary).toBeDefined()
        expect(unary!.topJointRelevance).toBeLessThan(0.5)
    })

    it('emits non-empty pool for duplicate shortName case', () => {
        const duplicate = simulateEmbeddingIdentityCorpus().find(
            (row) => row.caseId === 'identity-004-duplicate-shortname'
        )
        expect(duplicate).toBeDefined()
        expect(duplicate!.topJointRelevance).toBeGreaterThan(0)
        expect(duplicate!.topMargin).toBeLessThan(0.01)
    })
})

describe('simulateEmbeddingIdentityWithPool legacy parity', () => {
    it('preserves v1 resolve verdict for paraphrase corpus case', () => {
        const identityCase = EMBEDDING_CALIBRATION_IDENTITY_CASES.find(
            (row) => row.id === 'identity-003-broom-paraphrase'
        )!
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(identityCase, {
            kind: 'resolve-index',
            targetIndex: 0,
            targetSimilarity: 0.95,
            otherSimilarity: 0.5,
        })

        const simulation = simulateEmbeddingIdentityWithPool(
            spanEmbedding,
            candidates,
            identityCase.span
        )
        expect(simulation.legacyDecision).toMatchObject({ type: 'Resolved' })
        expect(simulation.pool.candidates[0]!.id).toBe(candidates[0]!.objectId)
    })
})
