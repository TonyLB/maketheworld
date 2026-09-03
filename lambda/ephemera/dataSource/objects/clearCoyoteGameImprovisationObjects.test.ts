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
    getObjectLudicGraph: async (objectId: EphemeraObjectId) => EphemeraLudicGraph.empty(objectId),
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
                getObjectLudicGraph: async (objectId) => (objectId === TABLE_ID ? tableGraph : EphemeraLudicGraph.empty(objectId)),
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
        // Phase 2: membership-clear runs per object --- string and table from the room graph, and
        // cup by descending into table's own shard. Cup is not a member of any room or character
        // graph, so the two flat scans miss it entirely; before that descent shipped it survived
        // the clear and was then stranded when table's row was deleted underneath it (2026-09-03).
        expect(applyClearMembershipImpl).toHaveBeenCalledTimes(3)
        expect(applyClearMembershipImpl).toHaveBeenCalledWith(
            expect.objectContaining({ entityId: CUP_ID, target: null })
        )
        expect(deleteObjectImpl).toHaveBeenCalledWith(
            expect.objectContaining({ objectId: CUP_ID })
        )
    })

    it('removes a nested object before the host it lives in', async () => {
        // Phase 2 deletes each object's whole `Meta::Object` row, host graph and all. If the host
        // goes first, the nested object's own membership-clear then has to remove it from a graph
        // whose row no longer exists --- the commit's footprint fetch fails and the object is
        // stranded exactly as if it had never been enumerated (2026-09-03, second live run).
        const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
        const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
        const roomGraph = EphemeraLudicGraph.fromFieldPayload(ROOM_A, {
            rootId: ROOM_A, ports: [],
            nodes: [objectNode(TABLE_ID)],
            edges: [],
        })
        const tableGraph = EphemeraLudicGraph.fromFieldPayload(TABLE_ID, {
            rootId: TABLE_ID, ports: [],
            nodes: [objectNode(CUP_ID)],
            edges: [],
        })

        const result = await clearCoyoteGameImprovisationObjects(
            {
                getGameRooms: async () => ['VORTEX'],
                getRoomLudicGraph: async () => roomGraph,
                getActiveCharactersInCoyoteRooms: async () => [],
                getMembershipContainers: async (id) => (id === TABLE_ID ? [ROOM_A] : id === CUP_ID ? [TABLE_ID] : []),
                getGraph: async (hostId) => (hostId === ROOM_A ? roomGraph : hostId === TABLE_ID ? tableGraph : EphemeraLudicGraph.empty(hostId)),
                getObjectLudicGraph: async (objectId) => (objectId === TABLE_ID ? tableGraph : EphemeraLudicGraph.empty(objectId)),
            },
            { messageBus: messageBus as any, applyClearMembershipImpl, deleteObjectImpl }
        )

        expect(result.ok).toBe(true)
        const clearedOrder = applyClearMembershipImpl.mock.calls.map(([args]: any) => args.entityId)
        const deletedOrder = deleteObjectImpl.mock.calls.map(([args]: any) => args.objectId)
        expect(clearedOrder.indexOf(CUP_ID)).toBeLessThan(clearedOrder.indexOf(TABLE_ID))
        expect(deletedOrder.indexOf(CUP_ID)).toBeLessThan(deletedOrder.indexOf(TABLE_ID))
    })
})
