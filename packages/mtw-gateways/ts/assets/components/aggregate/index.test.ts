import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import { ParticipationBatchError } from '../componentData/participationBatch'
import {
    AggregateInputError,
    aggregatePerspectiveExplicit,
    createAggregateGateway,
    createComponentAggregateGateway,
    mergeAuthoritativeAcrossParticipationOrder,
    mergedComponentResult,
    normalizeMergeParticipationOrder,
    participationAssetsInPerspective,
} from './index'
import { inMemoryComponentAggregateInternalCacheSlice } from './testHarness'

describe('component aggregate gateway (compute-only)', () => {
    const roomU = 'ROOM#r1' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const

    describe('normalizeMergeParticipationOrder', () => {
        it('returns a frozen readonly copy for valid unique ids', () => {
            const order = normalizeMergeParticipationOrder([assetA, assetB])
            expect(order).toEqual([assetA, assetB])
            expect(Object.isFrozen(order)).toBe(true)
        })

        it('throws on duplicate ids', () => {
            expect(() => normalizeMergeParticipationOrder([assetA, assetA])).toThrow(AggregateInputError)
        })

        it('throws on invalid asset id', () => {
            expect(() => normalizeMergeParticipationOrder(['not-an-asset' as typeof assetA])).toThrow(
                AggregateInputError
            )
        })
    })

    describe('aggregatePerspectiveExplicit', () => {
        it('builds a frozen perspective with optional anchor', () => {
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
                anchorAssetId: assetA,
            })
            expect(p.universalKey).toBe(roomU)
            expect(p.mergeParticipationOrder).toEqual([assetA, assetB])
            expect(p.anchorAssetId).toBe(assetA)
            expect(Object.isFrozen(p)).toBe(true)
        })

        it('omits anchor when not provided', () => {
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA],
            })
            expect(p.anchorAssetId).toBeUndefined()
        })

        it('throws on invalid universal key', () => {
            expect(() =>
                aggregatePerspectiveExplicit({
                    universalKey: 'NOT_EPHEMERA',
                    mergeParticipationOrder: [assetA],
                })
            ).toThrow(AggregateInputError)
        })
    })

    describe('participationAssetsInPerspective', () => {
        it('matches merge order set semantics', () => {
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            })
            expect(participationAssetsInPerspective(p)).toEqual(new Set([assetA, assetB]))
        })
    })

    describe('mergedComponentResult', () => {
        it('freezes merged result payload', () => {
            const stub = { tag: 'Room' } as unknown as StandardComponent
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA],
            })
            const r = mergedComponentResult({
                universalKey: p.universalKey,
                merged: stub,
                mergeParticipationOrderApplied: p.mergeParticipationOrder,
            })
            expect(r.merged).toBe(stub)
            expect(r.mergeParticipationOrderApplied).toEqual([assetA])
            expect(Object.isFrozen(r)).toBe(true)
        })
    })

    describe('createComponentAggregateGateway', () => {
        it('accepts InternalCache-shaped slice and exposes participation helper', () => {
            const slice = inMemoryComponentAggregateInternalCacheSlice({})
            const { gateway } = createComponentAggregateGateway(slice)
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            })
            expect(gateway.participationAssetsInPerspective(p)).toEqual(new Set([assetA, assetB]))
        })
    })

    describe('createAggregateGateway', () => {
        it('still accepts analyzer-shaped field names with participation loader', () => {
            const deps = {
                authoritativeComponentData: {
                    getAcrossAssets: async () => ({}),
                },
                metaImportProjection: {
                    get: async () => [],
                },
            }
            const gateway = createAggregateGateway(deps)
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            })
            expect(gateway.participationAssetsInPerspective(p)).toEqual(new Set([assetA, assetB]))
        })
    })

    describe('mergeAuthoritativeAcrossParticipationOrder', () => {
        it('throws on empty merge participation order', () => {
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [],
            })
            expect(() =>
                mergeAuthoritativeAcrossParticipationOrder(p, { ComponentId: roomU, byAssets: [] })
            ).toThrow(AggregateInputError)
        })

        it('throws when authoritative ComponentId does not match universal key', () => {
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA],
            })
            expect(() =>
                mergeAuthoritativeAcrossParticipationOrder(p, {
                    ComponentId: 'ROOM#other' as typeof roomU,
                    byAssets: [],
                })
            ).toThrow(AggregateInputError)
        })
    })

    describe('assembleMergedComponent', () => {
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

        it('invokes ComponentVerticals in parallel with participation batch for universal key', async () => {
            const getAcrossAssets = jest.fn().mockResolvedValue({})
            const ComponentData = { getAcrossAssets }
            const ComponentVerticals = { get: jest.fn().mockResolvedValue([]) }
            const { gateway } = createComponentAggregateGateway({ ComponentData, ComponentVerticals })
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [],
            })
            await expect(gateway.assembleMergedComponent(p)).rejects.toThrow(ParticipationBatchError)
            expect(getAcrossAssets).not.toHaveBeenCalled()
            expect(ComponentVerticals.get).toHaveBeenCalledWith([roomU])
            expect(ComponentVerticals.get).toHaveBeenCalledTimes(1)
        })

        it('merges rooms in merge participation order (later asset overlays)', async () => {
            const byAssets = [
                { AssetId: assetA, component: baseRoom as unknown as StandardComponent },
                { AssetId: assetB, component: overrideRoom as unknown as StandardComponent },
            ]
            const slice = inMemoryComponentAggregateInternalCacheSlice({
                authoritativeByUniversal: new Map([[roomU, { ComponentId: roomU, byAssets }]]),
                verticalsByUniversal: new Map([[roomU, { universalKey: roomU, hops: [] }]]),
            })
            const { gateway } = createComponentAggregateGateway(slice)
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            })
            const result = await gateway.assembleMergedComponent(p)
            const situationIds = (result.merged as StandardRoom).situations.items.map(
                (f) => f.reference.universalKey
            )
            expect(situationIds).toEqual(expect.arrayContaining(['SITUATION#base', 'SITUATION#override']))
        })

        it('uses default stub for a missing participation asset then merges overlay', async () => {
            const byAssets = [{ AssetId: assetB, component: overrideRoom as unknown as StandardComponent }]
            const slice = inMemoryComponentAggregateInternalCacheSlice({
                authoritativeByUniversal: new Map([[roomU, { ComponentId: roomU, byAssets }]]),
                verticalsByUniversal: new Map([[roomU, { universalKey: roomU, hops: [] }]]),
            })
            const { gateway } = createComponentAggregateGateway(slice)
            const p = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            })
            const result = await gateway.assembleMergedComponent(p)
            const situationIds = (result.merged as StandardRoom).situations.items.map(
                (f) => f.reference.universalKey
            )
            expect(situationIds).toContain('SITUATION#override')
        })
    })
})
