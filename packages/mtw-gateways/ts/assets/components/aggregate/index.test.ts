import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import {
    AggregateInputError,
    aggregatePerspectiveExplicit,
    createAggregateGateway,
    mergedComponentResult,
    normalizeMergeParticipationOrder,
    participationAssetsInPerspective,
} from './index'

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

    describe('createAggregateGateway', () => {
        it('accepts loader-shaped deps and exposes participation helper', () => {
            const deps = {
                authoritativeComponentData: {
                    get: async () => [],
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
})
