jest.mock('./persistImprovisationObject', () => ({
    persistSpawnImprovisationObject: jest.fn(),
    persistDeleteImprovisationObject: jest.fn(),
}))

jest.mock('../positions/membership/applyObjectRoomMembership', () => ({
    applyObjectRoomMembership: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { applyObjectRoomMembership } from '../positions/membership/applyObjectRoomMembership'
import {
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
} from './persistImprovisationObject'
import {
    spawnImprovisationObjectsBatch,
    spawnOneImprovisationObject,
} from './spawnImprovisationObjectsBatch'
import { buildSpawnCompensationDedupeKey } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/objects'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const spawnRow = {
    objectId: OBJECT_ID,
    shortName: 'Skates',
    stableKey: 'skates',
    targetRoomId: ROOM_ID,
}

describe('spawnOneImprovisationObject', () => {
    const spawnImpl = persistSpawnImprovisationObject as jest.MockedFunction<typeof persistSpawnImprovisationObject>
    const applyMembershipImpl = applyObjectRoomMembership as jest.MockedFunction<typeof applyObjectRoomMembership>
    const deleteImpl = persistDeleteImprovisationObject as jest.MockedFunction<typeof persistDeleteImprovisationObject>
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        jest.clearAllMocks()
        spawnImpl.mockResolvedValue({ ok: true, objectId: OBJECT_ID })
        applyMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [],
            to: ROOM_ID,
            changed: true,
        })
        deleteImpl.mockResolvedValue({ ok: true, objectId: OBJECT_ID })
    })

    it('persists existence then applies room membership', async () => {
        const result = await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
        })

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(spawnImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            shortName: 'Skates',
            stableKey: 'skates',
        })
        expect(applyMembershipImpl).toHaveBeenCalledWith(
            { objectId: OBJECT_ID, targetRoomId: ROOM_ID },
            { messageBus, streamEvent }
        )
        expect(deleteImpl).not.toHaveBeenCalled()
    })

    it('returns early when existence persist fails', async () => {
        spawnImpl.mockResolvedValue({ ok: false, errorMessage: 'transact failed' })

        const result = await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
        })

        expect(result).toEqual({ ok: false, errorMessage: 'transact failed' })
        expect(applyMembershipImpl).not.toHaveBeenCalled()
        expect(deleteImpl).not.toHaveBeenCalled()
    })

    it('compensates with delete when placement fails', async () => {
        const streamProblemReport = jest.fn().mockResolvedValue(undefined)
        applyMembershipImpl.mockResolvedValue({
            ok: false,
            errorCode: 'KERNEL_FAIL',
            errorMessage: 'placement failed',
        })

        const result = await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
            streamProblemReport,
        })

        expect(result).toEqual({ ok: false, errorMessage: 'placement failed' })
        expect(deleteImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            affectedRoomIds: [ROOM_ID],
        })
        expect(streamProblemReport).not.toHaveBeenCalled()
    })

    it('logs when placement and compensation delete both fail', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const streamProblemReport = jest.fn().mockResolvedValue(undefined)
        applyMembershipImpl.mockResolvedValue({
            ok: false,
            errorCode: 'KERNEL_FAIL',
            errorMessage: 'placement failed',
        })
        deleteImpl.mockResolvedValue({ ok: false, errorMessage: 'delete failed' })

        const result = await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
            streamProblemReport,
        })

        expect(result).toEqual({ ok: false, errorMessage: 'placement failed' })
        expect(consoleSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] spawn placement failed; compensation delete failed',
            expect.objectContaining({
                objectId: OBJECT_ID,
                placementError: 'placement failed',
                deleteError: 'delete failed',
            })
        )
        expect(streamProblemReport).toHaveBeenCalledTimes(1)
        expect(streamProblemReport).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            targetRoomId: ROOM_ID,
            placementError: 'placement failed',
            deleteError: 'delete failed',
            sourceOperation: 'spawnOneImprovisationObject',
            attemptCount: 1,
        })
        consoleSpy.mockRestore()
    })

    it('uses stable dedupeKey for repeated double-fail reports', async () => {
        const streamProblemReport = jest.fn().mockResolvedValue(undefined)
        applyMembershipImpl.mockResolvedValue({
            ok: false,
            errorCode: 'KERNEL_FAIL',
            errorMessage: 'placement failed',
        })
        deleteImpl.mockResolvedValue({ ok: false, errorMessage: 'delete failed' })

        await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
            streamProblemReport,
        })
        await spawnOneImprovisationObject(spawnRow, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
            streamProblemReport,
        })

        const expectedDedupeKey = buildSpawnCompensationDedupeKey(OBJECT_ID, 1)
        expect(expectedDedupeKey).toBe('OBJECT#Skates::spawnCompensation::1')
        expect(streamProblemReport).toHaveBeenCalledTimes(2)
        expect(streamProblemReport.mock.calls[0][0].attemptCount).toBe(1)
        expect(streamProblemReport.mock.calls[1][0].attemptCount).toBe(1)
    })
})

describe('spawnImprovisationObjectsBatch', () => {
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const spawnOneImpl = jest.fn<ReturnType<typeof spawnOneImprovisationObject>, Parameters<typeof spawnOneImprovisationObject>>()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('collects createdIds for all successful spawns', async () => {
        spawnOneImpl.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
            { objectId: 'OBJECT#b' as EphemeraObjectId, shortName: 'B', stableKey: 'b', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnOneImpl })

        expect(result).toEqual({
            createdIds: ['OBJECT#a', 'OBJECT#b'],
            addFailures: [],
        })
        expect(spawnOneImpl).toHaveBeenCalledTimes(2)
    })

    it('continues on failure and returns partial createdIds', async () => {
        spawnOneImpl.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#b') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
            { objectId: 'OBJECT#b' as EphemeraObjectId, shortName: 'B', stableKey: 'b', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnOneImpl })

        expect(result.createdIds).toEqual(['OBJECT#a'])
        expect(result.addFailures).toEqual([{
            objectId: 'OBJECT#b',
            stableKey: 'b',
            errorMessage: 'placement failed',
        }])
        expect(spawnOneImpl).toHaveBeenCalledTimes(2)
    })

    it('returns only addFailures when every spawn fails', async () => {
        spawnOneImpl.mockResolvedValue({ ok: false, errorMessage: 'existence failed' })

        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnOneImpl })

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
