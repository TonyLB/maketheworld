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
import { spawnAndPlaceImprovisationObject } from './spawnAndPlaceImprovisationObject'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const spawnArgs = {
    objectId: OBJECT_ID,
    shortName: 'Skates',
    stableKey: 'skates',
    targetRoomId: ROOM_ID,
}

describe('spawnAndPlaceImprovisationObject', () => {
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
        const result = await spawnAndPlaceImprovisationObject(spawnArgs, {
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

        const result = await spawnAndPlaceImprovisationObject(spawnArgs, {
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
        applyMembershipImpl.mockResolvedValue({
            ok: false,
            errorCode: 'KERNEL_FAIL',
            errorMessage: 'placement failed',
        })

        const result = await spawnAndPlaceImprovisationObject(spawnArgs, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
        })

        expect(result).toEqual({ ok: false, errorMessage: 'placement failed' })
        expect(deleteImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            affectedRoomIds: [ROOM_ID],
        })
    })

    it('logs when placement and compensation delete both fail', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        applyMembershipImpl.mockResolvedValue({
            ok: false,
            errorCode: 'KERNEL_FAIL',
            errorMessage: 'placement failed',
        })
        deleteImpl.mockResolvedValue({ ok: false, errorMessage: 'delete failed' })

        const result = await spawnAndPlaceImprovisationObject(spawnArgs, {
            messageBus: messageBus as any,
            streamEvent,
            spawnImpl,
            applyMembershipImpl,
            deleteImpl,
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
        consoleSpy.mockRestore()
    })
})
