import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { MergePersistMetaRoomObjectsOptimisticUpdateParams } from './mergePersistMetaRoomObjects'
import { clearPersistMetaRoomObjects, mergeMetaRoomObjects, mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'
import internalCache from '../../internalCache'

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: {
            invalidate: jest.fn(),
            get: jest.fn(),
        },
        ComponentStackMerge: {
            invalidate: jest.fn(),
        },
    },
}))

const invalidateMock = internalCache.ComponentEphemeraMeta.invalidate as jest.MockedFunction<
    typeof internalCache.ComponentEphemeraMeta.invalidate
>

const stackMergeInvalidateMock = internalCache.ComponentStackMerge.invalidate as jest.MockedFunction<
    typeof internalCache.ComponentStackMerge.invalidate
>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
})

const enrichedObj = (
    suffix: string,
    shortName: string,
    extras: Partial<Pick<EphemeraMetaRoomObject, 'affinities' | 'affinitiesFailed' | 'stableKey' | 'tropeAffinities' | 'tropeAffinitiesFailed'>> = {}
): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
    ...extras,
})

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

describe('mergeMetaRoomObjects', () => {
    it('treats missing base as empty', () => {
        expect(mergeMetaRoomObjects(undefined, [obj('a', 'A')], [])).toEqual([obj('a', 'A')])
    })

    it('removes every entry whose uuid is in remove', () => {
        const base = [obj('x', 'X'), obj('y', 'Y'), obj('x', 'X2')]
        expect(mergeMetaRoomObjects(base, [], ['OBJECT#x' as EphemeraObjectId])).toEqual([obj('y', 'Y')])
    })

    it('appends adds after remove, preserving non-removed order', () => {
        const base = [obj('a', 'A'), obj('b', 'B')]
        expect(mergeMetaRoomObjects(base, [obj('c', 'C'), obj('d', 'D')], ['OBJECT#b' as EphemeraObjectId])).toEqual([
            obj('a', 'A'),
            obj('c', 'C'),
            obj('d', 'D'),
        ])
    })

    it('upserts by uuid and moves updated entry to end', () => {
        const base = [obj('a', 'old'), obj('b', 'B')]
        expect(mergeMetaRoomObjects(base, [obj('a', 'new')], [])).toEqual([obj('b', 'B'), obj('a', 'new')])
    })

    it('last add wins when same uuid appears twice in add', () => {
        expect(mergeMetaRoomObjects(undefined, [obj('a', 'first'), obj('a', 'second')], [])).toEqual([obj('a', 'second')])
    })

    it('preserves existing rows when merging an enriched add row', () => {
        const existing: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#old' as EphemeraObjectId,
            shortName: 'Legacy',
            stableKey: 'legacy',
        }
        const incoming: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#new' as EphemeraObjectId,
            shortName: 'Anvil',
            stableKey: 'anvil',
            affinities: [],
        }
        expect(mergeMetaRoomObjects([existing], [incoming], [])).toEqual([existing, incoming])
    })

    it('upsert replaces stableKey when add supplies a new row for same uuid', () => {
        const base: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as EphemeraObjectId,
            shortName: 'rocket',
            stableKey: 'rocket',
        }
        const replacement: EphemeraMetaRoomObject = {
            uuid: 'OBJECT#a' as EphemeraObjectId,
            shortName: 'rocket',
            stableKey: 'rocket2',
            affinities: [],
        }
        expect(mergeMetaRoomObjects([base], [replacement], [])).toEqual([replacement])
    })
})

describe('mergePersistMetaRoomObjects', () => {
    const roomId = 'ROOM#test' as EphemeraRoomId
    const trope = (overrides: Partial<CoyoteTropeAffinity> = {}): CoyoteTropeAffinity => ({
        trope: 'Contraption',
        aptness: 'High',
        narrowing: 'spring-loaded frame',
        ...overrides,
    })

    const baseMeta = (overrides: Partial<EphemeraMetaRoom> = {}): EphemeraMetaRoom => ({
        EphemeraId: roomId,
        DataCategory: 'Meta::Room',
        ...overrides,
    })

    beforeEach(() => {
        invalidateMock.mockClear()
        stackMergeInvalidateMock.mockClear()
    })

    it('returns META_ROOM_MISSING when getMetaRoom returns undefined', async () => {
        const result = await mergePersistMetaRoomObjects(
            { roomId, add: [obj('o1', 'O1')], remove: [] },
            { getMetaRoom: async () => undefined }
        )
        expect(result).toEqual({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'Meta::Room not found for ROOM#test',
        })
        expect(invalidateMock).not.toHaveBeenCalled()
        expect(stackMergeInvalidateMock).not.toHaveBeenCalled()
    })

    it('merges add/remove onto stored objects and persists', async () => {
        const meta = baseMeta({
            objects: [obj('a', 'A'), obj('b', 'B'), obj('a', 'A2')],
        })
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: [obj('c', 'C')], remove: ['OBJECT#a' as EphemeraObjectId] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual([obj('a', 'A'), obj('b', 'B'), obj('a', 'A2')])
        expect(result.newObjects).toEqual([obj('b', 'B'), obj('c', 'C')])
        expect(optimisticUpdate).toHaveBeenCalledTimes(1)
        const call = optimisticUpdate.mock.calls[0][0]
        expect(call.Key).toEqual({ EphemeraId: roomId, DataCategory: 'Meta::Room' })
        expect(call.updateKeys).toEqual(['objects'])
        expect(call.priorFetch).toBe(meta)
        expect(invalidateMock).toHaveBeenCalledWith(roomId)
        expect(stackMergeInvalidateMock).toHaveBeenCalledWith(roomId)
    })

    it('treats missing objects as empty when merging', async () => {
        const meta = baseMeta({})
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: [obj('x', 'X')], remove: [] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual([])
        expect(result.newObjects).toEqual([obj('x', 'X')])
    })

    it('preserves optional Acme enrich fields in priorObjects and newObjects snapshots', async () => {
        const priorRich = enrichedObj('a', 'Legacy', {
            affinities: [{ role: 'terminal', aptness: 0.4 }],
            tropeAffinities: [trope({ narrowing: 'hanging chain mount' })],
        })
        const meta = baseMeta({
            objects: [priorRich, obj('b', 'B')],
        })
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const addRich = enrichedObj('c', 'Imported dynamite crate', {
            tropeAffinities: [
                trope({
                    narrowing: 'detonation cradle',
                    environmentAffordances: ['affordance-alpha', 'affordance-beta'],
                }),
                trope({
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'wooden slat shell',
                }),
            ],
            affinities: [
                { role: 'connect-props', aptness: 0.55 },
                { role: 'terminal', aptness: 0.3 },
            ],
            affinitiesFailed: false,
        })

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: [addRich], remove: [] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual([
            enrichedObj('a', 'Legacy', {
                affinities: [{ role: 'terminal', aptness: 0.4 }],
                tropeAffinities: [trope({ narrowing: 'hanging chain mount' })],
            }),
            obj('b', 'B'),
        ])
        expect(result.newObjects).toEqual([
            enrichedObj('a', 'Legacy', {
                affinities: [{ role: 'terminal', aptness: 0.4 }],
                tropeAffinities: [trope({ narrowing: 'hanging chain mount' })],
            }),
            obj('b', 'B'),
            addRich,
        ])
    })

    it('returns persisted false when optimistic update does not invoke successCallback', async () => {
        const meta = baseMeta({ objects: [obj('z', 'Z')] })
        const optimisticUpdate = jest.fn().mockResolvedValue({
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            objects: meta.objects,
        })

        const result = await mergePersistMetaRoomObjects(
            { roomId, add: [obj('y', 'Y')], remove: [] },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result).toEqual({ ok: true, persisted: false })
        expect(invalidateMock).toHaveBeenCalledWith(roomId)
        expect(stackMergeInvalidateMock).toHaveBeenCalledWith(roomId)
    })
})

describe('clearPersistMetaRoomObjects', () => {
    const roomId = 'ROOM#clear' as EphemeraRoomId

    const baseMeta = (overrides: Partial<EphemeraMetaRoom> = {}): EphemeraMetaRoom => ({
        EphemeraId: roomId,
        DataCategory: 'Meta::Room',
        ...overrides,
    })

    beforeEach(() => {
        invalidateMock.mockClear()
        stackMergeInvalidateMock.mockClear()
    })

    it('returns META_ROOM_MISSING when getMetaRoom returns undefined', async () => {
        const result = await clearPersistMetaRoomObjects(
            { roomId },
            { getMetaRoom: async () => undefined }
        )
        expect(result).toEqual({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'Meta::Room not found for ROOM#clear',
        })
        expect(invalidateMock).not.toHaveBeenCalled()
        expect(stackMergeInvalidateMock).not.toHaveBeenCalled()
    })

    it('clears objects to empty regardless of previous values', async () => {
        const meta = baseMeta({ objects: [obj('a', 'A'), obj('b', 'B')] })
        const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

        const result = await clearPersistMetaRoomObjects(
            { roomId },
            { getMetaRoom: async () => meta, optimisticUpdate }
        )

        expect(result.ok).toBe(true)
        if (!result.ok || !result.persisted) {
            throw new Error('expected ok with persisted')
        }
        expect(result.priorObjects).toEqual([obj('a', 'A'), obj('b', 'B')])
        expect(result.newObjects).toEqual([])
        expect(invalidateMock).toHaveBeenCalledWith(roomId)
        expect(stackMergeInvalidateMock).toHaveBeenCalledWith(roomId)
    })
})
