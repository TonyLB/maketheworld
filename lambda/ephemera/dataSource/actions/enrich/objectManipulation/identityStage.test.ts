import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStage } from './identityStage'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { isSpanCandidatePool } from './spanResolution'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStage', () => {
    it('emits exact pool without embed', async () => {
        const embedSpan = jest.fn()

        const result = await runIdentityStage(
            'pick up the broom',
            ['broom'],
            roomCatalog,
            { embedSpan }
        )

        expect(result).toEqual({
            type: 'success',
            spanPools: [{
                span: 'broom',
                candidates: [{
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    marginToRunnerUp: 0,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                }],
                shortlist: [{
                    id: broomId,
                    label: 'broom',
                    jointRelevance: 1,
                    marginToRunnerUp: 0,
                    sourceTags: ['exact'],
                    locus: { kind: 'room' },
                }],
            }],
        })
        expect(embedSpan).not.toHaveBeenCalled()
        if (result.type === 'success') {
            expect(isSpanCandidatePool(result.spanPools[0])).toBe(true)
        }
    })

    it('emits ranked pool on paraphrase without identity LLM', async () => {
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
        const catalog: ObjectManipulationCatalogEntry[] = candidates.map((candidate, index) => ({
            objectId: index === 0 ? broomId : anvilId,
            normalizedShortName: candidate.normalizedShortName,
            catalogScope: 'room' as const,
            embedding: candidate.embedding,
        }))

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools).toHaveLength(1)
        expect(result.spanPools[0]?.candidates[0]?.id).toBe(broomId)
        expect(embedSpan).toHaveBeenCalled()
    })

    it('emits pool on absent-object span (no identity LLM)', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-absent',
                bucket: 'absent-object',
                span: 'sword',
                catalog: ['broom', 'anvil'],
            },
            { kind: 'orthogonal-to-catalog' }
        )
        const catalog: ObjectManipulationCatalogEntry[] = candidates.map((candidate, index) => ({
            objectId: index === 0 ? broomId : anvilId,
            normalizedShortName: candidate.normalizedShortName,
            catalogScope: 'room' as const,
            embedding: candidate.embedding,
        }))

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sword',
            ['sword'],
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools[0]?.candidates.length).toBeGreaterThan(0)
    })

    it('emits lex-only pool on embed invoke failure', async () => {
        const catalog: ObjectManipulationCatalogEntry[] = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room',
            embedding: makeEmbeddingFromAxis(1),
        }]
        const embedSpan = jest.fn().mockResolvedValue({ success: false })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools[0]?.candidates.length).toBe(1)
    })

    it('returns noCatalog error when catalog is empty and span does not match', async () => {
        const result = await runIdentityStage('pick up broom', ['broom'], [])

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })
})
