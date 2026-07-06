import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SemanticEmbedding,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import { applyObjectRoomMembership } from '../positions/membership/applyObjectRoomMembership'
import { applyObjectsChange } from './applyObjectsChange'
import type { BuildShortNameSemanticEmbeddingResult } from './embedding/buildShortNameSemanticEmbedding'
import {
    persistSpawnImprovisationObject,
} from './persistImprovisationObject'
import {
    spawnOneImprovisationObject,
    type spawnOneImprovisationObject as SpawnOneType,
} from './spawnImprovisationObjectsBatch'

jest.mock('./persistImprovisationObject', () => ({
    persistSpawnImprovisationObject: jest.fn(),
    persistDeleteImprovisationObject: jest.fn(),
}))

jest.mock('../positions/membership/applyObjectRoomMembership', () => ({
    applyObjectRoomMembership: jest.fn(),
}))

const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const makeTestEmbedding = () => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
}

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

describe('applyObjectsChange embed wiring', () => {
    const messageBus = { publish: jest.fn() }
    const positionsStreamEvent = jest.fn().mockResolvedValue(undefined)
    const mockPersist = persistSpawnImprovisationObject as jest.MockedFunction<typeof persistSpawnImprovisationObject>
    const mockPlace = applyObjectRoomMembership as jest.MockedFunction<typeof applyObjectRoomMembership>
    const mockBuildEmbed = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()

    const spawnOneImpl: typeof SpawnOneType = (row, innerDeps) =>
        spawnOneImprovisationObject(row, {
            ...innerDeps,
            buildEmbedImpl: mockBuildEmbed,
            spawnImpl: mockPersist,
            applyMembershipImpl: mockPlace,
        })

    beforeEach(() => {
        jest.clearAllMocks()
        mockPersist.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))
        mockPlace.mockResolvedValue({
            ok: true,
            froms: [],
            to: ROOM_ID,
            changed: true,
        })
    })

    it('includes object in createdIds when embed fails but persist and placement succeed (OE-3)', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mockBuildEmbed.mockResolvedValue({ success: false, errorMessage: 'Bedrock timeout' })

        const result = await applyObjectsChange(
            { roomId: ROOM_ID, add: [obj('a', 'Anvil')], remove: [] },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(result).toEqual({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#a'],
            destroyedIds: [],
        })
        expect(consoleSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] shortName embed failed; spawning without embedding',
            expect.objectContaining({
                objectId: 'OBJECT#a',
                shortName: 'Anvil',
                errorMessage: 'Bedrock timeout',
            })
        )
        expect(mockPersist).toHaveBeenCalledWith({
            objectId: 'OBJECT#a',
            shortName: 'Anvil',
            stableKey: 'a',
        })
        consoleSpy.mockRestore()
    })

    it('passes embedding to persist when embed succeeds', async () => {
        const embedding = makeTestEmbedding()
        mockBuildEmbed.mockResolvedValue({ success: true, embedding })

        await applyObjectsChange(
            { roomId: ROOM_ID, add: [obj('a', 'Anvil')], remove: [] },
            { messageBus: messageBus as any, positionsStreamEvent, spawnOneImpl }
        )

        expect(mockPersist).toHaveBeenCalledWith({
            objectId: 'OBJECT#a',
            shortName: 'Anvil',
            stableKey: 'a',
            embedding,
        })
    })
})
