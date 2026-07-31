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
            getPositionGraph: jest.fn(),
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
import { testPositionGraph } from '../../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../../positionGraph'

const TRAY_ID = 'OBJECT#Tray' as EphemeraObjectId
const GLASS_ID = 'OBJECT#Glass' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CHANDELIER_ID = 'OBJECT#Chandelier' as EphemeraObjectId
const ROOM_ID = 'ROOM#TownSquare' as EphemeraRoomId
const CHARACTER_ID = 'CHARACTER#alpha' as EphemeraCharacterId

/**
 * Simulates `MultiKeyUpdate`'s fetch + reducer invocation, matching the pattern
 * `commitStepSequence.test.ts` already establishes.
 */
const wireTransactWrite = (graphsByHost: Record<string, EphemeraPositionGraph>) => {
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
                positionGraph: graph.toStored(),
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
            const roomGraph = testPositionGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

            await executeObjectMove({
                objectIds: [TRAY_ID],
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

        it('BD-28: carrying the tray severs tray-table and streams an Object Relation Changed fact for it, previously silent', async () => {
            const roomGraph = testPositionGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: GLASS_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [
                    { tag: 'Relational', from: GLASS_ID, to: TRAY_ID, kind: 'On' },
                    { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
                ],
            })
            const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

            await executeObjectMove({
                objectIds: [TRAY_ID, GLASS_ID],
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })

            const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
            // Dissolve fact streams before the moved facts (output-ordered per BD-28/BD-30).
            expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved', 'Object Moved'])
            expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
                update: expect.objectContaining({
                    type: 'Object Relation Changed',
                    subjectId: TRAY_ID,
                    targetId: TABLE_ID,
                }),
            }))
        })

        it('BD-28: an unrelated boundary edge on an object outside the carried set is untouched', async () => {
            const roomGraph = testPositionGraph(ROOM_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: CUP_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                    { tag: 'Object', universalKey: CHANDELIER_ID },
                ],
                edges: [
                    { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
                    { tag: 'Relational', from: CUP_ID, to: CHANDELIER_ID, kind: 'Under' },
                ],
            })
            const emptyCharacterGraph = testPositionGraph(CHARACTER_ID, { nodes: [], edges: [] })
            ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? roomGraph : emptyCharacterGraph
            )
            wireTransactWrite({ [ROOM_ID]: roomGraph, [CHARACTER_ID]: emptyCharacterGraph })

            await executeObjectMove({
                objectIds: [TRAY_ID],
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
                fromHostId: ROOM_ID,
                toHostId: CHARACTER_ID,
                messageBus: messageBus as any,
                streamEvent,
            })
            expect(streamEvent).not.toHaveBeenCalled()
            expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        })
    })

    describe('character -> room (drop)', () => {
        it('re-derives the carry closure fresh and commits via the general kernel', async () => {
            const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })
            const characterGraph = testPositionGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: TRAY_ID }], edges: [] })
            ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? emptyRoomGraph : characterGraph
            )
            wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph })

            await executeObjectMove({
                objectIds: [TRAY_ID],
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
            const emptyRoomGraph = testPositionGraph(ROOM_ID, { nodes: [], edges: [] })
            const characterGraph = testPositionGraph(CHARACTER_ID, {
                nodes: [
                    { tag: 'Object', universalKey: TRAY_ID },
                    { tag: 'Object', universalKey: TABLE_ID },
                ],
                edges: [
                    // tray On table: tray is the subject (`from`) role --- dropping the tray alone
                    // dissolves this boundary edge rather than carrying the table along.
                    { tag: 'Relational', from: TRAY_ID, to: TABLE_ID, kind: 'On' },
                ],
            })
            ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
                hostId === ROOM_ID ? emptyRoomGraph : characterGraph
            )
            wireTransactWrite({ [ROOM_ID]: emptyRoomGraph, [CHARACTER_ID]: characterGraph })

            await executeObjectMove({
                objectIds: [TRAY_ID],
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
                fromHostId: CHARACTER_ID,
                toHostId: ROOM_ID,
                messageBus: messageBus as any,
                streamEvent,
            })
            expect(streamEvent).not.toHaveBeenCalled()
            expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        })
    })
})
