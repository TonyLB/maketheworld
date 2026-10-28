import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStageOverReferenceKeys, runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import { resolvePureSpanToPool } from './resolvePureSpanToPool'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { ParseSkeleton } from './parse/parseToken'

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
const duplicateBroomId = 'OBJECT#BroomDup' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStageOverSkeleton', () => {
    it('keys a single objectSpan token by its stableRefKey', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'pick up the' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'pick up the broom',
            skeleton,
            { objects: roomCatalog, exits: [] }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(1)
        expect(result.spanPools.get('broomRef')).toEqual({
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
        })
    })

    it('keys two distinct spans (subject/target shape) by their own stableRefKeys, not position', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'anvil', stableRefKey: 'anvilRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'put broom on anvil',
            skeleton,
            { objects: roomCatalog, exits: [] }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(2)
        expect(result.spanPools.get('broomRef')?.candidates[0]?.id).toBe(broomId)
        expect(result.spanPools.get('anvilRef')?.candidates[0]?.id).toBe(anvilId)
    })

    it('preserves a multi-candidate pool intact under its own key, alongside a distinct single-candidate pool', async () => {
        const ambiguousCatalog: ObjectManipulationCatalogEntry[] = [
            ...roomCatalog,
            { objectId: duplicateBroomId, normalizedShortName: 'broom', catalogScope: 'held' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'anvil', stableRefKey: 'anvilRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'put broom on anvil',
            skeleton,
            { objects: ambiguousCatalog, exits: [] }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(2)
        expect(result.spanPools.get('broomRef')?.candidates).toHaveLength(2)
        expect(result.spanPools.get('broomRef')?.candidates.map((c) => c.id).sort()).toEqual(
            [broomId, duplicateBroomId].sort()
        )
        expect(result.spanPools.get('anvilRef')?.candidates).toHaveLength(1)
        expect(result.spanPools.get('anvilRef')?.candidates[0]?.id).toBe(anvilId)
    })

    it('resolves duplicate span text under distinct stableRefKeys independently ("put bench on bench")', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef1' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef2' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'put broom on broom',
            skeleton,
            { objects: roomCatalog, exits: [] }
        )

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(2)
        expect(result.spanPools.get('broomRef1')).toEqual(result.spanPools.get('broomRef2'))
        expect(result.spanPools.get('broomRef1')?.candidates[0]?.id).toBe(broomId)
    })

    it('produces no map entries for a skeleton with only text tokens', async () => {
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }]

        const result = await runIdentityStageOverSkeleton('look', skeleton, { objects: roomCatalog, exits: [] })

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(0)
        expect(mockGet).not.toHaveBeenCalled()
    })

    it('passes through runIdentityStage errors unchanged', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        const result = await runIdentityStageOverSkeleton('pick up broom', skeleton, { objects: [], exits: [] })

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })

    it('forwards deps to runIdentityStage unchanged', async () => {
        mockGet.mockResolvedValue({ success: false })
        const catalog: ObjectManipulationCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'sweeping tool', stableRefKey: 'sweepingToolRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'pick up the sweeping tool',
            skeleton,
            { objects: catalog, exits: [] }
        )

        expect(result.type).toBe('success')
        expect(mockGet).toHaveBeenCalled()
    })
})

describe('runIdentityStageOverReferenceKeys', () => {
    const skeleton: ParseSkeleton = [
        { type: 'text', text: 'put' },
        { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        { type: 'text', text: 'on' },
        { type: 'objectSpan', span: 'anvil', stableRefKey: 'anvilRef' },
    ]

    it('resolves exactly the referenced keys, in skeleton order', async () => {
        const result = await runIdentityStageOverReferenceKeys('put broom on anvil', skeleton, ['anvilRef', 'broomRef'], { objects: roomCatalog, exits: [] })

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect([...result.spanPools.keys()]).toEqual(['broomRef', 'anvilRef'])
    })

    it('throws when a referenced key is not an objectSpan token in the skeleton', async () => {
        await expect(
            runIdentityStageOverReferenceKeys('put broom on anvil', skeleton, ['missingRef'], { objects: roomCatalog, exits: [] })
        ).rejects.toThrow('"missingRef" is not an objectSpan token')
    })
})

describe('runIdentityStageOverSkeleton with a resolver', () => {
    it('omits a declined span\'s keys from the pools and lists them as ineligible', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'objectSpan', span: 'zebra', stableRefKey: 'zebraRef' },
            { type: 'objectSpan', span: 'zebra', stableRefKey: 'zebraRef2' },
        ]
        const resolver = async (span: string) => (
            span === 'broom'
                ? { type: 'pool' as const, pool: { span, candidates: [] } }
                : { type: 'ineligible' as const }
        )

        const result = await runIdentityStageOverSkeleton('x', skeleton, { objects: roomCatalog, exits: [] }, resolver)

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect([...result.spanPools.keys()]).toEqual(['broomRef'])
        expect(result.ineligible).toEqual(['zebraRef', 'zebraRef2'])
    })
})

describe('runIdentityStageOverSkeleton with the pure resolver', () => {
    it('pools exact and subsequence spans without embedding, and lists the rest as ineligible', async () => {
        const catalog: ObjectManipulationCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'old broom', catalogScope: 'room' },
            { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'anvil', stableRefKey: 'anvilRef' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'objectSpan', span: 'zebra', stableRefKey: 'zebraRef' },
        ]

        const result = await runIdentityStageOverSkeleton('x', skeleton, { objects: catalog, exits: [] }, resolvePureSpanToPool)

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect([...result.spanPools.keys()]).toEqual(['anvilRef', 'broomRef'])
        expect(result.spanPools.get('anvilRef')?.candidates[0].sourceTags).toEqual(['exact'])
        expect(result.spanPools.get('broomRef')?.candidates.map(({ id, sourceTags }) => ({ id, sourceTags })))
            .toEqual([{ id: broomId, sourceTags: ['lexical'] }])
        expect(result.ineligible).toEqual(['zebraRef'])
        expect(mockGet).not.toHaveBeenCalled()
    })
})
