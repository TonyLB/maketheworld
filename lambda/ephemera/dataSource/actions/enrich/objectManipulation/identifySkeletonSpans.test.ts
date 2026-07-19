import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { runIdentityStageOverSkeleton } from './identifySkeletonSpans'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import type { ParseSkeleton } from './parse/parseToken'

const broomId = 'OBJECT#Broom' as EphemeraObjectId
const anvilId = 'OBJECT#Anvil' as EphemeraObjectId
const duplicateBroomId = 'OBJECT#BroomDup' as EphemeraObjectId

const roomCatalog: ObjectManipulationCatalogEntry[] = [
    { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
    { objectId: anvilId, normalizedShortName: 'anvil', catalogScope: 'room' },
]

describe('runIdentityStageOverSkeleton', () => {
    it('keys a single objectSpan token by its stableRefKey', async () => {
        const embedSpan = jest.fn()
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'pick up the' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'pick up the broom',
            skeleton,
            roomCatalog,
            { embedSpan }
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
        const embedSpan = jest.fn()
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'anvil', stableRefKey: 'anvilRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'put broom on anvil',
            skeleton,
            roomCatalog,
            { embedSpan }
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
        const embedSpan = jest.fn()
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
            ambiguousCatalog,
            { embedSpan }
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
        const embedSpan = jest.fn()
        const skeleton: ParseSkeleton = [
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef1' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef2' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'put broom on broom',
            skeleton,
            roomCatalog,
            { embedSpan }
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
        const embedSpan = jest.fn()
        const skeleton: ParseSkeleton = [{ type: 'text', text: 'look' }]

        const result = await runIdentityStageOverSkeleton('look', skeleton, roomCatalog, { embedSpan })

        expect(result.type).toBe('success')
        if (result.type !== 'success') {
            return
        }
        expect(result.spanPools.size).toBe(0)
        expect(embedSpan).not.toHaveBeenCalled()
    })

    it('passes through runIdentityStage errors unchanged', async () => {
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ]

        const result = await runIdentityStageOverSkeleton('pick up broom', skeleton, [])

        expect(result).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noCatalog,
        })
    })

    it('forwards deps to runIdentityStage unchanged', async () => {
        const embedSpan = jest.fn().mockResolvedValue({ success: false })
        const catalog: ObjectManipulationCatalogEntry[] = [
            { objectId: broomId, normalizedShortName: 'broom', catalogScope: 'room' },
        ]
        const skeleton: ParseSkeleton = [
            { type: 'objectSpan', span: 'sweeping tool', stableRefKey: 'sweepingToolRef' },
        ]

        const result = await runIdentityStageOverSkeleton(
            'pick up the sweeping tool',
            skeleton,
            catalog,
            { embedSpan }
        )

        expect(result.type).toBe('success')
        expect(embedSpan).toHaveBeenCalled()
    })
})
