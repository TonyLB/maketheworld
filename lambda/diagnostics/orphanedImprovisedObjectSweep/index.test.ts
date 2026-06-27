import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orphanedImprovisedObjectSweep } from './index'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

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
