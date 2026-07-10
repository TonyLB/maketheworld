import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { resolveCatalogSpanToPool } from './resolveCatalogSpanToPool'
import { isSpanCandidatePool } from './spanResolution'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const duplicateId = 'OBJECT#BroomDup' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('resolveCatalogSpanToPool', () => {
    it('builds exact single-candidate pool without embed', async () => {
        const embedSpan = jest.fn()
        const result = await resolveCatalogSpanToPool('broom', roomCatalog, { embedSpan })

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(isSpanCandidatePool(result.pool)).toBe(true)
        expect(result.pool).toMatchObject({
            span: 'broom',
            candidates: [{
                id: broomId,
                label: 'broom',
                jointRelevance: 1,
                sourceTags: ['exact'],
                locus: { kind: 'room' },
            }],
        })
        expect(embedSpan).not.toHaveBeenCalled()
    })

    it('builds ambiguous exact pool with multiple candidates', async () => {
        const ambiguousCatalog: ObjectManipulationCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
            { objectId: duplicateId, normalizedShortName: 'broom', catalogScope: 'held' },
        ]

        const result = await resolveCatalogSpanToPool('broom', ambiguousCatalog)

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(result.pool.candidates).toHaveLength(2)
        expect(result.pool.candidates.every((c) => c.sourceTags.includes('exact'))).toBe(true)
        expect(result.pool.candidates.map((c) => c.locus)).toEqual([
            { kind: 'room' },
            { kind: 'heldByActor' },
        ])
    })

    it('returns noCatalog error for empty catalog', async () => {
        const result = await resolveCatalogSpanToPool('broom', [])
        expect(result).toEqual({
            type: 'error',
            errorMessage: 'ObjectManipulation resolution failed: no in-room object catalog',
        })
    })

    it('builds ranked pool on NoMatch with span embedding', async () => {
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

        const result = await resolveCatalogSpanToPool('sweeping tool', catalog, { embedSpan })

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(embedSpan).toHaveBeenCalled()
        expect(result.pool.candidates[0]?.id).toBe(broomId)
        expect(result.pool.candidates.length).toBe(2)
    })

    it('still emits lex-only pool when embed invoke fails', async () => {
        const catalog: ObjectManipulationCatalogEntry[] = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room',
            embedding: makeEmbeddingFromAxis(1),
        }]
        const embedSpan = jest.fn().mockResolvedValue({ success: false })

        const result = await resolveCatalogSpanToPool('sweeping tool', catalog, { embedSpan })

        expect(result.type).toBe('pool')
        if (result.type !== 'pool') {
            return
        }
        expect(result.pool.candidates.length).toBeGreaterThan(0)
    })
})
