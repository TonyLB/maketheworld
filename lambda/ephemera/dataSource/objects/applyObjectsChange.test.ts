import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { applyObjectsChange } from './applyObjectsChange'
import type { spawnOneImprovisationObject } from './spawnImprovisationObjectsBatch'

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const obj = (suffix: string, shortName: string, extras: Partial<EphemeraMetaRoomObject> = {}): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
    ...extras,
})

describe('applyObjectsChange', () => {
    const messageBus = { publish: jest.fn() }
    const positionsStreamEvent = jest.fn().mockResolvedValue(undefined)
    const spawnOneImpl = jest.fn<ReturnType<typeof spawnOneImprovisationObject>, Parameters<typeof spawnOneImprovisationObject>>()
    const applyClearMembershipImpl = jest.fn()
    const deleteObjectImpl = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        spawnOneImpl.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))
        applyClearMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [ROOM_ID],
            to: null,
            changed: true,
        })
        deleteObjectImpl.mockResolvedValue({ ok: true, objectId: 'OBJECT#removed' })
    })

    it('returns persisted false when add and remove are empty', async () => {
        const result = await applyObjectsChange(
            { roomId: ROOM_ID, add: [], remove: [] },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toEqual({ ok: true, persisted: false })
        expect(spawnOneImpl).not.toHaveBeenCalled()
    })

    it('collects createdIds when all adds succeed', async () => {
        const result = await applyObjectsChange(
            {
                roomId: ROOM_ID,
                add: [obj('a', 'A'), obj('b', 'B')],
                remove: [],
            },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toEqual({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#a', 'OBJECT#b'],
            destroyedIds: [],
        })
        expect(spawnOneImpl).toHaveBeenCalledTimes(2)
        expect(spawnOneImpl).toHaveBeenCalledWith(
            expect.objectContaining({
                objectId: 'OBJECT#a',
                shortName: 'A',
                stableKey: 'a',
                targetRoomId: ROOM_ID,
            }),
            expect.objectContaining({ messageBus, streamEvent: positionsStreamEvent })
        )
    })

    it('returns partial createdIds when some adds fail (S3)', async () => {
        spawnOneImpl.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#b') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })

        const result = await applyObjectsChange(
            {
                roomId: ROOM_ID,
                add: [obj('a', 'A'), obj('b', 'B')],
                remove: [],
            },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toEqual({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#a'],
            destroyedIds: [],
            addFailures: [{
                objectId: 'OBJECT#b',
                stableKey: 'b',
                errorMessage: 'placement failed',
            }],
        })
    })

    it('excludes failed spawn from createdIds when placement compensation fails (S1)', async () => {
        spawnOneImpl.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#orphan') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })

        const result = await applyObjectsChange(
            {
                roomId: ROOM_ID,
                add: [obj('good', 'Good'), obj('orphan', 'Orphan')],
                remove: [],
            },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toMatchObject({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#good'],
            addFailures: [{
                objectId: 'OBJECT#orphan',
                stableKey: 'orphan',
                errorMessage: 'placement failed',
            }],
        })
        expect(result).toEqual(expect.objectContaining({
            createdIds: expect.not.arrayContaining(['OBJECT#orphan']),
        }))
    })

    it('returns ok false when every add fails', async () => {
        spawnOneImpl.mockResolvedValue({ ok: false, errorMessage: 'existence failed' })

        const result = await applyObjectsChange(
            {
                roomId: ROOM_ID,
                add: [obj('a', 'A'), obj('b', 'B')],
                remove: [],
            },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toEqual({
            ok: false,
            errorMessage: '2 add(s) failed',
            addFailures: [
                { objectId: 'OBJECT#a', stableKey: 'a', errorMessage: 'existence failed' },
                { objectId: 'OBJECT#b', stableKey: 'b', errorMessage: 'existence failed' },
            ],
        })
    })

    it('aggregates destroyedIds alongside partial createdIds', async () => {
        spawnOneImpl.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#b') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })
        deleteObjectImpl.mockImplementation(async ({ objectId }) => ({ ok: true, objectId }))

        const result = await applyObjectsChange(
            {
                roomId: ROOM_ID,
                add: [obj('a', 'A'), obj('b', 'B')],
                remove: ['OBJECT#removed' as EphemeraObjectId],
            },
            {
                messageBus: messageBus as any,
                positionsStreamEvent,
                spawnOneImpl,
                applyClearMembershipImpl,
                deleteObjectImpl,
            }
        )

        expect(result).toEqual({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#a'],
            destroyedIds: ['OBJECT#removed'],
            addFailures: [{
                objectId: 'OBJECT#b',
                stableKey: 'b',
                errorMessage: 'placement failed',
            }],
        })
        expect(applyClearMembershipImpl).toHaveBeenCalledWith(
            { objectId: 'OBJECT#removed' },
            { messageBus, streamEvent: positionsStreamEvent }
        )
        expect(deleteObjectImpl).toHaveBeenCalledWith({
            objectId: 'OBJECT#removed',
            affectedRoomIds: [ROOM_ID],
        })
    })

    it('maps tropeAffinities through room filter on add rows', async () => {
        const environmentAffordanceMatrixOrder = {
            shortName: 'paint tunnel kit',
            stableKey: 'paint-tunnel-kit',
            tropeAffinities: [
                {
                    trope: 'Contraption' as const,
                    aptness: 'High' as const,
                    narrowing: 'scene-dependent rig',
                    environmentAffordances: [
                        { object: 'rock-wall' as const, roles: ['Finishing Move' as const] },
                        { object: 'cactus' as const, roles: ['Disadvantage' as const] },
                        { object: 'boulder' as const, roles: ['Contraption' as const] },
                    ],
                },
            ],
        }

        await applyObjectsChange(
            {
                roomId: 'ROOM#STRAIGHTAWAY' as EphemeraRoomId,
                add: [obj('kit', 'Kit', environmentAffordanceMatrixOrder)],
                remove: [],
            },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        const spawnArgs = spawnOneImpl.mock.calls[0]?.[0]
        expect(spawnArgs?.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
        ])
    })
})
