import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import { componentExamplesPerspectiveCacheKey } from './keys'

describe('componentExamplesPerspectiveCacheKey', () => {
    const roomU = 'ROOM#r1' as const
    const featureU = 'FEATURE#f1' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const

    it('is stable for the same input', () => {
        const input = {
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        } as const
        expect(componentExamplesPerspectiveCacheKey(input)).toEqual(
            componentExamplesPerspectiveCacheKey(input)
        )
    })

    it('includes host, computePerspectiveKey fragment, and default Room lens flag', () => {
        const input = {
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        } as const
        const key = componentExamplesPerspectiveCacheKey(input)
        expect(key.startsWith(`${roomU}::`)).toBe(true)
        expect(key).toContain(computePerspectiveKey([assetA, assetB]))
        expect(key.endsWith('::lensDefaults=1')).toBe(true)
    })

    it('defaults Feature hosts to lensDefaults=0', () => {
        const key = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: featureU,
            mergeParticipationOrder: [assetA],
        })
        expect(key.endsWith('::lensDefaults=0')).toBe(true)
    })

    it('differs when merge participation order changes', () => {
        const a = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA, assetB],
        })
        const b = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetB, assetA],
        })
        expect(a).not.toEqual(b)
    })

    it('differs when resolveRoomLensMarkDefaults overrides the host default', () => {
        const defaultRoom = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const explicitOff = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
            options: { resolveRoomLensMarkDefaults:
                false },
        })
        expect(defaultRoom).not.toEqual(explicitOff)
        expect(explicitOff.endsWith('::lensDefaults=0')).toBe(true)
    })

    it('differs when host universal key changes', () => {
        const a = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: roomU,
            mergeParticipationOrder: [assetA],
        })
        const b = componentExamplesPerspectiveCacheKey({
            hostUniversalKey: 'ROOM#other' as typeof roomU,
            mergeParticipationOrder: [assetA],
        })
        expect(a).not.toEqual(b)
    })
})
