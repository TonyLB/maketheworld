import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

import { EphemeraLudicGraph, objectNode } from '../positions/ludicGraph'
import type { ObjectsChangedPayload } from './events'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'

const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const OBJECT_ROOM = 'OBJECT#RoomProp' as EphemeraObjectId
const OBJECT_HELD = 'OBJECT#HeldProp' as EphemeraObjectId

describe('clearCoyoteGameImprovisationObjects', () => {
    const messageBus = { publish: jest.fn() }
    const positionsStreamEvent = jest.fn().mockResolvedValue(undefined)
    const objectsStreamEvent = jest.fn().mockResolvedValue(undefined) as StreamEventFunction<
        ObjectsChangedPayload,
        StreamingEventHeader
    >
    const applyClearMembershipImpl = jest.fn()
    const deleteObjectImpl = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        applyClearMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [],
            to: null,
            changed: false,
        })
        deleteObjectImpl.mockImplementation(async ({ objectId }) => ({ ok: true, objectId }))
    })

    it('returns persisted false when no objects on room or character graphs', async () => {
        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.empty(ROOM_A),
                getActiveCharactersInCoyoteRooms: async () => [],
            },
            { messageBus: messageBus as any, applyClearMembershipImpl, deleteObjectImpl }
        )

        expect(result).toEqual({ ok: true, persisted: false, destroyedIds: [] })
        expect(applyClearMembershipImpl).not.toHaveBeenCalled()
    })

    it('clears room-placed object membership then deletes rows', async () => {
        applyClearMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [ROOM_A],
            to: null,
            changed: true,
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
                    rootId: ROOM_A,
                    nodes: [objectNode(OBJECT_ROOM)],
                    edges: [],
                }),
                getActiveCharactersInCoyoteRooms: async () => [],
            },
            {
                messageBus: messageBus as any,
                positionsStreamEvent,
                objectsStreamEvent,
                applyClearMembershipImpl,
                deleteObjectImpl,
            }
        )

        expect(result).toEqual({ ok: true, persisted: true, destroyedIds: [OBJECT_ROOM] })
        expect(applyClearMembershipImpl).toHaveBeenCalledWith(
            { objectId: OBJECT_ROOM },
            { messageBus, streamEvent: positionsStreamEvent }
        )
        expect(deleteObjectImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ROOM,
            affectedRoomIds: [ROOM_A],
        })
        expect(objectsStreamEvent).toHaveBeenCalled()
    })

    it('discovers held-only objects via active Coyote character graphs', async () => {
        applyClearMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [CHARACTER_A],
            to: null,
            changed: true,
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.empty(ROOM_A),
                getActiveCharactersInCoyoteRooms: async () => [CHARACTER_A],
                getCharacterLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(CHARACTER_A, {
                    rootId: CHARACTER_A,
                    nodes: [objectNode(OBJECT_HELD)],
                    edges: [],
                }),
            },
            {
                messageBus: messageBus as any,
                applyClearMembershipImpl,
                deleteObjectImpl,
            }
        )

        expect(result).toEqual({ ok: true, persisted: true, destroyedIds: [OBJECT_HELD] })
        expect(applyClearMembershipImpl).toHaveBeenCalledWith(
            { objectId: OBJECT_HELD },
            expect.any(Object)
        )
    })

    it('unions room and character graph object ids without duplicates', async () => {
        applyClearMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [ROOM_A, CHARACTER_A],
            to: null,
            changed: true,
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
                    rootId: ROOM_A,
                    nodes: [objectNode(OBJECT_ROOM)],
                    edges: [],
                }),
                getActiveCharactersInCoyoteRooms: async () => [CHARACTER_A],
                getCharacterLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(CHARACTER_A, {
                    rootId: CHARACTER_A,
                    nodes: [objectNode(OBJECT_HELD), objectNode(OBJECT_ROOM)],
                    edges: [],
                }),
            },
            { messageBus: messageBus as any, applyClearMembershipImpl, deleteObjectImpl }
        )

        expect(result.ok).toBe(true)
        if (result.ok && result.persisted) {
            expect(result.destroyedIds.sort()).toEqual([OBJECT_HELD, OBJECT_ROOM].sort())
        }
        expect(applyClearMembershipImpl).toHaveBeenCalledTimes(2)
    })
})
