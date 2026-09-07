import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { executeMembershipTransfer } from './executeMembershipTransfer'
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

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TRAY2_ID = 'OBJECT#Tray2' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const CHANDELIER_ID = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const TAKE_DROP_CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

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
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] })
        const ownGraph = testLudicGraph(OBJECT_ID, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : hostId === TO_ROOM ? toRoomGraph : ownGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph, [OBJECT_ID]: ownGraph })

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
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] })
        const ownGraph = testLudicGraph(OBJECT_ID, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === TO_ROOM ? toRoomGraph : ownGraph
        )
        wireTransactWrite({ [TO_ROOM]: toRoomGraph, [OBJECT_ID]: ownGraph })

        const result = await executeMembershipTransfer({
            entityId: OBJECT_ID,
            target: TO_ROOM,
            messageBus: messageBus as any,
            streamEvent,
        })

        expect(result).toEqual(expect.objectContaining({ ok: true, froms: [], to: TO_ROOM, changed: true }))
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Moved'])

        // RD-3/RD-1: the default (no compileMutationSteps) path now mints a presence port too,
        // not just a bare transferMembership step.
        const committedOwnGraph = (internalCache.Positions.set as jest.Mock).mock.calls
            .map(([graph]: any[]) => graph)
            .find((graph: EphemeraLudicGraph) => graph.hostId === OBJECT_ID)
        expect(committedOwnGraph?.ports).toEqual([
            expect.objectContaining({ fromHostId: TO_ROOM, kind: 'Present' }),
        ])
    })

    it('clear shape: sweeps every current host (any kind), target null, no arrival row', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        const ownGraph = testLudicGraph(OBJECT_ID, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, CHARACTER_ID]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? roomGraph : hostId === CHARACTER_ID ? characterGraph : ownGraph
        )
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [CHARACTER_ID]: characterGraph, [OBJECT_ID]: ownGraph })

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

        // The missing-clear fix: a departure to no host still removes every prior binding, even
        // though there is no destination to add one for.
        const committedOwnGraph = (internalCache.Positions.set as jest.Mock).mock.calls
            .map(([graph]: any[]) => graph)
            .find((graph: EphemeraLudicGraph) => graph.hostId === OBJECT_ID)
        expect(committedOwnGraph?.ports).toEqual([])
    })

    it('suppressRelationalFacts: true suppresses the dissolve fact, Object Moved still streams (drift-repair usage)', async () => {
        const fromRoomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'Against' }],
        })
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] })
        const ownGraph = testLudicGraph(OBJECT_ID, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : hostId === TO_ROOM ? toRoomGraph : ownGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph, [OBJECT_ID]: ownGraph })

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
        const toRoomGraph = testLudicGraph(TO_ROOM, { nodes: [] })
        const ownGraph = testLudicGraph(CHARACTER_ID, { nodes: [] });
        (internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM]);
        (internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === TO_ROOM ? toRoomGraph : ownGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph, [CHARACTER_ID]: ownGraph })

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
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [TABLE_ID]: tableGraph, [OBJECT_ID]: testLudicGraph(OBJECT_ID, { nodes: [] }) })

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

    /**
     * `honorDefer: true` --- take/drop/give's own mode, absorbed from the retired
     * `executeObjectMove` (MS-8, 2026-09-07). These cases pin the single-hop, defer-aware boundary
     * check and the hosting-edge stripping that mode alone exercises; every case above pins the
     * chain-aware, unconditional default every other caller gets.
     */
    describe('honorDefer: true (take/drop/give)', () => {
        describe('room -> character (take-hold)', () => {
            it('re-derives the boundary classification fresh and commits via the general kernel', async () => {
                const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
                const emptyCharacterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
                )
                wireTransactWrite({ [ROOM_ID]: roomGraph, [TAKE_DROP_CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [ROOM_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(ephemeraDB.transactWrite).toHaveBeenCalledTimes(1)
                expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                    update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
                }))
                expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
                    componentId: TRAY_ID,
                    containers: [TAKE_DROP_CHARACTER_ID],
                })
            })

            // The former "carrying the tray severs tray-table" test is retired 2026-08-22 (Channel D,
            // CD2, reduced scope): its whole point was `On`'s carry absorption (glass -On-> tray
            // pulling glass into the moved set), which is now dead -- `On` joined `In`/`PartOf`'s
            // hosting-kind throw, and `carry` is unreachable from any relation kind. Real
            // shard-based hosting (CD2h) is what carries the glass along again, by
            // construction (it lives in the tray's own shard) rather than via this closure walk ---
            // see the `On rehost` describe block below for that case.
            it('BD-28: an unrelated boundary edge on an object outside the transfer set is untouched', async () => {
                const roomGraph = testLudicGraph(ROOM_ID, {
                    nodes: [
                        { tag: 'Object', universalKey: TRAY_ID },
                        { tag: 'Object', universalKey: CUP_ID },
                        { tag: 'Object', universalKey: TABLE_ID },
                        { tag: 'Object', universalKey: CHANDELIER_ID },
                    ],
                    edges: [
                        { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Against' },
                        { tag: 'Relational', from: CUP_ID, to: CHANDELIER_ID, kind: 'Under' },
                    ],
                })
                const emptyCharacterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
                )
                wireTransactWrite({ [ROOM_ID]: roomGraph, [TAKE_DROP_CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [ROOM_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                    update: expect.objectContaining({
                        type: 'Object Relation Changed',
                        subjectId: TRAY_ID,
                        targetId: TABLE_ID,
                    }),
                }))
                // cup-chandelier is untouched --- cup was never in the transfer set.
                expect(streamEvent).not.toHaveBeenCalledWith(expect.objectContaining({
                    update: expect.objectContaining({ subjectId: CUP_ID }),
                }))
            })

            it('refuses the move (ok: false, no commit) when a boundary edge defers (Under, subject-move)', async () => {
                const roomGraph = testLudicGraph(ROOM_ID, {
                    nodes: [
                        { tag: 'Object', universalKey: TRAY_ID },
                        { tag: 'Object', universalKey: CHANDELIER_ID },
                    ],
                    edges: [{ tag: 'Relational', from: TRAY_ID, to: CHANDELIER_ID, kind: 'Under' }],
                })
                const emptyCharacterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
                )

                const result = await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [ROOM_ID],
                    bundleId: 'BUNDLE#test',
                    narration: { characterName: 'Alice', objectShortName: 'tray' },
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result).toEqual({ ok: false })
                expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
            })
        })

        /**
         * `On` nests end to end, as a rehost carrying a containment argument. Asserts the
         * checklist's own "Done when" bar directly --- member of the destination's graph (not the
         * room's), a root-anchored containment edge inside it, a presence port naming the
         * destination, and both gone when the object leaves.
         */
        describe('On rehost', () => {
            const committedGraph = (hostId: string): EphemeraLudicGraph => {
                const call = (internalCache.Positions.set as jest.Mock).mock.calls
                    .map(([graph]: [EphemeraLudicGraph]) => graph)
                    .find((graph: EphemeraLudicGraph) => graph.hostId === hostId)
                if (!call) { throw new Error(`No committed graph found for ${hostId}`) }
                return call
            }

            it('put on an empty tray: member of the tray graph, root-anchored edge, presence port naming the tray', async () => {
                const characterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: CUP_ID }], edges: [] })
                // LP4i: a real host-bound graph's own root node is present in `nodes`; `testLudicGraph`
                // does not add it automatically the way the production factories do, so fixtures that
                // need `findHostOf` to resolve the host's own id (the containment edge's target) must
                // include it explicitly.
                const trayGraph = testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
                const cupOwnGraph = testLudicGraph(CUP_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === TAKE_DROP_CHARACTER_ID ? characterGraph : trayGraph
                )
                wireTransactWrite({ [TAKE_DROP_CHARACTER_ID]: characterGraph, [TRAY_ID]: trayGraph, [CUP_ID]: cupOwnGraph })

                const result = await executeMembershipTransfer({
                    entityId: CUP_ID,
                    target: TRAY_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [TAKE_DROP_CHARACTER_ID],
                    bundleId: 'BUNDLE#test',
                    containment: 'On',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result.ok).toBe(true)

                const committedTrayGraph = committedGraph(TRAY_ID)
                expect(committedTrayGraph.objectIds.has(CUP_ID)).toBe(true)
                expect(committedTrayGraph.relationalEdges).toEqual([{ from: CUP_ID, to: TRAY_ID, kind: 'On' }])

                const committedCupGraph = committedGraph(CUP_ID)
                expect(committedCupGraph.ports).toEqual([
                    expect.objectContaining({ fromHostId: TRAY_ID, kind: 'Present' }),
                ])
            })

            it('moved tray-to-tray: old containment edge dissolves with no throw, port moves to the new tray', async () => {
                const tray1Graph = testLudicGraph(TRAY_ID, {
                    nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: CUP_ID }],
                    edges: [{ tag: 'Relational', from: CUP_ID, to: TRAY_ID, kind: 'On' }],
                })
                const tray2Graph = testLudicGraph(TRAY2_ID, { nodes: [{ tag: 'Object', universalKey: TRAY2_ID }], edges: [] })
                const cupOwnGraph = testLudicGraph(CUP_ID, { nodes: [], edges: [], ports: [{ portId: 'old-port', fromHostId: TRAY_ID, kind: 'Present' }] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === TRAY_ID ? tray1Graph : tray2Graph
                )
                wireTransactWrite({ [TRAY_ID]: tray1Graph, [TRAY2_ID]: tray2Graph, [CUP_ID]: cupOwnGraph })

                const result = await executeMembershipTransfer({
                    entityId: CUP_ID,
                    target: TRAY2_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [TRAY_ID],
                    bundleId: 'BUNDLE#test',
                    containment: 'On',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result.ok).toBe(true)

                const committedTray1Graph = committedGraph(TRAY_ID)
                expect(committedTray1Graph.objectIds.has(CUP_ID)).toBe(false)
                expect(committedTray1Graph.relationalEdges).toEqual([])

                const committedTray2Graph = committedGraph(TRAY2_ID)
                expect(committedTray2Graph.objectIds.has(CUP_ID)).toBe(true)
                expect(committedTray2Graph.relationalEdges).toEqual([{ from: CUP_ID, to: TRAY2_ID, kind: 'On' }])

                const committedCupGraph = committedGraph(CUP_ID)
                expect(committedCupGraph.ports).toEqual([
                    expect.objectContaining({ fromHostId: TRAY2_ID, kind: 'Present' }),
                ])
            })

            it('taken off with no containment: edge dissolves, presence port still moves to the new host', async () => {
                const trayGraph = testLudicGraph(TRAY_ID, {
                    nodes: [{ tag: 'Object', universalKey: TRAY_ID }, { tag: 'Object', universalKey: CUP_ID }],
                    edges: [{ tag: 'Relational', from: CUP_ID, to: TRAY_ID, kind: 'On' }],
                })
                const characterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                const cupOwnGraph = testLudicGraph(CUP_ID, { nodes: [], edges: [], ports: [{ portId: 'old-port', fromHostId: TRAY_ID, kind: 'Present' }] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === TRAY_ID ? trayGraph : characterGraph
                )
                wireTransactWrite({ [TRAY_ID]: trayGraph, [TAKE_DROP_CHARACTER_ID]: characterGraph, [CUP_ID]: cupOwnGraph })

                const result = await executeMembershipTransfer({
                    entityId: CUP_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [TRAY_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result.ok).toBe(true)
                if (!result.ok) { throw new Error('expected a successful commit') }
                expect(result.plan?.steps.some((step) => step.kind === 'establishRelation')).toBe(false)

                const committedTrayGraph = committedGraph(TRAY_ID)
                expect(committedTrayGraph.objectIds.has(CUP_ID)).toBe(false)
                expect(committedTrayGraph.relationalEdges).toEqual([])

                const committedCupGraph = committedGraph(CUP_ID)
                expect(committedCupGraph.ports).toEqual([
                    expect.objectContaining({ fromHostId: TAKE_DROP_CHARACTER_ID, kind: 'Present' }),
                ])
            })
        })

        describe('character -> room (drop)', () => {
            it('re-derives the boundary classification fresh and commits via the general kernel', async () => {
                const emptyRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
                const characterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? emptyRoomGraph : characterGraph
                )
                wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [TAKE_DROP_CHARACTER_ID]: characterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: ROOM_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [TAKE_DROP_CHARACTER_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(ephemeraDB.transactWrite).toHaveBeenCalledTimes(1)
                expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                    update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
                }))
                expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
                    componentId: TRAY_ID,
                    containers: [ROOM_ID],
                })
            })

            it('BD-28: dropping the tray severs tray-table (tray stays boundary-clean, table stays held) and streams the fact', async () => {
                const emptyRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
                const characterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, {
                    nodes: [
                        { tag: 'Object', universalKey: TRAY_ID },
                        { tag: 'Object', universalKey: TABLE_ID },
                    ],
                    edges: [
                        // tray Against table: tray is the subject (`from`) role --- dropping the tray
                        // alone dissolves this boundary edge. (Was `On` before Channel D CD2, 2026-08-22
                        // joined it to `In`/`PartOf`'s hosting-kind throw; `Against` exercises the same
                        // subject-role dissolve outcome and remains live.)
                        { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'Against' },
                    ],
                })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? emptyRoomGraph : characterGraph
                )
                wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [TAKE_DROP_CHARACTER_ID]: characterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: ROOM_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [TAKE_DROP_CHARACTER_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                    update: expect.objectContaining({
                        type: 'Object Relation Changed',
                        subjectId: TRAY_ID,
                        targetId: TABLE_ID,
                    }),
                }))
            })
        })

        /**
         * Phase 4 changed the return shape: the plan and the commit's captured rosters travel out so
         * `orchestrateObjectMove` can narrate from them. These cases pin the structural guard that
         * narration can never outrun a commit.
         */
        describe('result shape', () => {
            it('returns the compiled plan and the commit captures on success', async () => {
                const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
                const emptyCharacterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
                )
                wireTransactWrite({ [ROOM_ID]: roomGraph, [TAKE_DROP_CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                const result = await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [ROOM_ID],
                    bundleId: 'BUNDLE#test',
                    narration: { characterName: 'Alice', objectShortName: 'tray' },
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result.ok).toBe(true)
                if (!result.ok) { throw new Error('expected a successful commit') }
                expect(result.plan?.steps.map((step) => step.kind)).toEqual([
                    'capture', 'transferMembership', 'removePresencePort', 'addPresencePort', 'capture', 'narrate', 'narrate',
                ])
                expect(result.captures?.get('capture:from:' + ROOM_ID)).toBeDefined()
            })

            it('compiles no capture steps when narration is absent (object-lifecycle move)', async () => {
                const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
                const emptyCharacterGraph = testLudicGraph(TAKE_DROP_CHARACTER_ID, { nodes: [], edges: [] })
                ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                    hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
                )
                wireTransactWrite({ [ROOM_ID]: roomGraph, [TAKE_DROP_CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

                const result = await executeMembershipTransfer({
                    entityId: TRAY_ID,
                    target: TAKE_DROP_CHARACTER_ID,
                    honorDefer: true,
                    getMembershipContainers: async () => [ROOM_ID],
                    bundleId: 'BUNDLE#test',
                    messageBus: messageBus as any,
                    streamEvent,
                })

                expect(result.ok).toBe(true)
                if (!result.ok) { throw new Error('expected a successful commit') }
                // Captures exist only to serve narration; a silent move should not lock hosts to
                // snapshot rosters nobody will read.
                expect(result.plan?.steps.map((step) => step.kind)).toEqual(['transferMembership', 'removePresencePort', 'addPresencePort'])
            })
        })
    })
})
