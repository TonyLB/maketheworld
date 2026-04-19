import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    clearRoomObjectsAndPublishUpdate,
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import { clearPersistMetaRoomObjects, mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'

jest.mock('./mergePersistMetaRoomObjects', () => ({
    clearPersistMetaRoomObjects: jest.fn(),
    mergePersistMetaRoomObjects: jest.fn(),
}))

const mergePersistMetaRoomObjectsMock = mergePersistMetaRoomObjects as jest.MockedFunction<typeof mergePersistMetaRoomObjects>
const clearPersistMetaRoomObjectsMock = clearPersistMetaRoomObjects as jest.MockedFunction<typeof clearPersistMetaRoomObjects>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
})

describe('handleApiObjectsChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomObjectsMock.mockReset()
        mergePersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        clearPersistMetaRoomObjectsMock.mockReset()
        clearPersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('calls mergePersistMetaRoomObjects with roomId, add, and remove', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            {
                componentId: roomId,
                add: [obj('o1', 'One')],
                remove: ['OBJECT#o2' as EphemeraObjectId],
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomObjectsMock).toHaveBeenCalledWith({
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
        expect(mergePersistMetaRoomObjectsMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('does not stream when merge did not persist', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when merge fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
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

    it('streams Objects Changed when merge persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        const add = [obj('b', 'B')]
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('a', 'A')],
            newObjects: [obj('a', 'A'), obj('b', 'B')],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add, remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add,
                remove: [],
                priorObjects: [obj('a', 'A')],
                newObjects: [obj('a', 'A'), obj('b', 'B')],
            },
        })
    })
})

describe('clearRoomObjectsAndPublishUpdate', () => {
    const roomId = 'ROOM#clear' as EphemeraRoomId
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        clearPersistMetaRoomObjectsMock.mockReset()
        clearPersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('publishes Objects Changed with empty newObjects when clear persists', async () => {
        clearPersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('a', 'A'), obj('b', 'B')],
            newObjects: [],
        })

        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })

        expect(clearPersistMetaRoomObjectsMock).toHaveBeenCalledWith({ roomId })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add: [],
                remove: ['OBJECT#a' as EphemeraObjectId, 'OBJECT#b' as EphemeraObjectId],
                priorObjects: [obj('a', 'A'), obj('b', 'B')],
                newObjects: [],
            },
        })
    })

    it('does not stream when clear does not persist', async () => {
        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when clear fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        clearPersistMetaRoomObjectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'no row',
        })
        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})

describe('handleAwaitRoadRunnerClearObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        streamEvent.mockClear()
    })

    it('clears all coyote rooms in parallel via Promise.all', async () => {
        const clearRoomObjectsAndPublishUpdateImpl = jest
            .fn()
            .mockImplementation(async () => Promise.resolve())
        const getGameRooms = jest.fn(async () => ['VORTEX', 'ROOM#BRIDGE', 'CLIFFTOP'])

        await handleAwaitRoadRunnerClearObjects({
            streamEvent,
            getGameRooms,
            clearRoomObjectsAndPublishUpdateImpl,
        })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenCalledTimes(3)
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX', { streamEvent })
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(2, 'ROOM#BRIDGE', { streamEvent })
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(3, 'ROOM#CLIFFTOP', { streamEvent })
    })
})

describe('handleAcmeOrderAddObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomObjectsMock.mockReset()
        mergePersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('adds incoming order lines as room objects with affinities for character current room', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('old', 'Old')],
            newObjects: [
                obj('old', 'Old'),
                { uuid: 'OBJECT#u1' as EphemeraObjectId, shortName: 'anvil', affinities: [] },
                {
                    uuid: 'OBJECT#u2' as EphemeraObjectId,
                    shortName: 'giant magnet',
                    affinities: [{ role: 'terminal' as const, aptness: 0.6 }],
                },
            ],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidValues = ['u1', 'u2']
        const uuidFactory = jest.fn(() => uuidValues.shift() || 'fallback')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [
                { shortName: 'anvil', affinities: [] },
                {
                    shortName: 'giant magnet',
                    affinities: [{ role: 'terminal', aptness: 0.6 }],
                },
            ],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(getCharacterMeta).toHaveBeenCalledWith('CHARACTER#123')
        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [
                { uuid: 'OBJECT#u1', shortName: 'anvil', affinities: [] },
                {
                    uuid: 'OBJECT#u2',
                    shortName: 'giant magnet',
                    affinities: [{ role: 'terminal', aptness: 0.6 }],
                },
            ],
            remove: [],
        })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: 'ROOM#VORTEX',
                add: [
                    { uuid: 'OBJECT#u1', shortName: 'anvil', affinities: [] },
                    {
                        uuid: 'OBJECT#u2',
                        shortName: 'giant magnet',
                        affinities: [{ role: 'terminal', aptness: 0.6 }],
                    },
                ],
                remove: [],
                priorObjects: [obj('old', 'Old')],
                newObjects: [
                    obj('old', 'Old'),
                    { uuid: 'OBJECT#u1', shortName: 'anvil', affinities: [] },
                    {
                        uuid: 'OBJECT#u2',
                        shortName: 'giant magnet',
                        affinities: [{ role: 'terminal', aptness: 0.6 }],
                    },
                ],
            },
        })
    })

    it('persists affinitiesFailed when present on the bus payload', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [],
            newObjects: [{
                uuid: 'OBJECT#u1' as EphemeraObjectId,
                shortName: 'box',
                affinities: [],
                affinitiesFailed: true,
            }],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'box', affinities: [], affinitiesFailed: true }],
            confidence: 0.5,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [{
                uuid: 'OBJECT#u1',
                shortName: 'box',
                affinities: [],
                affinitiesFailed: true,
            }],
            remove: [],
        })
    })

    it('does nothing when character room cannot be resolved as ephemera room id', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn()
        const getCharacterMeta = jest.fn(async () => ({}))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'anvil', affinities: [] }],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

})
