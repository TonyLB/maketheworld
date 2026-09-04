import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

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
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
            getLudicGraph: jest.fn(),
        },
    },
}))

jest.mock('../../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../../internalCache'
import { executeObjectMove } from './executeObjectMove'
import { testLudicGraph } from '../../ludicGraph/testFixtures'
import type { EphemeraLudicGraph } from '../../ludicGraph'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const TRAY2_ID = 'OBJECT#Tray2' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER_ID = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

/**
 * Simulates `MultiKeyUpdate`'s fetch + reducer invocation, matching the pattern
 * `commitStepSequence.test.ts` already establishes.
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

describe('executeObjectMove', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('room -> character (take-hold)', () => {
        it('re-derives the carry closure fresh and commits via the general kernel', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })

            expect(ephemeraDB.transactWrite).toHaveBeenCalledTimes(1)
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                update: expect.objectContaining({ type: 'Object Moved', objectId: TRAY_ID }),
            }))
            expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
                componentId: TRAY_ID,
                containers: [CHARACTER_ID],
            })
        })

        // The former "carrying the tray severs tray-table" test is retired 2026-08-22 (Channel D,
        // CD2, reduced scope): its whole point was `On`'s carry absorption (glass -On-> tray
        // pulling glass into the moved set), which is now dead -- `On` joined `In`/`PartOf`'s
        // hosting-kind throw, and `carry` is unreachable from any relation kind. Real
        // shard-based hosting (CD2h) is what carries the glass along again as of PV1-2, by
        // construction (it lives in the tray's own shard) rather than via this closure walk ---
        // see the `On rehost` describe block below for that case.
        it('BD-28: an unrelated boundary edge on an object outside the carried set is untouched', async () => {
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
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
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
            // cup-chandelier is untouched --- cup was never pulled into the tray's closure.
            expect(streamEvent).not.toHaveBeenCalledWith(expect.objectContaining({
                update: expect.objectContaining({ subjectId: CUP_ID }),
            }))
        })

        it('no-ops when objectIds is empty', async () => {
            await executeObjectMove({
                objectIds: [],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })
            expect(streamEvent).not.toHaveBeenCalled()
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
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: CUP_ID }], edges: [] })
            // LP4i: a real host-bound graph's own root node is present in `nodes`; `testLudicGraph`
            // does not add it automatically the way the production factories do, so fixtures that
            // need `findHostOf` to resolve the host's own id (the containment edge's target) must
            // include it explicitly.
            const trayGraph = testLudicGraph(TRAY_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const cupOwnGraph = testLudicGraph(CUP_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === CHARACTER_ID ? characterGraph : trayGraph
            )
            wireTransactWrite({ [CHARACTER_ID]: characterGraph, [TRAY_ID]: trayGraph, [CUP_ID]: cupOwnGraph })

            const result = await executeObjectMove({
                objectIds: [CUP_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: CHARACTER_ID,
                toHostId: TRAY_ID,
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

        it('moved tray-to-tray: old containment edge dissolves with no executor throw, port moves to the new tray', async () => {
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

            const result = await executeObjectMove({
                objectIds: [CUP_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: TRAY_ID,
                toHostId: TRAY2_ID,
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
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            const cupOwnGraph = testLudicGraph(CUP_ID, { nodes: [], edges: [], ports: [{ portId: 'old-port', fromHostId: TRAY_ID, kind: 'Present' }] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === TRAY_ID ? trayGraph : characterGraph
            )
            wireTransactWrite({ [TRAY_ID]: trayGraph, [CHARACTER_ID]: characterGraph, [CUP_ID]: cupOwnGraph })

            const result = await executeObjectMove({
                objectIds: [CUP_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: TRAY_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a successful commit') }
            expect(result.plan.steps.some((step) => step.kind === 'establishRelation')).toBe(false)

            const committedTrayGraph = committedGraph(TRAY_ID)
            expect(committedTrayGraph.objectIds.has(CUP_ID)).toBe(false)
            expect(committedTrayGraph.relationalEdges).toEqual([])

            const committedCupGraph = committedGraph(CUP_ID)
            expect(committedCupGraph.ports).toEqual([
                expect.objectContaining({ fromHostId: CHARACTER_ID, kind: 'Present' }),
            ])
        })
    })

    describe('character -> room (drop)', () => {
        it('re-derives the carry closure fresh and commits via the general kernel', async () => {
            const emptyRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
            const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? emptyRoomGraph : characterGraph
            )
            wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
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
            const characterGraph = testLudicGraph(CHARACTER_ID, {
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
            wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
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

        it('no-ops when objectIds is empty', async () => {
            await executeObjectMove({
                objectIds: [],
                bundleId: 'BUNDLE#test',
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
                messageBus: messageBus as any,
                streamEvent,
            })
            expect(streamEvent).not.toHaveBeenCalled()
            expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        })
    })
    /**
     * Phase 4 changed the return shape: the plan and the commit's captured rosters travel out so
     * `orchestrateObjectMove` can narrate from them. These cases pin the structural guard that
     * narration can never outrun a commit.
     */
    describe('result shape (Phase 4)', () => {
        it('returns the compiled plan and the commit captures on success', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            const result = await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                narration: { characterName: 'Alice', objectShortName: 'tray' },
                messageBus: messageBus as any,
                streamEvent,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a successful commit') }
            expect(result.plan.steps.map((step) => step.kind)).toEqual([
                'capture', 'transferMembership', 'setPresencePort', 'capture', 'narrate', 'narrate',
            ])
            expect(result.captures.get('capture:from:' + ROOM_ID)).toBeDefined()
        })

        it('compiles no capture steps when narration is absent (object-lifecycle move)', async () => {
            const roomGraph = testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph, [TRAY_ID]: testLudicGraph(TRAY_ID) })

            const result = await executeObjectMove({
                objectIds: [TRAY_ID],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })

            expect(result.ok).toBe(true)
            if (!result.ok) { throw new Error('expected a successful commit') }
            // Captures exist only to serve narration; a silent move should not lock hosts to
            // snapshot rosters nobody will read.
            expect(result.plan.steps.map((step) => step.kind)).toEqual(['transferMembership', 'setPresencePort'])
        })

        it('returns ok: false without committing when the executor verdict is not legal', async () => {
            const emptyRoomGraph = testLudicGraph(ROOM_ID, { nodes: [], edges: [] })
            const emptyCharacterGraph = testLudicGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? emptyRoomGraph : emptyCharacterGraph
            )

            const result = await executeObjectMove({
                objectIds: [],
                bundleId: 'BUNDLE#test',
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                narration: { characterName: 'Alice', objectShortName: 'tray' },
                messageBus: messageBus as any,
                streamEvent,
            })

            // No `captures` on this branch by construction --- there is no way to reach
            // `presentStepSequence` with an audience for a move that did not happen.
            expect(result).toEqual({ ok: false })
            expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        })
    })
})
