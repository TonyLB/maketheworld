import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { executeMembershipTransfer } from './executeObjectMove'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => { await fn() }),
}))

jest.mock('../../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getMembershipContainers: jest.fn(),
            getLudicGraph: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Simulates `MultiKeyUpdate`'s fetch + reducer invocation, matching the pattern
 * `applyObjectRoomMembership.test.ts`/`applyObjectClearMembership.test.ts` already establish.
 */
const wireTransactWrite = (graphsByHost: Record<string, EphemeraLudicGraph>) => {
    (ephemeraDB.transactWrite as jest.Mock).mockImplementation(async (items: any[]): Promise<void> => {
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        if (!multiKeyItem) {
            return
        }
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            const graph = graphsByHost[key.EphemeraId]
            draft[`${key.EphemeraId}#${key.DataCategory}`] = {
                EphemeraId: key.EphemeraId,
                DataCategory: key.DataCategory,
                ludicGraph: graph.toStored(),
            }
        })
        multiKeyItem.reducer(draft)
    })
}

describe('executeMembershipTransfer', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips the commit when the endpoint is unchanged', async () => {
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: FROM_ROOM,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual({ ok: true, froms: [], to: FROM_ROOM, changed: false })
        expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
    })

    it('places an object into a room (room -> room), sweeping the departure boundary', async () => {
        const fromRoomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'Against' }],
        })
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : toRoomGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved'])
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
    })

    it('spawn shape: empty priorContainers, no sweep, no dissolve facts', async () => {
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(toRoomGraph)
        wireTransactWrite({ [TO_ROOM]: toRoomGraph })

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual(expect.objectContaining({ ok: true, froms: [], to: TO_ROOM, changed: true }))
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Moved'])
    })

    it('clear shape: sweeps every current host (any kind), target null, no arrival row', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, CHARACTER_ID]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? roomGraph : characterGraph
        )
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [CHARACTER_ID]: characterGraph })

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: null,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM, CHARACTER_ID],
            to: null,
            changed: true,
        }))
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({ type: 'Object Moved', froms: [FROM_ROOM, CHARACTER_ID], to: null }),
        }))
    })

    it('suppressRelationalFacts: true suppresses the dissolve fact, Object Moved still streams (drift-repair usage)', async () => {
        const fromRoomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'Against' }],
        })
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : toRoomGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
            suppressRelationalFacts: true,
        })

        expect(result.ok).toBe(true)
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Moved'])
    })

    it('character entity: never runs the boundary sweep (no departure-graph fetch), only Character Moved streams', async () => {
        const fromRoomGraph = testLudicGraph(FROM_ROOM, { nodes: [{ tag: 'Character', universalKey: CHARACTER_ID }] })
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(toRoomGraph)
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await executeMembershipTransfer({
            entityId: CHARACTER_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
            characterNames: new Map([[CHARACTER_ID, 'Alpha']]),
        })

        expect(result.ok).toBe(true)
        expect(internalCache.Positions.getLudicGraph).not.toHaveBeenCalledWith(FROM_ROOM)
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Character Moved'])
    })

    it('compileMutationSteps override replaces the default bare transferMembership step', async () => {
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(toRoomGraph)
        wireTransactWrite({ [TO_ROOM]: toRoomGraph })

        const compileMutationSteps = jest.fn().mockReturnValue([{
            kind: 'transferMembership',
            entityIds: new Set([CHARACTER_ID]),
            fromHostIds: new Set<EphemeraRoomId>(),
            toHostId: TO_ROOM,
        }])

        const result = await executeMembershipTransfer({
            entityId: CHARACTER_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
            compileMutationSteps,
            characterNames: new Map([[CHARACTER_ID, 'Alpha']]),
        })

        expect(compileMutationSteps).toHaveBeenCalledWith({ froms: [], to: TO_ROOM, changed: true })
        expect(result.ok).toBe(true)
    })

    it("removing the interior (port-owning) side of a crossing dissolves both legs and the port in one transact --- the 'silent orphan' failure mode this row fixes", async () => {
        const port = { portId: 'port-1', fromHostId: FROM_ROOM, kind: 'Custom' as const, exteriorRelationLabel: 'to' }
        const roomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [{ tag: 'Object', universalKey: OBJECT_ID }, { tag: 'Object', universalKey: TABLE_ID }],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: { owner: TABLE_ID, port: 'port-1' } as any, kind: 'Custom', relationLabel: 'to' }],
        })
        const tableGraph = testLudicGraph(TABLE_ID, {
            nodes: [{ tag: 'Object', universalKey: TABLE_ID }, { tag: 'Object', universalKey: 'OBJECT#Cup' as EphemeraObjectId }],
            edges: [{ tag: 'Relational', from: { owner: TABLE_ID, port: 'port-1' } as any, to: 'OBJECT#Cup' as EphemeraObjectId, kind: 'Custom', relationLabel: 'to' }],
            ports: [port],
        } as any);
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockImplementation(async (id: string) =>
            id === TABLE_ID ? [FROM_ROOM] : []
        );
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? roomGraph : hostId === TABLE_ID ? tableGraph : testLudicGraph(hostId as EphemeraRoomId, { nodes: [] })
        )
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [TABLE_ID]: tableGraph })

        // TABLE_ID is the port's own *owner* --- removing it entirely (target: null) is exactly
        // the case that used to delete the port record and its interior leg outright while
        // leaving the room's exterior leg dangling, since the old boundary sweep only ever
        // inspected TABLE_ID's *own* containers, never its *owned* graph.
        const result = await executeMembershipTransfer({
            entityId: TABLE_ID,
            target: null,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result.ok).toBe(true)
        const [items] = (ephemeraDB.transactWrite as jest.Mock).mock.calls[0]
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        const touchedHostIds = multiKeyItem.Keys.map((key: { EphemeraId: string }) => key.EphemeraId)
        expect(touchedHostIds).toEqual(expect.arrayContaining([FROM_ROOM, TABLE_ID]))
    })

    it("removing the exterior (primitive-endpoint) side of a crossing dissolves both legs and the port too --- the fail-closed batch-breaking failure mode this row fixes", async () => {
        const port = { portId: 'port-1', fromHostId: FROM_ROOM, kind: 'Custom' as const, exteriorRelationLabel: 'to' }
        const roomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [{ tag: 'Object', universalKey: OBJECT_ID }, { tag: 'Object', universalKey: TABLE_ID }],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: { owner: TABLE_ID, port: 'port-1' } as any, kind: 'Custom', relationLabel: 'to' }],
        })
        const tableGraph = testLudicGraph(TABLE_ID, {
            nodes: [{ tag: 'Object', universalKey: TABLE_ID }, { tag: 'Object', universalKey: 'OBJECT#Cup' as EphemeraObjectId }],
            edges: [{ tag: 'Relational', from: { owner: TABLE_ID, port: 'port-1' } as any, to: 'OBJECT#Cup' as EphemeraObjectId, kind: 'Custom', relationLabel: 'to' }],
            ports: [port],
        } as any);
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockImplementation(async (id: string) =>
            id === OBJECT_ID ? [FROM_ROOM] : []
        );
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? roomGraph : hostId === TABLE_ID ? tableGraph : testLudicGraph(hostId as EphemeraRoomId, { nodes: [] })
        )
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [TABLE_ID]: tableGraph })

        // OBJECT_ID (the exterior/room-side primitive endpoint) is what the old boundary
        // sweep already dissolved correctly for a *plain* edge --- but it always skipped this
        // edge outright, since its far endpoint is a port address, not a primitive. Without the
        // fix, `removeObject` would throw here instead of committing cleanly.
        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: null,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result.ok).toBe(true)
        const [items] = (ephemeraDB.transactWrite as jest.Mock).mock.calls[0]
        const multiKeyItem = items.find((item: any) => 'MultiKeyUpdate' in item)?.MultiKeyUpdate
        const touchedHostIds = multiKeyItem.Keys.map((key: { EphemeraId: string }) => key.EphemeraId)
        expect(touchedHostIds).toEqual(expect.arrayContaining([FROM_ROOM, TABLE_ID]))
    })

    it('propagates commitStepSequence failure as errorCode/errorMessage', async () => {
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(toRoomGraph);
        (ephemeraDB.transactWrite as jest.Mock).mockRejectedValue(new Error('boom'))

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual({
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'boom',
        })
    })
})
