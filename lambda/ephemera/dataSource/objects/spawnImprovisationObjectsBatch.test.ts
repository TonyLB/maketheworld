jest.mock('./spawnAndPlaceImprovisationObject', () => ({
    spawnAndPlaceImprovisationObject: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'
import { spawnImprovisationObjectsBatch } from './spawnImprovisationObjectsBatch'

const spawnAndPlaceMock = spawnAndPlaceImprovisationObject as jest.MockedFunction<typeof spawnAndPlaceImprovisationObject>

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const messageBus = { publish: jest.fn() }
const streamEvent = jest.fn().mockResolvedValue(undefined)

describe('spawnImprovisationObjectsBatch', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('collects createdIds for all successful spawns', async () => {
        spawnAndPlaceMock.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
            { objectId: 'OBJECT#b' as EphemeraObjectId, shortName: 'B', stableKey: 'b', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnAndPlaceImpl: spawnAndPlaceMock })

        expect(result).toEqual({
            createdIds: ['OBJECT#a', 'OBJECT#b'],
            addFailures: [],
        })
        expect(spawnAndPlaceMock).toHaveBeenCalledTimes(2)
    })

    it('continues on failure and returns partial createdIds', async () => {
        spawnAndPlaceMock.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#b') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
            { objectId: 'OBJECT#b' as EphemeraObjectId, shortName: 'B', stableKey: 'b', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnAndPlaceImpl: spawnAndPlaceMock })

        expect(result.createdIds).toEqual(['OBJECT#a'])
        expect(result.addFailures).toEqual([{
            objectId: 'OBJECT#b',
            stableKey: 'b',
            errorMessage: 'placement failed',
        }])
        expect(spawnAndPlaceMock).toHaveBeenCalledTimes(2)
    })

    it('returns only addFailures when every spawn fails', async () => {
        spawnAndPlaceMock.mockResolvedValue({ ok: false, errorMessage: 'existence failed' })

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnAndPlaceImpl: spawnAndPlaceMock })

        expect(result).toEqual({
            createdIds: [],
            addFailures: [{
                objectId: 'OBJECT#a',
                stableKey: 'a',
                errorMessage: 'existence failed',
            }],
        })
    })
})
