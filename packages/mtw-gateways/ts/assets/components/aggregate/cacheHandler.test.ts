import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import {
    aggregatePerspectiveCacheKey,
    aggregatePerspectiveExplicit,
    ComponentAggregateMergedCache,
    createComponentAggregateCacheHandler,
    createComponentAggregateGateway,
} from './index'
import { inMemoryComponentAggregateInternalCacheSlice } from './testHarness'

describe('aggregatePerspectiveCacheKey', () => {
    const roomU = 'ROOM#r1' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const

    it('is stable for the same perspective', () => {
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        expect(aggregatePerspectiveCacheKey(p)).toEqual(aggregatePerspectiveCacheKey(p))
    })

    it('includes universalKey and computePerspectiveKey fragment', () => {
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        const k = aggregatePerspectiveCacheKey(p)
        expect(k.startsWith(`${roomU}::`)).toBe(true)
        expect(k).toContain(computePerspectiveKey([assetA, assetB]))
    })

    it('differs when merge participation order changes', () => {
        const a = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        const b = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetB, assetA],
        })
        expect(aggregatePerspectiveCacheKey(a)).not.toEqual(aggregatePerspectiveCacheKey(b))
    })

    it('differs when universalKey changes', () => {
        const a = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const b = aggregatePerspectiveExplicit({
            universalKey: 'ROOM#other' as typeof roomU,
            mergeParticipationOrder: [assetA],
        })
        expect(aggregatePerspectiveCacheKey(a)).not.toEqual(aggregatePerspectiveCacheKey(b))
    })

    it('ignores anchor for cache identity until assembly uses it', () => {
        const a = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
            anchorAssetId: assetA,
        })
        const b = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
            anchorAssetId: assetB,
        })
        expect(aggregatePerspectiveCacheKey(a)).toEqual(aggregatePerspectiveCacheKey(b))
    })
})

describe('ComponentAggregateMergedCache', () => {
    const roomU = 'ROOM#r1' as const
    const roomV = 'ROOM#v2' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const

    const baseRoom = new StandardRoom(
        deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(base) uuid=(SITUATION#base) />
            </Room>
        `)
    )
    const overrideRoom = new StandardRoom(
        deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(override) uuid=(SITUATION#override) />
            </Room>
        `)
    )

    it('batches ComponentData and ComponentVerticals across distinct universal keys', async () => {
        const slice = inMemoryComponentAggregateInternalCacheSlice({})
        const ComponentData = { get: jest.spyOn(slice.ComponentData, 'get') }
        const ComponentVerticals = { get: jest.spyOn(slice.ComponentVerticals, 'get') }

        const handler = new ComponentAggregateMergedCache(slice)
        const p1 = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const p2 = aggregatePerspectiveExplicit({
            universalKey: roomV,
            mergeParticipationOrder: [assetB],
        })
        await handler.get([p1, p2])

        expect(ComponentData.get).toHaveBeenCalledTimes(1)
        expect(ComponentVerticals.get).toHaveBeenCalledTimes(1)
        expect(new Set(ComponentData.get.mock.calls[0][0])).toEqual(new Set([roomU, roomV]))
        expect(new Set(ComponentVerticals.get.mock.calls[0][0])).toEqual(new Set([roomU, roomV]))
    })

    it('dedupes universal keys when two perspectives share universal but differ on participation order', async () => {
        const slice = inMemoryComponentAggregateInternalCacheSlice({})
        const ComponentData = { get: jest.spyOn(slice.ComponentData, 'get') }
        const ComponentVerticals = { get: jest.spyOn(slice.ComponentVerticals, 'get') }

        const handler = createComponentAggregateCacheHandler(slice)
        const pA = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        const pB = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetB, assetA],
        })
        await handler.get([pA, pB])

        expect(ComponentData.get).toHaveBeenCalledTimes(1)
        expect(ComponentData.get.mock.calls[0][0]).toEqual([roomU])
        expect(ComponentVerticals.get.mock.calls[0][0]).toEqual([roomU])
        expect(aggregatePerspectiveCacheKey(pA)).not.toEqual(aggregatePerspectiveCacheKey(pB))
    })

    it('matches gateway assembleMergedComponent for the same slice and perspective', async () => {
        const byAssets = [
            { AssetId: assetA, component: baseRoom as unknown as StandardComponent },
            { AssetId: assetB, component: overrideRoom as unknown as StandardComponent },
        ]
        const slice = inMemoryComponentAggregateInternalCacheSlice({
            authoritativeByUniversal: new Map([[roomU, { ComponentId: roomU, byAssets }]]),
            verticalsByUniversal: new Map([[roomU, { universalKey: roomU, hops: [] }]]),
        })
        const { gateway } = createComponentAggregateGateway(slice)
        const handler = createComponentAggregateCacheHandler(slice)
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        const [fromCache] = await handler.get([p])
        const direct = await gateway.assembleMergedComponent(p)
        expect(fromCache.universalKey).toEqual(direct.universalKey)
        const fromRoom = fromCache.merged as StandardRoom
        const directRoom = direct.merged as StandardRoom
        expect(fromRoom.situations.items.map((f) => f.reference.universalKey)).toEqual(
            directRoom.situations.items.map((f) => f.reference.universalKey)
        )
    })

    it('does not refetch sibling loaders on cache hit', async () => {
        const slice = inMemoryComponentAggregateInternalCacheSlice({})
        const ComponentData = { get: jest.spyOn(slice.ComponentData, 'get') }
        const handler = createComponentAggregateCacheHandler(slice)
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        await handler.get([p])
        await handler.get([p])
        expect(ComponentData.get).toHaveBeenCalledTimes(1)
    })

    it('refetches after clear', async () => {
        const slice = inMemoryComponentAggregateInternalCacheSlice({})
        const ComponentData = { get: jest.spyOn(slice.ComponentData, 'get') }
        const handler = createComponentAggregateCacheHandler(slice)
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        await handler.get([p])
        handler.clear()
        await handler.get([p])
        expect(ComponentData.get).toHaveBeenCalledTimes(2)
    })

    it('refetches after invalidate on cache key', async () => {
        const slice = inMemoryComponentAggregateInternalCacheSlice({})
        const ComponentData = { get: jest.spyOn(slice.ComponentData, 'get') }
        const handler = createComponentAggregateCacheHandler(slice)
        const p = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const cacheKey = aggregatePerspectiveCacheKey(p)
        await handler.get([p])
        handler.invalidate(cacheKey)
        await handler.get([p])
        expect(ComponentData.get).toHaveBeenCalledTimes(2)
    })
})
