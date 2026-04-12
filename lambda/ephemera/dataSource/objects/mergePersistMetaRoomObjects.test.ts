import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MergePersistMetaRoomObjectsOptimisticUpdateParams } from './mergePersistMetaRoomObjects'
import { mergeMetaRoomObjectsList, mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'
import internalCache from '../../internalCache'

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: {
            invalidate: jest.fn(),
            get: jest.fn(),
        },
    },
}))

const invalidateMock = internalCache.ComponentEphemeraMeta.invalidate as jest.MockedFunction<
    typeof internalCache.ComponentEphemeraMeta.invalidate
>

/** Simulates a successful Dynamo write: runs reducer, invokes successCallback with prior/output. */
const mockOptimisticUpdatePersisting = (meta: EphemeraMetaRoom, roomId: EphemeraRoomId) => (
    jest.fn().mockImplementation(async (params: MergePersistMetaRoomObjectsOptimisticUpdateParams) => {
        const draft: EphemeraMetaRoom = { ...meta }
        params.updateReducer(draft)
        if (params.successCallback) {
            await params.successCallback(
                { EphemeraId: roomId, DataCategory: 'Meta::Room', objects: draft.objects },
                { EphemeraId: roomId, DataCategory: 'Meta::Room', objects: meta.objects }
            )
        }
        return { EphemeraId: roomId, DataCategory: 'Meta::Room', objects: draft.objects }
    })
)

describe('mergeMetaRoomObjectsList', () => {
    it('treats missing base as empty', () => {
        expect(mergeMetaRoomObjectsList(undefined, ['a'], [])).toEqual(['a'])
    })

    it('removes all values in remove set with stable order', () => {
        expect(mergeMetaRoomObjectsList(['x', 'y', 'x'], [], ['x'])).toEqual(['y'])
    })

    it('appends add after filter', () => {
        expect(mergeMetaRoomObjectsList(['a', 'b'], ['c', 'd'], ['b'])).toEqual(['a', 'c', 'd'])
    })

    it('allows duplicates in multiset', () => {
        expect(mergeMetaRoomObjectsList(['a'], ['a', 'a'], [])).toEqual(['a', 'a', 'a'])
    })
})

describe('mergePersistMetaRoomObjects', () => {
    const roomId = 'ROOM#test' as EphemeraRoomId

    const baseMeta = (overrides: Partial<EphemeraMetaRoom> = {}): EphemeraMetaRoom => ({
        EphemeraId: roomId,
        DataCategory: 'Meta::Room',
        ...overrides,
    })

    beforeEach(() => {
        invalidateMock.mockClear()
    })

    it('returns META_ROOM_MISSING when getMetaRoom returns undefined', async () => {
        const result = await mergePersistMetaRoomObjects(
            { roomId, add: ['o1'], remove: [] },
            { getMetaRoom: async () => undefined }
        )
        expect(result).toEqual({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'Meta::Room not found for ROOM#test',
        })
        expect(invalidateMock).not.toHaveBeenCalled()
    })

    it('merges add/remove onto stored objects and persists', async () => {
        const meta = baseMeta({ objects: ['a', 'b', 'a'] })
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: ['c'], remove: ['a'] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual(['a', 'b', 'a'])
        expect(result.newObjects).toEqual(['b', 'c'])
        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        const call = optimisticUpdate.mock.calls[0][0]
        expect(call.Key).toEqual({ EphemeraId: roomId, DataCategory: 'Meta::Room' })
        expect(call.updateKeys).toEqual(['objects'])
        expect(call.priorFetch).toBe(meta)
        expect(invalidateMock).toHaveBeenCalledWith(roomId)
    })

    it('treats missing objects as empty when merging', async () => {
        const meta = baseMeta({})
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: ['x'], remove: [] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual([])
        expect(result.newObjects).toEqual(['x'])
    })

    it('returns persisted false when optimistic update does not invoke successCallback', async () => {
        const meta = baseMeta({ objects: ['z'] })
        const optimisticUpdate = jest.fn().mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            objects: meta.objects,
        })

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: ['y'], remove: [] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result).toEqual({ ok: true, persisted: false })
        expect(invalidateMock).toHaveBeenCalledWith(roomId)
    })
})
