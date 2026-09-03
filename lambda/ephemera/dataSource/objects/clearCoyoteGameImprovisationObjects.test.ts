import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraCrossingPort } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

jest.mock('../positions/manipulation/kernel/commitStepSequence', () => ({
    commitStepSequence: jest.fn(),
}))

import { EphemeraLudicGraph, objectNode } from '../positions/ludicGraph'
import { commitStepSequence } from '../positions/manipulation/kernel/commitStepSequence'
import type { ObjectsChangedPayload } from './events'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'

const commitStepSequenceMock = commitStepSequence as jest.MockedFunction<typeof commitStepSequence>

const ROOM_A = 'ROOM#VORTEX' as EphemeraRoomId
const CHARACTER_A = 'CHARACTER#Alpha' as EphemeraCharacterId
const OBJECT_ROOM = 'OBJECT#RoomProp' as EphemeraObjectId
const OBJECT_HELD = 'OBJECT#HeldProp' as EphemeraObjectId

/**
 * PV1-3c's phase-1 dissolve pass needs `getMembershipContainers`/`getGraph` --- none of these
 * fixtures carry any relational edges, so it always finds zero chains to dissolve, but the
 * defaults reach real gateways (`internalCache.Positions.*`) if left unset, which times out
 * against a real AWS call in a unit test. `getGraph` returning an empty graph for anything not
 * explicitly seeded is enough for these fixtures; a genuine crossing case gets its own dedicated
 * test below.
 */
const noRelationsArgs = {
    getMembershipContainers: async () => [],
    getGraph: async (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph.empty(hostId),
}

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
        commitStepSequenceMock.mockResolvedValue({ ok: true, beatAnchorTime: 1, steps: [], captures: new Map() })
    })

    it('returns persisted false when no objects on room or character graphs', async () => {
        const result = await clearCoyoteGameImprovisationObjects(
            {
                ...noRelationsArgs,
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
                ...noRelationsArgs,
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
                    rootId: ROOM_A, ports: [],
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
        expect(applyClearMembershipImpl).toHaveBeenCalledWith({
            entityId: OBJECT_ROOM,
            target: null,
            messageBus,
            streamEvent: positionsStreamEvent,
        })
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
                ...noRelationsArgs,
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.empty(ROOM_A),
                getActiveCharactersInCoyoteRooms: async () => [CHARACTER_A],
                getCharacterLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(CHARACTER_A, {
                    rootId: CHARACTER_A, ports: [],
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
            expect.objectContaining({ entityId: OBJECT_HELD, target: null })
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
                ...noRelationsArgs,
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
                    rootId: ROOM_A, ports: [],
                    nodes: [objectNode(OBJECT_ROOM)],
                    edges: [],
                }),
                getActiveCharactersInCoyoteRooms: async () => [CHARACTER_A],
                getCharacterLudicGraph: async () => EphemeraLudicGraph.fromFieldPayload(CHARACTER_A, {
                    rootId: CHARACTER_A, ports: [],
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

    it("PV1-3c: a batch clear dissolves a crossing spanning two of its own objects in one phase-1 transact, before either object's own removal --- the room-side object never independently identifies the crossing-port-owning object's own graph", async () => {
        const STRING_ID = 'OBJECT#String' as EphemeraObjectId
        const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
        const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
        const port: EphemeraCrossingPort = { portId: 'port-1', fromHostId: ROOM_A, kind: 'Custom', exteriorRelationLabel: 'to' }
        const exteriorEdge = { from: STRING_ID, to: { owner: TABLE_ID, port: 'port-1' }, kind: 'Custom' as const, relationLabel: 'to' }
        const interiorEdge = { from: { owner: TABLE_ID, port: 'port-1' }, to: CUP_ID, kind: 'Custom' as const, relationLabel: 'to' }
        const roomGraph = EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
            rootId: ROOM_A,
            ports: [],
            nodes: [objectNode(STRING_ID), objectNode(TABLE_ID)],
            edges: [{ tag: 'Relational', ...exteriorEdge }],
        })
        const tableGraph = EphemeraLudicGraph.fromFieldPayload(TABLE_ID, {
            rootId: TABLE_ID,
            ports: [port],
            nodes: [objectNode(CUP_ID)],
            edges: [{ tag: 'Relational', ...interiorEdge }],
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => roomGraph,
                getActiveCharactersInCoyoteRooms: async () => [],
                getMembershipContainers: async (id) => (id === STRING_ID || id === TABLE_ID ? [ROOM_A] : []),
                getGraph: async (hostId) => (hostId === ROOM_A ? roomGraph : hostId === TABLE_ID ? tableGraph : EphemeraLudicGraph.empty(hostId)),
            },
            { messageBus: messageBus as any, applyClearMembershipImpl, deleteObjectImpl }
        )

        expect(result.ok).toBe(true)
        // Phase 1: one dissolve-only commit, both legs and the port, before any membership clear.
        expect(commitStepSequenceMock).toHaveBeenCalledTimes(1)
        const [{ steps }] = commitStepSequenceMock.mock.calls[0]
        expect(steps).toEqual(expect.arrayContaining([
            { kind: 'dissolveRelation', subjectId: exteriorEdge.from, targetId: exteriorEdge.to, hostId: ROOM_A, relationKind: 'Custom', relationLabel: 'to' },
            { kind: 'removeCrossingPort', hostId: TABLE_ID, portId: 'port-1' },
            { kind: 'dissolveRelation', subjectId: interiorEdge.from, targetId: interiorEdge.to, hostId: TABLE_ID, relationKind: 'Custom', relationLabel: 'to' },
        ]))
        expect(steps).toHaveLength(3)
        // Phase 2: membership-clear still runs per object, as before --- table and string both
        // discovered from the room graph (cup is never independently discovered, only reached
        // via table's own owned graph in phase 1).
        expect(applyClearMembershipImpl).toHaveBeenCalledTimes(2)
    })

    it('PV1-3c bugfix: dissolves a stale edge left on a room the object is no longer a current member of', async () => {
        // The object was carried away to a character before the clear, but a plain (portless)
        // relation it left behind on the room --- from a real move that classified `defer`, PV1-3's
        // own scope cut --- is still recorded there. `getMembershipContainers(OBJECT_HELD)` only
        // names the character, so membership-only reachability would never visit the room; this
        // proves the room (part of the clear's own known universe) is seeded regardless.
        const OTHER_OBJECT = 'OBJECT#Anchor' as EphemeraObjectId
        const staleEdge = { from: OBJECT_HELD, to: OTHER_OBJECT, kind: 'Custom' as const, relationLabel: 'anchored to' }
        const roomGraph = EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
            rootId: ROOM_A, ports: [],
            nodes: [objectNode(OTHER_OBJECT)],
            edges: [{ tag: 'Relational', ...staleEdge }],
        })
        const characterGraph = EphemeraLudicGraph.fromFieldPayload(CHARACTER_A, {
            rootId: CHARACTER_A, ports: [],
            nodes: [objectNode(OBJECT_HELD)],
            edges: [],
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => roomGraph,
                getActiveCharactersInCoyoteRooms: async () => [CHARACTER_A],
                getCharacterLudicGraph: async () => characterGraph,
                getMembershipContainers: async (id) => (id === OBJECT_HELD ? [CHARACTER_A] : []),
                getGraph: async (hostId) => (hostId === ROOM_A ? roomGraph : hostId === CHARACTER_A ? characterGraph : EphemeraLudicGraph.empty(hostId)),
            },
            { messageBus: messageBus as any, applyClearMembershipImpl, deleteObjectImpl }
        )

        expect(result.ok).toBe(true)
        expect(commitStepSequenceMock).toHaveBeenCalledTimes(1)
        const [{ steps }] = commitStepSequenceMock.mock.calls[0]
        expect(steps).toEqual([
            { kind: 'dissolveRelation', subjectId: staleEdge.from, targetId: staleEdge.to, hostId: ROOM_A, relationKind: 'Custom', relationLabel: 'anchored to' },
        ])
    })
})
