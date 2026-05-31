import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import { componentTopologyPerspectiveCacheKey } from './keys'

describe('componentTopologyPerspectiveCacheKey', () => {
    const highway = 'ROOM#highway' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const

    it('is stable for the same input', () => {
        const input = {
            roomUniversalKey: highway,
            mergeParticipationOrder: [assetA, assetB],
        } as const
        expect(componentTopologyPerspectiveCacheKey(input)).toEqual(
            componentTopologyPerspectiveCacheKey(input)
        )
    })

    it('includes room and computePerspectiveKey fragment', () => {
        const input = {
            roomUniversalKey: highway,
            mergeParticipationOrder: [assetA, assetB],
        } as const
        const key = componentTopologyPerspectiveCacheKey(input)
        expect(key).toEqual(`${highway}::${computePerspectiveKey([assetA, assetB])}`)
    })

    it('differs when merge participation order changes', () => {
        const a = componentTopologyPerspectiveCacheKey({
            roomUniversalKey: highway,
            mergeParticipationOrder: [assetA, assetB],
        })
        const b = componentTopologyPerspectiveCacheKey({
            roomUniversalKey: highway,
            mergeParticipationOrder: [assetB, assetA],
        })
        expect(a).not.toEqual(b)
    })
})
