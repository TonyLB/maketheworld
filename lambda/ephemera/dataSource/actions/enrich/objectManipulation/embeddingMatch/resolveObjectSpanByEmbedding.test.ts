import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { resolveObjectSpanByEmbedding } from './resolveObjectSpanByEmbedding'
import { createSpanEmbedCache } from './spanEmbedCache'
import { T_ABS, T_MARGIN } from './thresholds'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

describe('resolveObjectSpanByEmbedding', () => {
    it('resolves when embed and catalog vectors pass gates', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'anvil'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const decision = await resolveObjectSpanByEmbedding(
            'sweeping tool',
            candidates,
            { embedSpan }
        )

        expect(decision).toEqual({
            type: 'Resolved',
            objectId: candidates[0]!.objectId,
            catalogScope: 'room',
        })
        expect(embedSpan).toHaveBeenCalledTimes(1)
    })

    it('abstains with embed_invoke_failed when embed fails', async () => {
        const embedSpan = jest.fn().mockResolvedValue({ success: false })
        const candidates = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room' as const,
            embedding: makeEmbeddingFromAxis(1),
        }]

        const decision = await resolveObjectSpanByEmbedding(
            'sweeping tool',
            candidates,
            { embedSpan }
        )

        expect(decision).toEqual({ type: 'Abstain', reason: 'embed_invoke_failed' })
    })

    it('dedupes embed per normalized span across calls (EM-D7)', async () => {
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbeddingFromAxis(0),
        })
        const cache = createSpanEmbedCache()
        const candidates = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room' as const,
            embedding: makeEmbeddingFromAxis(1),
        }]

        await resolveObjectSpanByEmbedding('Sweeping Tool', candidates, { embedSpan, spanEmbedCache: cache })
        await resolveObjectSpanByEmbedding('sweeping tool', candidates, { embedSpan, spanEmbedCache: cache })

        expect(embedSpan).toHaveBeenCalledTimes(1)
    })

    it('abstains below_floor when vectors do not clear gates', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-absent',
                bucket: 'absent-object',
                span: 'sword',
                catalog: ['broom', 'anvil'],
            },
            {
                kind: 'below-multi-floor',
                similarities: [T_ABS - 0.03, T_ABS - 0.05],
            }
        )

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const decision = await resolveObjectSpanByEmbedding('sword', candidates, { embedSpan })

        expect(decision).toEqual({ type: 'Abstain', reason: 'below_floor' })
    })

    it('abstains ambiguous_margin when best clears floor but margin is insufficient', async () => {
        const bestSim = T_ABS + 0.11
        const secondSim = bestSim - (T_MARGIN - 0.001)
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-margin',
                bucket: 'absent-object',
                span: 'sword',
                catalog: ['broom', 'anvil', 'lantern'],
            },
            {
                kind: 'below-multi-floor',
                similarities: [secondSim, bestSim, T_ABS - 0.05],
            }
        )

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const decision = await resolveObjectSpanByEmbedding('sword', candidates, { embedSpan })

        expect(decision).toEqual({ type: 'Abstain', reason: 'ambiguous_margin' })
    })

    it('abstains no_eligible_embeddings when catalog has no vectors', async () => {
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: makeEmbeddingFromAxis(0),
        })

        const decision = await resolveObjectSpanByEmbedding(
            'sweeping tool',
            [{
                objectId: anvilId,
                normalizedShortName: 'anvil',
                catalogScope: 'room',
            }],
            { embedSpan }
        )

        expect(decision).toEqual({ type: 'Abstain', reason: 'no_eligible_embeddings' })
    })
})
