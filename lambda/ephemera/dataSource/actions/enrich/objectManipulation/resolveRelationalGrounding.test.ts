import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { resolveRelationalGrounding } from './resolveRelationalGrounding'
import { isSpanCandidatePool } from './spanResolution'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const tableId = 'OBJECT#Table' as EphemeraObjectId

describe('resolveRelationalGrounding', () => {
    it('emits subject and target pools from room catalog', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on table',
            'broom',
            'table',
            [
                { objectId: broomId, normalizedShortName: 'broom' },
                { objectId: tableId, normalizedShortName: 'table' },
            ]
        )

        expect(result.type).toBe('success')
        if (result.type === 'success') {
            expect(isSpanCandidatePool(result.subjectPool)).toBe(true)
            expect(isSpanCandidatePool(result.targetPool)).toBe(true)
            expect(result.subjectPool.candidates[0]!.id).toBe(broomId)
            expect(result.targetPool.candidates[0]!.id).toBe(tableId)
        }
    })

    it('emits pools for same-span subject/target (selection owns same-id error)', async () => {
        const result = await resolveRelationalGrounding(
            'put broom on broom',
            'broom',
            'broom',
            [{ objectId: broomId, normalizedShortName: 'broom' }]
        )

        expect(result.type).toBe('success')
        if (result.type === 'success') {
            expect(result.subjectPool.candidates[0]!.id).toBe(broomId)
            expect(result.targetPool.candidates[0]!.id).toBe(broomId)
        }
    })

    it('emits pools even when span is non-exact (selection owns auto-resolve)', async () => {
        const result = await resolveRelationalGrounding(
            'put thing on table',
            'thing',
            'table',
            [{ objectId: tableId, normalizedShortName: 'table' }]
        )

        expect(result.type).toBe('success')
        if (result.type === 'success') {
            expect(result.targetPool.candidates[0]!.id).toBe(tableId)
        }
    })

    it('builds paraphrase subject pool without identity LLM', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom', 'table'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )
        const catalog = candidates.map((candidate, index) => ({
            objectId: index === 0 ? broomId : tableId,
            normalizedShortName: candidate.normalizedShortName,
            embedding: candidate.embedding,
        }))

        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on table',
            'sweeping tool',
            'table',
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        if (result.type === 'success') {
            expect(result.subjectPool.candidates[0]!.id).toBe(broomId)
            expect(result.targetPool.candidates[0]!.id).toBe(tableId)
        }
        expect(embedSpan).toHaveBeenCalledTimes(1)
    })

    it('dedupes span embed across subject and target when both miss exact match', async () => {
        const { spanEmbedding, candidates } = buildCandidatesFromIdentityCase(
            {
                id: 'test-paraphrase-dedupe',
                bucket: 'positive-paraphrase',
                span: 'sweeping tool',
                catalog: ['broom'],
            },
            {
                kind: 'resolve-index',
                targetIndex: 0,
                targetSimilarity: 0.95,
                otherSimilarity: 0.5,
            }
        )
        const catalog = candidates.map((candidate) => ({
            objectId: broomId,
            normalizedShortName: candidate.normalizedShortName,
            embedding: candidate.embedding,
        }))
        const embedSpan = jest.fn().mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on sweeping tool',
            'sweeping tool',
            'Sweeping Tool',
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        expect(embedSpan).toHaveBeenCalledTimes(1)
    })

    it('still emits pools when embed invoke fails (lexical-only ranking)', async () => {
        const embedSpan = jest.fn().mockResolvedValue({ success: false })

        const result = await resolveRelationalGrounding(
            'put sweeping tool on table',
            'sweeping tool',
            'table',
            [
                {
                    objectId: broomId,
                    normalizedShortName: 'broom',
                    embedding: makeEmbeddingFromAxis(1),
                },
                { objectId: tableId, normalizedShortName: 'table' },
            ],
            { embedSpan }
        )

        expect(result.type).toBe('success')
        expect(embedSpan).toHaveBeenCalledTimes(1)
        if (result.type === 'success') {
            expect(result.targetPool.candidates[0]!.id).toBe(tableId)
        }
    })
})
