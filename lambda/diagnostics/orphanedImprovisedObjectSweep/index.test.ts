import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: { query: jest.fn(), getItem: jest.fn() },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { orphanedImprovisedObjectSweep } from './index'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const TABLE_ID = 'OBJECT#Table' as EphemeraObjectId
const CUP_ID = 'OBJECT#Cup' as EphemeraObjectId

describe('orphanedImprovisedObjectSweep', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
    })

    it('emits finding for confirmed orphan', async () => {
        const result = await orphanedImprovisedObjectSweep(
            { objectIds: [OBJECT_ID], diagnosticRunId: 'run-1', nowMs: 1_700_000_000_000 },
            {
                getPairRow: async () => ({ EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({
                    EphemeraId: OBJECT_ID,
                    DataCategory: 'Meta::Object',
                    stableKey: 'skates',
                }),
                getMembershipContainers: async () => [],
                loadGraphObjectIds: async () => new Set(),
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 1, objectIds: [OBJECT_ID] })
        expect(emitFinding).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            diagnosticRunId: 'run-1',
            nowMs: 1_700_000_000_000,
            eventBusName: 'test-bus',
        })
    })

    it('does not emit finding when placement exists', async () => {
        const result = await orphanedImprovisedObjectSweep(
            { objectIds: [OBJECT_ID] },
            {
                getPairRow: async () => ({ EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({
                    EphemeraId: OBJECT_ID,
                    DataCategory: 'Meta::Object',
                    stableKey: 'skates',
                }),
                getMembershipContainers: async () => [ROOM_ID],
                loadGraphObjectIds: async () => new Set([OBJECT_ID]),
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, objectIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('does not emit finding for adjacency lag (graph node without containers)', async () => {
        const result = await orphanedImprovisedObjectSweep(
            { objectIds: [OBJECT_ID] },
            {
                getPairRow: async () => ({ EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({
                    EphemeraId: OBJECT_ID,
                    DataCategory: 'Meta::Object',
                    stableKey: 'skates',
                }),
                getMembershipContainers: async () => [],
                loadGraphObjectIds: async () => new Set([OBJECT_ID]),
                emitFinding,
            }
        )

        expect(result).toEqual({ emittedCount: 0, objectIds: [] })
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it('uses listImprovisationObjectIds when objectIds omitted', async () => {
        const listImprovisationObjectIds = jest.fn(async () => [OBJECT_ID])

        await orphanedImprovisedObjectSweep(
            { diagnosticRunId: 'full-scan' },
            {
                listImprovisationObjectIds,
                getPairRow: async () => ({ EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({
                    EphemeraId: OBJECT_ID,
                    DataCategory: 'Meta::Object',
                    stableKey: 'skates',
                }),
                getMembershipContainers: async () => [],
                loadGraphObjectIds: async () => new Set(),
                emitFinding,
            }
        )

        expect(listImprovisationObjectIds).toHaveBeenCalledTimes(1)
        expect(emitFinding).toHaveBeenCalledTimes(1)
    })
})

/**
 * Exercises the *defaulted* `loadGraphObjectIds`, which every case above injects past. The bug
 * this covers lived entirely in that default, so injecting a stub for it --- however carefully
 * --- could never have caught it.
 */
describe('orphanedImprovisedObjectSweep default graph scan', () => {
    const emitFinding = jest.fn(async () => undefined)

    beforeEach(() => {
        emitFinding.mockClear()
        process.env.EVENT_BUS_NAME = 'test-bus'
        ;(ephemeraDB.query as jest.Mock).mockReset()
    })

    it('does not flag an object nested inside another object as orphaned', async () => {
        // Cup sits on Table: it is a member of no room and no character graph, only of Table's
        // own shard. Scanning Room + Character alone made it look orphaned, and the finding
        // deletes the row --- live data loss (2026-09-03).
        ;(ephemeraDB.query as jest.Mock).mockImplementation(async (args: any) => {
            const { DataCategory } = args.Key
            if (DataCategory === 'Meta::Room') {
                return { items: [{
                    EphemeraId: ROOM_ID,
                    DataCategory: 'Meta::Room',
                    ludicGraph: {
                        rootId: ROOM_ID,
                        nodes: [{ tag: 'Room', universalKey: ROOM_ID }, { tag: 'Object', universalKey: TABLE_ID }],
                        edges: [], ports: [],
                    },
                }] }
            }
            if (DataCategory === 'Meta::Object') {
                return { items: [{
                    EphemeraId: TABLE_ID,
                    DataCategory: 'Meta::Object',
                    ludicGraph: {
                        rootId: TABLE_ID,
                        nodes: [{ tag: 'Object', universalKey: TABLE_ID }, { tag: 'Object', universalKey: CUP_ID }],
                        edges: [], ports: [],
                    },
                }] }
            }
            return { items: [] }
        })

        const result = await orphanedImprovisedObjectSweep(
            { objectIds: [CUP_ID] },
            {
                getPairRow: async () => ({ EphemeraId: CUP_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({ EphemeraId: CUP_ID, DataCategory: 'Meta::Object', stableKey: 'cup' }),
                getMembershipContainers: async () => [],
                emitFinding,
            }
        )

        expect(result.emittedCount).toBe(0)
        expect(emitFinding).not.toHaveBeenCalled()
    })

    it("still flags a genuinely unheld object --- an object graph's own root node does not count as holding itself", async () => {
        ;(ephemeraDB.query as jest.Mock).mockImplementation(async (args: any) => {
            if (args.Key.DataCategory === 'Meta::Object') {
                return { items: [{
                    EphemeraId: CUP_ID,
                    DataCategory: 'Meta::Object',
                    ludicGraph: {
                        rootId: CUP_ID,
                        nodes: [{ tag: 'Object', universalKey: CUP_ID }],
                        edges: [], ports: [],
                    },
                }] }
            }
            return { items: [] }
        })

        const result = await orphanedImprovisedObjectSweep(
            { objectIds: [CUP_ID] },
            {
                getPairRow: async () => ({ EphemeraId: CUP_ID, DataCategory: 'ASSET#IMPROVISATION' }),
                getMetaObject: async () => ({ EphemeraId: CUP_ID, DataCategory: 'Meta::Object', stableKey: 'cup' }),
                getMembershipContainers: async () => [],
                emitFinding,
            }
        )

        expect(result.emittedCount).toBe(1)
    })
})
