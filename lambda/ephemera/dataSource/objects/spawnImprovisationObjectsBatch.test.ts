jest.mock('./persistImprovisationObject', () => ({
    persistSpawnImprovisationObject: jest.fn(),
    persistDeleteImprovisationObject: jest.fn(),
}))

jest.mock('../positions/manipulation/membership/executeObjectMove', () => ({
    executeMembershipTransfer: jest.fn(),
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildSpawnCompensationDedupeKey } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/objects'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SemanticEmbedding,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import { executeMembershipTransfer } from '../positions/manipulation/membership/executeObjectMove'
import type { BuildShortNameSemanticEmbeddingResult } from './embedding/buildShortNameSemanticEmbedding'
import {
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
} from './persistImprovisationObject'
import {
    spawnImprovisationObjectsBatch,
    spawnOneImprovisationObject,
} from './spawnImprovisationObjectsBatch'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId
const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const spawnRow = {
    objectId: OBJECT_ID,
    shortName: 'Skates',
    stableKey: 'skates',
    targetRoomId: ROOM_ID,
}

const makeTestEmbedding = () => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
}

const embedFailure = (): BuildShortNameSemanticEmbeddingResult => ({
    success: false,
    errorMessage: 'embed skipped in test',
})

describe('spawnOneImprovisationObject', () => {
    const spawnImpl = persistSpawnImprovisationObject as jest.MockedFunction<typeof persistSpawnImprovisationObject>
    const applyMembershipImpl = executeMembershipTransfer as jest.MockedFunction<typeof executeMembershipTransfer>
    const deleteImpl = persistDeleteImprovisationObject as jest.MockedFunction<typeof persistDeleteImprovisationObject>
    const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    const spawnDeps = () => ({
        messageBus: messageBus as any,
        streamEvent,
        buildEmbedImpl,
        spawnImpl,
        applyMembershipImpl,
        deleteImpl,
    })

    beforeEach(() => {
        jest.clearAllMocks()
        buildEmbedImpl.mockResolvedValue(embedFailure())
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
        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(buildEmbedImpl).toHaveBeenCalledWith('Skates')
        expect(spawnImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            shortName: 'Skates',
            stableKey: 'skates',
        })
        expect(applyMembershipImpl).toHaveBeenCalledWith({
            entityId: OBJECT_ID,
            target: ROOM_ID,
            messageBus,
            streamEvent,
        })
        expect(deleteImpl).not.toHaveBeenCalled()
    })

    it('passes embedding to persist when embed succeeds', async () => {
        const embedding = makeTestEmbedding()
        buildEmbedImpl.mockResolvedValue({ success: true, embedding })

        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(buildEmbedImpl).toHaveBeenCalledWith('Skates')
        expect(spawnImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            shortName: 'Skates',
            stableKey: 'skates',
            embedding,
        })
        expect(buildEmbedImpl.mock.invocationCallOrder[0])
            .toBeLessThan(spawnImpl.mock.invocationCallOrder[0])
    })

    it('logs and spawns without embedding when embed fails (OE-3)', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        buildEmbedImpl.mockResolvedValue({ success: false, errorMessage: 'Bedrock timeout' })

        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(consoleSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] shortName embed failed; spawning without embedding',
            {
                objectId: OBJECT_ID,
                shortName: 'Skates',
                errorMessage: 'Bedrock timeout',
            }
        )
        expect(spawnImpl).toHaveBeenCalledWith({
            objectId: OBJECT_ID,
            shortName: 'Skates',
            stableKey: 'skates',
        })
        expect(applyMembershipImpl).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('returns early when existence persist fails even if embed failed', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        buildEmbedImpl.mockResolvedValue({ success: false, errorMessage: 'Bedrock timeout' })
        spawnImpl.mockResolvedValue({ ok: false, errorMessage: 'transact failed' })

        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: false, errorMessage: 'transact failed' })
        expect(applyMembershipImpl).not.toHaveBeenCalled()
        expect(deleteImpl).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('returns early when existence persist fails', async () => {
        spawnImpl.mockResolvedValue({ ok: false, errorMessage: 'transact failed' })

        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

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
            ...spawnDeps(),
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
            ...spawnDeps(),
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
            ...spawnDeps(),
            streamProblemReport,
        })
        await spawnOneImprovisationObject(spawnRow, {
            ...spawnDeps(),
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

    it('collects createdIds when embed fails on one row but spawn succeeds (S3)', async () => {
        const spawnImpl = persistSpawnImprovisationObject as jest.MockedFunction<typeof persistSpawnImprovisationObject>
        const applyMembershipImpl = executeMembershipTransfer as jest.MockedFunction<typeof executeMembershipTransfer>
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
        buildEmbedImpl.mockImplementation(async (shortName) => {
            if (shortName === 'B') {
                return { success: false, errorMessage: 'Bedrock timeout' }
            }
            return { success: true, embedding: makeTestEmbedding() }
        })
        spawnImpl.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))
        applyMembershipImpl.mockResolvedValue({
            ok: true,
            froms: [],
            to: ROOM_ID,
            changed: true,
        })

        const realSpawnOne = (row: Parameters<typeof spawnOneImprovisationObject>[0], innerDeps: Parameters<typeof spawnOneImprovisationObject>[1]) =>
            spawnOneImprovisationObject(row, {
                ...innerDeps,
                buildEmbedImpl,
                spawnImpl,
                applyMembershipImpl,
            })

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const result = await spawnImprovisationObjectsBatch([
            { objectId: 'OBJECT#a' as EphemeraObjectId, shortName: 'A', stableKey: 'a', targetRoomId: ROOM_ID },
            { objectId: 'OBJECT#b' as EphemeraObjectId, shortName: 'B', stableKey: 'b', targetRoomId: ROOM_ID },
        ], { messageBus: messageBus as any, streamEvent, spawnOneImpl: realSpawnOne })

        expect(result).toEqual({
            createdIds: ['OBJECT#a', 'OBJECT#b'],
            addFailures: [],
        })
        expect(spawnImpl).toHaveBeenCalledTimes(2)
        expect(spawnImpl.mock.calls[0][0]).toMatchObject({ embedding: expect.any(SemanticEmbedding) })
        expect(spawnImpl.mock.calls[1][0]).not.toHaveProperty('embedding')
        expect(consoleSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] shortName embed failed; spawning without embedding',
            expect.objectContaining({
                objectId: 'OBJECT#b',
                shortName: 'B',
                errorMessage: 'Bedrock timeout',
            })
        )
        consoleSpy.mockRestore()
    })
})
