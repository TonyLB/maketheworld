import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import { applyObjectsChange } from './applyObjectsChange'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'

jest.mock('./applyObjectsChange', () => ({
    applyObjectsChange: jest.fn(),
}))

jest.mock('./clearCoyoteGameImprovisationObjects', () => ({
    clearCoyoteGameImprovisationObjects: jest.fn(),
}))

jest.mock('./spawnAndPlaceImprovisationObject', () => ({
    spawnAndPlaceImprovisationObject: jest.fn(),
}))

const applyObjectsChangeMock = applyObjectsChange as jest.MockedFunction<typeof applyObjectsChange>
const clearCoyoteGameImprovisationObjectsMock = clearCoyoteGameImprovisationObjects as jest.MockedFunction<typeof clearCoyoteGameImprovisationObjects>
const spawnAndPlaceMock = spawnAndPlaceImprovisationObject as jest.MockedFunction<typeof spawnAndPlaceImprovisationObject>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
})

describe('handleApiObjectsChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        applyObjectsChangeMock.mockReset()
        applyObjectsChangeMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('calls applyObjectsChange with roomId, add, and remove', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            {
                componentId: roomId,
                add: [obj('o1', 'One')],
                remove: ['OBJECT#o2' as EphemeraObjectId],
            },
            { streamEvent }
        )
        expect(applyObjectsChangeMock).toHaveBeenCalledWith({
            roomId,
            add: [obj('o1', 'One')],
            remove: ['OBJECT#o2' as EphemeraObjectId],
        })
    })

    it('does not persist for non-room component ids', async () => {
        await handleApiObjectsChangeCommand(
            { componentId: 'FEATURE#f1', add: [], remove: [] },
            { streamEvent }
        )
        expect(applyObjectsChangeMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('does not stream when apply did not persist', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when apply fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        applyObjectsChangeMock.mockResolvedValue({
            ok: false,
            errorMessage: 'no row',
        })
        const roomId = 'ROOM#fail' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('x', 'X')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('streams I4 Objects Changed when apply persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        applyObjectsChangeMock.mockResolvedValue({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#b' as EphemeraObjectId],
            destroyedIds: [],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('b', 'B')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                createdIds: ['OBJECT#b'],
                destroyedIds: [],
            },
        })
    })
})

describe('handleAwaitRoadRunnerClearObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        clearCoyoteGameImprovisationObjectsMock.mockReset()
        clearCoyoteGameImprovisationObjectsMock.mockResolvedValue({ ok: true, persisted: false, destroyedIds: [] })
        streamEvent.mockClear()
    })

    it('delegates to clearCoyoteGameImprovisationObjects with objects streamEvent', async () => {
        const getGameRooms = jest.fn(async () => ['VORTEX', 'BRIDGE'])

        await handleAwaitRoadRunnerClearObjects({
            streamEvent,
            getGameRooms,
        })

        expect(clearCoyoteGameImprovisationObjectsMock).toHaveBeenCalledWith(
            { getGameRooms },
            { objectsStreamEvent: streamEvent }
        )
    })
})

describe('handleAcmeOrderAddObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const environmentAffordanceMatrixOrder = {
        shortName: 'paint tunnel kit',
        stableKey: 'paint-tunnel-kit',
        tropeAffinities: [
            {
                trope: 'Contraption' as const,
                aptness: 'High' as const,
                narrowing: 'scene-dependent rig',
                environmentAffordances: [
                    { object: 'rock-wall' as const, roles: ['Finishing Move' as const] },
                    { object: 'long-fall' as const, roles: ['Finishing Move' as const] },
                    { object: 'cactus' as const, roles: ['Disadvantage' as const] },
                    { object: 'boulder' as const, roles: ['Contraption' as const] },
                    { object: 'tumbleweed' as const, roles: ['Misdirection' as const] },
                ],
            },
            {
                trope: 'Bait' as const,
                aptness: 'Good' as const,
                narrowing: 'portable bait',
            },
        ],
    }

    beforeEach(() => {
        spawnAndPlaceMock.mockReset()
        spawnAndPlaceMock.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))
        streamEvent.mockClear()
    })

    it('spawns each order line in character current room and streams createdIds', async () => {
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidValues = ['u1', 'u2']
        const uuidFactory = jest.fn(() => uuidValues.shift() || 'fallback')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [
                { shortName: 'anvil', stableKey: 'anvil' },
                {
                    shortName: 'giant magnet',
                    stableKey: 'giant-magnet',
                    tropeAffinities: [{
                        trope: 'Contraption',
                        aptness: 'High',
                        narrowing: 'magnetic winch rig',
                    }],
                },
            ],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            spawnAndPlaceImpl: spawnAndPlaceMock,
        })

        expect(spawnAndPlaceMock).toHaveBeenCalledTimes(2)
        expect(spawnAndPlaceMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                objectId: 'OBJECT#u1',
                shortName: 'anvil',
                stableKey: 'anvil',
                targetRoomId: 'ROOM#VORTEX',
            }),
            expect.any(Object)
        )
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                createdIds: ['OBJECT#u1', 'OBJECT#u2'],
                destroyedIds: [],
            },
        })
    })

    it('does nothing when character room cannot be resolved as ephemera room id', async () => {
        const getCharacterMeta = jest.fn(async () => ({}))

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'anvil', stableKey: 'anvil' }],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            spawnAndPlaceImpl: spawnAndPlaceMock,
        })

        expect(spawnAndPlaceMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('filters environment affordances for ROOM#STRAIGHTAWAY', async () => {
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#STRAIGHTAWAY' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            spawnAndPlaceImpl: spawnAndPlaceMock,
        })

        const spawnArgs = spawnAndPlaceMock.mock.calls[0]?.[0]
        expect(spawnArgs?.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Misdirection'] },
        ])
    })

    it('filters environment affordances for ROOM#VORTEX', async () => {
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            spawnAndPlaceImpl: spawnAndPlaceMock,
        })

        const spawnArgs = spawnAndPlaceMock.mock.calls[0]?.[0]
        expect(spawnArgs?.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'rock-wall', roles: ['Finishing Move'] },
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Misdirection'] },
        ])
    })
})
