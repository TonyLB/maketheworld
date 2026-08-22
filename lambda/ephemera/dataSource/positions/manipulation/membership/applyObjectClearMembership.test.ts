import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectClearMembership } from './applyObjectClearMembership'
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
const CHARACTER_ID = 'CHARACTER#Alpha' as EphemeraCharacterId

/**
 * Simulates `MultiKeyUpdate`'s fetch + reducer invocation, matching the pattern
 * `commitStepSequence.test.ts`/`executeObjectMove.test.ts` already establish. Exposes the
 * mutated draft so a test can inspect final graph state directly, without re-invoking the reducer.
 */
const wireTransactWrite = (graphsByHost: Record<string, EphemeraLudicGraph>) => {
    const lastDraft: { current: Record<string, any> | undefined } = { current: undefined }
    ;(ephemeraDB.transactWrite as jest.Mock).mockImplementation(async (items: any[]): Promise<void> => {
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
        lastDraft.current = draft
    })
    return lastDraft
}

describe('applyObjectClearMembership', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('skips side-effect bundle when object is not on any host', async () => {
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([])

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual({
            ok: true,
            froms: [],
            to: null,
            changed: false,
        })
        expect(ephemeraDB.transactWrite).not.toHaveBeenCalled()
    })

    it('clears character inventory and streams Object Moved', async () => {
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([CHARACTER_ID])
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(characterGraph)
        wireTransactWrite({ [CHARACTER_ID]: characterGraph })

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result).toEqual(expect.objectContaining({
            ok: true,
            froms: [CHARACTER_ID],
            to: null,
            changed: true,
            beatAnchorTime: 1_700_000_000_000,
        }))
        expect(internalCache.Positions.set).toHaveBeenCalled()
        expect(internalCache.Positions.setMembershipContainers).toHaveBeenCalledWith({
            componentId: OBJECT_ID,
            containers: [],
        })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: OBJECT_ID,
            header: { type: 'Object Moved' },
            update: expect.objectContaining({
                type: 'Object Moved',
                objectId: OBJECT_ID,
                froms: [CHARACTER_ID],
                to: null,
            }),
        })
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('clears room placement and publishes RoomUpdate', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(roomGraph)
        wireTransactWrite({ [FROM_ROOM]: roomGraph })

        await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(messageBus.publish).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: FROM_ROOM,
        })
    })

    it('BD-35: destroying an object with a relational edge dissolves it and streams Object Relation Changed --- dissolve only, no cascade', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Object', universalKey: TABLE_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: TABLE_ID, kind: 'Against' }],
        })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(roomGraph)
        const lastDraft = wireTransactWrite({ [FROM_ROOM]: roomGraph })

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
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

        // Dissolve only, no cascade: the table --- the other endpoint of the severed relation --- was
        // never carried along or removed. It stays on the room's graph exactly as before.
        const { EphemeraLudicGraph } = require('../../ludicGraph')
        const finalRoomGraph = EphemeraLudicGraph.fromFieldPayload(
            FROM_ROOM,
            lastDraft.current![`${FROM_ROOM}#Meta::Room`].ludicGraph
        )
        expect(finalRoomGraph.objectIds.has(TABLE_ID)).toBe(true)
        expect(finalRoomGraph.objectIds.has(OBJECT_ID)).toBe(false)
    })

    it('LP4g: destroying an object with a relational edge to a non-Object (Character) endpoint dissolves it, no throw', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, {
            nodes: [
                { tag: 'Object', universalKey: OBJECT_ID },
                { tag: 'Character', universalKey: CHARACTER_ID },
            ],
            edges: [{ tag: 'Relational', from: OBJECT_ID, to: CHARACTER_ID, kind: 'Against' }],
        })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM])
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockResolvedValue(roomGraph)
        wireTransactWrite({ [FROM_ROOM]: roomGraph })

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

        expect(result.ok).toBe(true)
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            update: expect.objectContaining({
                type: 'Object Relation Changed',
                subjectId: OBJECT_ID,
                targetId: CHARACTER_ID,
                operation: 'dissolve',
            }),
        }))
    })

    it('BD-35: destroying an object present on multiple hosts sweeps each host and clears from all', async () => {
        const roomGraph = testLudicGraph(FROM_ROOM, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        const characterGraph = testLudicGraph(CHARACTER_ID, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
        ;(internalCache.Positions.getMembershipContainers as jest.Mock).mockResolvedValue([FROM_ROOM, CHARACTER_ID])
        ;(internalCache.Positions.getLudicGraph as jest.Mock).mockImplementation(async (hostId: string) =>
            hostId === FROM_ROOM ? roomGraph : characterGraph
        )
        wireTransactWrite({ [FROM_ROOM]: roomGraph, [CHARACTER_ID]: characterGraph })

        const result = await applyObjectClearMembership(
            { objectId: OBJECT_ID },
            { messageBus: messageBus as any, streamEvent }
        )

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
})
