import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { isSpanCandidatePool } from '../spanResolution'

import { buildSpanCandidatePool } from './buildSpanCandidatePool'
import { T_ABS, T_ABS_UNARY } from './thresholds'
import type { EmbeddingMatchCandidate } from './types'
import {
    buildCandidatesFromIdentityCase,
    embeddingAtCosineSimilarity,
    makeEmbeddingFromAxis,
} from './testing/mockVectors'

const objectA = 'OBJECT#a' as EphemeraObjectId
const objectB = 'OBJECT#b' as EphemeraObjectId

const catalogEntry = (
    objectId: EphemeraObjectId,
    normalizedShortName: string,
    embedding?: ReturnType<typeof makeEmbeddingFromAxis>
): EmbeddingMatchCandidate => ({
    objectId,
    normalizedShortName,
    catalogScope: 'room',
    ...(embedding ? { embedding } : {}),
})

describe('buildSpanCandidatePool', () => {
    it('ranks every catalog entry with no admission floor', () => {
        const base = makeEmbeddingFromAxis(0)
        const candidates = [
            catalogEntry(objectA, 'broom', base),
            catalogEntry(objectB, 'anvil', makeEmbeddingFromAxis(1)),
            catalogEntry('OBJECT#c' as EphemeraObjectId, 'lantern'),
        ]
        const spanEmbedding = embeddingAtCosineSimilarity(base, T_ABS + 0.05)

        const pool = buildSpanCandidatePool('sword', candidates, { spanEmbedding })

        expect(pool.candidates).toHaveLength(3)
        expect(pool.shortlist).toBeDefined()
        expect(isSpanCandidatePool(pool)).toBe(true)
    })

    it('ranks paraphrase target above distractors on joint score', () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase-pool',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'anvil', 'lantern'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: T_ABS + 0.05,
                otherSimilarity: T_ABS - 0.06,
            }
        )

        const pool = buildSpanCandidatePool('sweeping tool', candidates, { spanEmbedding })
        expect(pool.candidates[0]!.id).toBe(candidates[0]!.objectId)
        expect(pool.candidates[0]!.jointRelevance).toBeGreaterThan(pool.candidates[1]!.jointRelevance)
    })

    it('omits lexRelevance when lexical channel is inactive for length-1 span', () => {
        const base = makeEmbeddingFromAxis(0)
        const candidates = [catalogEntry(objectA, 'axe', base)]
        const spanEmbedding = embeddingAtCosineSimilarity(base, 0.2)

        const pool = buildSpanCandidatePool('a', candidates, { spanEmbedding })
        expect(pool.candidates[0]!.lexRelevance).toBeUndefined()
        expect(pool.candidates[0]!.embedRelevance).toBeDefined()
    })

    it('omits lexRelevance for inadmissible short span against axe-only catalog', () => {
        const base = makeEmbeddingFromAxis(0)
        const candidates = [catalogEntry(objectA, 'rusty axe', base)]
        const spanEmbedding = embeddingAtCosineSimilarity(base, 0.2)

        const pool = buildSpanCandidatePool('ax', candidates, { spanEmbedding })
        expect(pool.candidates[0]!.lexRelevance).toBeUndefined()
    })

    it('assigns marginToRunnerUp on ranked candidates', () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-margin',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'anvil'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.9,
                otherSimilarity: 0.4,
            }
        )

        const pool = buildSpanCandidatePool('sweeping tool', candidates, { spanEmbedding })
        expect(pool.candidates[0]!.marginToRunnerUp).toBeGreaterThan(0)
        expect(pool.candidates[1]!.marginToRunnerUp).toBeUndefined()
    })

    it('keeps unary-trap head visible with low joint relevance', () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-unary',
                bucket: 'unary-trap',
                span: 'blade',
                catalog: ['ornate rapier'],
            },
            {
                kind: 'unary-below-floor',
                similarity: (T_ABS + T_ABS_UNARY) / 2,
            }
        )

        const pool = buildSpanCandidatePool('blade', candidates, { spanEmbedding })
        expect(pool.candidates).toHaveLength(1)
        expect(pool.candidates[0]!.jointRelevance).toBeLessThan(0.5)
    })
})
