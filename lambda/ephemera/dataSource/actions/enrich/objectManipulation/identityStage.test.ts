import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStage } from './identityStage'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { isSpanCandidatePool } from './spanResolution'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    buildCandidatesFromIdentityCase,
    makeEmbeddingFromAxis,
} from './embeddingMatch/testing/mockVectors'

import internalCache from '../../../../internalCache'

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: { SpanEmbeddings: { get: jest.fn() } },
}))

const mockGet = internalCache.SpanEmbeddings.get as jest.Mock

beforeEach(() => {
    mockGet.mockReset()
})

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStage', () => {
    it('emits exact pool without embed', async () => {

        const result = await runIdentityStage(
            'pick up the broom',
            ['broom'],
            roomCatalog
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
            ineligible: [],
        })
        expect(mockGet).not.toHaveBeenCalled()
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

        mockGet.mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools).toHaveLength(1)
        expect(result.spanPools[0]?.candidates[0]?.id).toBe(broomId)
        expect(mockGet).toHaveBeenCalled()
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

        mockGet.mockResolvedValue({
            success: true,
            embedding: spanEmbedding,
        })

        const result = await runIdentityStage(
            'pick up the sword',
            ['sword'],
            catalog
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
        mockGet.mockResolvedValue({ success: false })

        const result = await runIdentityStage(
            'pick up the sweeping tool',
            ['sweeping tool'],
            catalog
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools[0]?.candidates.length).toBe(1)
    })

    describe('concurrency', () => {
        const deferred = <T,>() => {
            let resolve!: (value: T) => void
            const promise = new Promise<T>((res) => { resolve = res })
            return { promise, resolve }
        }
        const embeddedCatalog: ObjectManipulationCatalogEntry[] = [{
            objectId: broomId,
            normalizedShortName: 'broom',
            catalogScope: 'room',
            embedding: makeEmbeddingFromAxis(1),
        }]

        it('starts every span\'s embed before any settles', async () => {
            const held = new Map([['mop', deferred<{ success: false }>()], ['rag', deferred<{ success: false }>()]])
            mockGet.mockImplementation((span: string) => held.get(span)!.promise)

            const pending = runIdentityStage('x', ['mop', 'rag'], embeddedCatalog)
            await Promise.resolve()
            await Promise.resolve()

            expect(mockGet.mock.calls.map(([span]) => span)).toEqual(['mop', 'rag'])
            held.forEach(({ resolve }) => resolve({ success: false }))
            await expect(pending).resolves.toMatchObject({ type: 'success' })
        })

        it('returns pools in span order when embeds settle out of order', async () => {
            const held = new Map([['mop', deferred<{ success: false }>()], ['rag', deferred<{ success: false }>()]])
            mockGet.mockImplementation((span: string) => held.get(span)!.promise)

            const pending = runIdentityStage('x', ['mop', 'rag'], embeddedCatalog)
            held.get('rag')!.resolve({ success: false })
            held.get('mop')!.resolve({ success: false })
            const result = await pending

            expect(result.type).toBe('success')
            if (result.type === 'success') {
                expect(result.spanPools.map(({ span }) => span)).toEqual(['mop', 'rag'])
            }
        })
    })

    it('returns noCatalog error when catalog is empty and span does not match', async () => {
        const result = await runIdentityStage('pick up broom', ['broom'], [])

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })

    it('uses the given resolver, reporting declined spans beside the pools', async () => {
        const resolver = jest.fn(async (span: string, catalog: readonly ObjectManipulationCatalogEntry[]) => (
            span === 'broom'
                ? { type: 'pool' as const, pool: { span, candidates: [] } }
                : { type: 'ineligible' as const }
        ))

        const result = await runIdentityStage('x', ['broom', 'zebra'], roomCatalog, new Map(), resolver)

        expect(result).toEqual({ type: 'success', spanPools: [{ span: 'broom', candidates: [] }], ineligible: ['zebra'] })
        expect(mockGet).not.toHaveBeenCalled()
    })
})
