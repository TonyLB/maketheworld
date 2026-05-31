import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    fanOutAffordanceRefreshForRoom,
    resolveAffordanceRefreshGroupsForRoom,
} from './fanOutAffordanceRefreshForRoom'

const A = 'ASSET#a' as AssetUUID
const B = 'ASSET#b' as AssetUUID
const C = 'ASSET#c' as AssetUUID
const roomId = 'ROOM#affFan' as EphemeraRoomId

describe('fanOutAffordanceRefreshForRoom', () => {
    const baseDeps = () => ({
        resolveRoomAssetStackForRoom: jest.fn().mockResolvedValue([C, A, B]),
        resolveCanonAssetStackForRoom: jest.fn().mockResolvedValue([A]),
        roomCharacterListGet: jest.fn().mockResolvedValue([
            { EphemeraId: 'CHARACTER#1' },
            { EphemeraId: 'CHARACTER#2' },
        ]),
        characterMetaGet: jest.fn().mockImplementation(async (id: EphemeraCharacterId) => {
            if (id === 'CHARACTER#1') {
                return { assets: [B, A] }
            }
            return { assets: [A] }
        }),
    })

    it('resolveAffordanceRefreshGroupsForRoom returns one group per distinct perspective', async () => {
        const deps = baseDeps()
        const groups = await resolveAffordanceRefreshGroupsForRoom(roomId, deps)
        expect(groups).toHaveLength(2)
        const stacks = groups.map((g) => g.assetStack)
        expect(stacks).toContainEqual([A, B])
        expect(stacks).toContainEqual([A])
    })

    it('resolveAffordanceRefreshGroupsForRoom returns empty when room has no occupants', async () => {
        const deps = {
            ...baseDeps(),
            roomCharacterListGet: jest.fn().mockResolvedValue([]),
        }
        const groups = await resolveAffordanceRefreshGroupsForRoom(roomId, deps)
        expect(groups).toEqual([])
    })

    it('fanOutAffordanceRefreshForRoom calls orchestrateAffordanceRequest once per perspective group', async () => {
        const orchestrateFn = jest.fn().mockResolvedValue(undefined)
        const deps = baseDeps()
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const messageBus = {} as any

        await fanOutAffordanceRefreshForRoom(
            {
                roomId,
                reason: 'objects',
                messageBus,
                streamEvent,
            },
            { ...deps, orchestrateAffordanceRequestFn: orchestrateFn }
        )

        expect(orchestrateFn).toHaveBeenCalledTimes(2)
        const reasons = orchestrateFn.mock.calls.map((c) => c[0].payload.reason)
        expect(reasons).toEqual(['objects', 'objects'])
        const perspectiveKeys = orchestrateFn.mock.calls.map((c) =>
            computePerspectiveKey(c[0].payload.perspective.assetStack)
        )
        expect(new Set(perspectiveKeys).size).toBe(2)
        expect(perspectiveKeys).toContain(computePerspectiveKey([A, B]))
        expect(perspectiveKeys).toContain(computePerspectiveKey([A]))
    })

    it('fanOutAffordanceRefreshForRoom does nothing when no perspective groups resolve', async () => {
        const orchestrateFn = jest.fn().mockResolvedValue(undefined)
        const deps = {
            ...baseDeps(),
            roomCharacterListGet: jest.fn().mockResolvedValue([]),
        }

        await fanOutAffordanceRefreshForRoom(
            {
                roomId,
                reason: 'roster',
                messageBus: {} as any,
                streamEvent: jest.fn().mockResolvedValue(undefined),
            },
            { ...deps, orchestrateAffordanceRequestFn: orchestrateFn }
        )

        expect(orchestrateFn).not.toHaveBeenCalled()
    })
})
