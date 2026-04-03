import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheMarkState } from '../../renderCache/baseClasses'
import type { MergePersistMetaRoomMarksOptimisticUpdateParams } from './mergePersistMetaRoomMarks'
import { mergeMarkState, mergePersistMetaRoomMarks } from './mergePersistMetaRoomMarks'

/** Simulates a successful Dynamo write: runs reducer, invokes successCallback with prior/output. */
const mockOptimisticUpdatePersisting = (meta: EphemeraMetaRoom, roomId: EphemeraRoomId) => (
    jest.fn().mockImplementation(async (params: MergePersistMetaRoomMarksOptimisticUpdateParams) => {
        const draft: EphemeraMetaRoom = { ...meta }
        params.updateReducer(draft)
        if (params.successCallback) {
            await params.successCallback(
                { EphemeraId: roomId, DataCategory: 'Meta::Room', state: draft.state },
                { EphemeraId: roomId, DataCategory: 'Meta::Room', state: meta.state }
            )
        }
        return { EphemeraId: roomId, DataCategory: 'Meta::Room', state: draft.state }
    })
)

describe('mergePersistMetaRoomMarks / mergeMarkState', () => {
    const roomId = 'ROOM#test' as EphemeraRoomId

    describe('mergeMarkState', () => {
        it('incoming wins on duplicate mark keys', () => {
            const base: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#a', value: 'first' }],
            }
            const incoming: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#a', value: 'second' }],
            }
            const out = mergeMarkState(base, incoming)
            expect(out.markValue).toEqual([{ mark: 'MARK#a', value: 'second' }])
        })

        it('concatenates distinct marks and sorts', () => {
            const base: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#z', value: 'z' }],
            }
            const incoming: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#a', value: 'a' }],
            }
            const out = mergeMarkState(base, incoming)
            expect(out.markValue.map((e) => e.mark)).toEqual(['MARK#a', 'MARK#z'])
        })

        it('handles empty base', () => {
            const out = mergeMarkState({ markValue: [] }, { markValue: [{ mark: 'M', value: 'v' }] })
            expect(out.markValue).toEqual([{ mark: 'M', value: 'v' }])
        })

        it('handles empty incoming', () => {
            const base: EphemeraCacheMarkState = { markValue: [{ mark: 'M', value: 'v' }] }
            const out = mergeMarkState(base, { markValue: [] })
            expect(out.markValue).toEqual([{ mark: 'M', value: 'v' }])
        })
    })

    describe('mergePersistMetaRoomMarks', () => {
        const baseMeta = (overrides: Partial<EphemeraMetaRoom> = {}): EphemeraMetaRoom => ({
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            ...overrides,
        })

        it('returns META_ROOM_MISSING when getMetaRoom returns undefined', async () => {
            const result = await mergePersistMetaRoomMarks(
                {
                    roomId,
                    incomingMarks: { markValue: [{ mark: 'M', value: 'v' }] },
                },
                {
                    getMetaRoom: async () => undefined,
                }
            )
            expect(result).toEqual({
                ok: false,
                errorCode: 'META_ROOM_MISSING',
                errorMessage: 'Meta::Room not found for ROOM#test',
            })
        })

        it('merges onto stored marks and persists state', async () => {
            const meta = baseMeta({
                state: {
                    marks: { markValue: [{ mark: 'MARK#old', value: 'old' }] },
                    situationId: 'SITUATION#keep',
                },
            })
            const computeDefaultMarksForRoom = jest.fn()
            const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

            const result = await mergePersistMetaRoomMarks(
                {
                    roomId,
                    incomingMarks: { markValue: [{ mark: 'MARK#new', value: 'new' }] },
                },
                {
                    getMetaRoom: async () => meta,
                    computeDefaultMarksForRoom,
                    optimisticUpdate,
                }
            )

            expect(result.ok).toBe(true)
            if (!result.ok || !result.persisted) {
                throw new Error('expected ok with persisted')
            }
            expect(result.priorState).toEqual(meta.state)
            expect(result.newState.marks.markValue.map((e) => e.mark).sort()).toEqual(['MARK#new', 'MARK#old'].sort())
            expect(result.newState.situationId).toBe('SITUATION#keep')
            expect(computeDefaultMarksForRoom).not.toHaveBeenCalled()
            expect(optimisticUpdate).toHaveBeenCalledTimes(1)
            const call = optimisticUpdate.mock.calls[0][0]
            expect(call.Key).toEqual({ EphemeraId: roomId, DataCategory: 'Meta::Room' })
            expect(call.updateKeys).toEqual(['state'])
            expect(call.priorFetch).toBe(meta)

            const draft: EphemeraMetaRoom = { ...meta }
            call.updateReducer(draft)
            expect(draft.state?.marks.markValue.map((e) => e.mark).sort()).toEqual(['MARK#new', 'MARK#old'].sort())
            expect(draft.state?.situationId).toBe('SITUATION#keep')
        })

        it('uses computeDefaultMarksForRoom when stored marks are empty', async () => {
            const meta = baseMeta({
                state: { marks: { markValue: [] } },
            })
            const defaultMarks: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#def', value: 'def' }],
            }
            const computeDefaultMarksForRoom = jest.fn().mockResolvedValue(defaultMarks)
            const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

            const result = await mergePersistMetaRoomMarks(
                {
                    roomId,
                    incomingMarks: { markValue: [{ mark: 'MARK#in', value: 'in' }] },
                },
                {
                    getMetaRoom: async () => meta,
                    computeDefaultMarksForRoom,
                    optimisticUpdate,
                }
            )

            expect(result.ok).toBe(true)
            if (!result.ok || !result.persisted) {
                throw new Error('expected ok with persisted')
            }
            expect(computeDefaultMarksForRoom).toHaveBeenCalledWith({
                roomId,
            })

            const call = optimisticUpdate.mock.calls[0][0]
            expect(call.priorFetch).toBe(meta)
            const draft: EphemeraMetaRoom = { ...meta }
            call.updateReducer(draft)
            expect(draft.state?.marks.markValue).toEqual([
                { mark: 'MARK#def', value: 'def' },
                { mark: 'MARK#in', value: 'in' },
            ])
        })

        it('uses computeDefaultMarksForRoom when state is missing', async () => {
            const meta = baseMeta({})
            const defaultMarks: EphemeraCacheMarkState = {
                markValue: [{ mark: 'MARK#def', value: 'def' }],
            }
            const computeDefaultMarksForRoom = jest.fn().mockResolvedValue(defaultMarks)
            const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)

            const result = await mergePersistMetaRoomMarks(
                {
                    roomId,
                    incomingMarks: { markValue: [] },
                },
                {
                    getMetaRoom: async () => meta,
                    computeDefaultMarksForRoom,
                    optimisticUpdate,
                }
            )

            expect(result.ok).toBe(true)
            if (!result.ok || !result.persisted) {
                throw new Error('expected ok with persisted')
            }
            expect(computeDefaultMarksForRoom).toHaveBeenCalled()
            const call = optimisticUpdate.mock.calls[0][0]
            expect(call.priorFetch).toBe(meta)
            const draft: EphemeraMetaRoom = { ...meta }
            call.updateReducer(draft)
            expect(draft.state?.marks).toEqual(defaultMarks)
        })

        it('recomputes merge from a fresh draft when the reducer runs again (retry simulation)', async () => {
            const meta = baseMeta({
                state: {
                    marks: { markValue: [{ mark: 'MARK#first', value: 'a' }] },
                },
            })
            const computeDefaultMarksForRoom = jest.fn()
            const optimisticUpdate = mockOptimisticUpdatePersisting(meta, roomId)
            const incomingMarks = { markValue: [{ mark: 'MARK#in', value: 'in' }] }

            await mergePersistMetaRoomMarks(
                { roomId, incomingMarks },
                {
                    getMetaRoom: async () => meta,
                    computeDefaultMarksForRoom,
                    optimisticUpdate,
                }
            )

            expect(computeDefaultMarksForRoom).not.toHaveBeenCalled()
            const call = optimisticUpdate.mock.calls[0][0]
            const concurrent: EphemeraMetaRoom = {
                ...meta,
                state: {
                    marks: { markValue: [{ mark: 'MARK#concurrent', value: 'b' }] },
                },
            }
            call.updateReducer(concurrent)
            expect(concurrent.state?.marks.markValue.map((e) => e.mark).sort()).toEqual(
                ['MARK#concurrent', 'MARK#in'].sort()
            )
        })

        it('returns persisted false when optimistic update does not invoke successCallback', async () => {
            const meta = baseMeta({
                state: { marks: { markValue: [{ mark: 'MARK#x', value: 'x' }] } },
            })
            const optimisticUpdate = jest.fn().mockResolvedValue({
                EphemeraId: roomId,
                DataCategory: 'Meta::Room',
                state: meta.state,
            })

            const result = await mergePersistMetaRoomMarks(
                {
                    roomId,
                    incomingMarks: { markValue: [{ mark: 'MARK#y', value: 'y' }] },
                },
                {
                    getMetaRoom: async () => meta,
                    optimisticUpdate,
                }
            )

            expect(result).toEqual({ ok: true, persisted: false })
        })
    })
})
