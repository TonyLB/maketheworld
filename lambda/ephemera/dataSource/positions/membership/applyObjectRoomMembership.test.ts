import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectRoomMembership } from './applyObjectRoomMembership'
import { testPositionGraph } from '../positionGraph/testFixtures'
import type { EphemeraPositionGraph } from '../positionGraph'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => { await fn() }),
}))

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: {
            getMembershipContainers: jest.fn(),
            getPositionGraph: jest.fn(),
            set: jest.fn(),
            setMembershipContainers: jest.fn(),
        },
    },
}))

jest.mock('../../../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn(() => 1_700_000_000_000),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../../internalCache'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const FROM_ROOM = 'ROOM#VORTEX' as EphemeraRoomId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

/**
 * Simulates `MultiKeyUpdate`'s fetch + reducer invocation, matching the pattern
 * `commitStepSequence.test.ts`/`executeObjectMove.test.ts` already establish.
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

describe('applyObjectRoomMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when placement endpoint is unchanged', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: FROM_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: FROM_ROOM,
            changed: false,
        })
        expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('runs membership-changed bundle when placement changes', async () => {
        const fromRoomGraph = testPositionGraph(FROM_ROOM, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        const toRoomGraph = testPositionGraph(TO_ROOM, { nodes: [] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : toRoomGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [FROM_ROOM],
            to: TO_ROOM,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: OBJECT_ID,
            header: { type: 'Object Moved' },
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [FROM_ROOM],
                to: TO_ROOM,
                beatAnchorTime: 1_700_000_000_000,
            }),
        })
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [TO_ROOM],
        })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: FROM_ROOM })
        expect(messageBus.publish).toHaveBeenCalledWith({ type: 'RoomUpdate', roomId: TO_ROOM })
        expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'EphemeraUpdate',
        }))
    })

    it('BD-35: a relational edge on the departure room dissolves --- streams Object Relation Changed, no cascade', async () => {
        const fromRoomGraph = testPositionGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'On' }],
        })
        const toRoomGraph = testPositionGraph(TO_ROOM, { nodes: [] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : toRoomGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result.ok).toBe(true)
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Relation Changed', 'Object Moved'])
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                type: 'Object Relation Changed',
                subjectId: OBJECT_ID,
                targetId: TABLE_ID,
                operation: 'dissolve',
            }),
        }))
    })

    it('suppressRelationalFacts: true suppresses the dissolve fact, Object Moved still streams (drift-repair usage)', async () => {
        const fromRoomGraph = testPositionGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'On' }],
        })
        const toRoomGraph = testPositionGraph(TO_ROOM, { nodes: [] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getPositionGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? fromRoomGraph : toRoomGraph
        )
        wireTransactWrite({ [FROM_ROOM]: fromRoomGraph, [TO_ROOM]: toRoomGraph })

        const result = await applyObjectRoomMembership(
            { objectId: OBJECT_ID, targetRoomId: TO_ROOM },
            { messageBus: messageBus as any, streamEvent, suppressRelationalFacts: true }
        )

        expect(result.ok).toBe(true)
        const eventTypes = streamEvent.mock.calls.map(([payload]: any[]) => payload.header.type)
        expect(eventTypes).toEqual(['Object Moved'])
    })
})
