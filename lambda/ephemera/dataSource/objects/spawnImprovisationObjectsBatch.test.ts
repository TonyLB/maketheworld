jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        AffordanceRoomDeliverable: { invalidate: jest.fn() },
        Positions: { set: jest.fn(), setMembershipContainers: jest.fn() },
        ImprovisationComponentData: { set: jest.fn(), invalidate: jest.fn() },
        ObjectEphemeraMeta: { set: jest.fn(), invalidate: jest.fn() },
        ObjectEmbedding: { set: jest.fn(), invalidate: jest.fn() },
    },
}))

import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SemanticEmbedding,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import internalCache from '../../internalCache'
import { executeComponentCreation } from '../positions/manipulation/membership/executeComponentCreation'
import { parentRemainderKey, presenceBindingNode, testLudicGraph } from '../positions/ludicGraph/testFixtures'
import type { BuildShortNameSemanticEmbeddingResult } from './embedding/buildShortNameSemanticEmbedding'
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

const META = { EphemeraId: OBJECT_ID, DataCategory: 'Meta::Object', stableKey: 'skates' }
const PAIR_ITEM = { Put: { EphemeraId: OBJECT_ID, DataCategory: 'ASSET#IMPROVISATION', tag: 'Object', shortName: 'Skates' } }

const makeTestEmbedding = () => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
}

const embedFailure = (): BuildShortNameSemanticEmbeddingResult => ({
    success: false,
    errorMessage: 'embed skipped in test',
})

/**
 * A `transactWrite` standing in for the database: runs the `MultiKeyUpdate` reducer over the room's
 * stored graph, then the wrapper's `cascade`, and records everything the one call would write.
 */
const makeRoomTransactWrite = (roomGraph = testLudicGraph(ROOM_ID, { nodes: [presenceBindingNode(parentRemainderKey(ROOM_ID))] })) => {
    const written: any[] = []
    const transactWrite: any = jest.fn(async (items: any[]) => {
        const multiKeyItem = items.find((item) => 'MultiKeyUpdate' in item).MultiKeyUpdate
        const draft: Record<string, any> = {}
        multiKeyItem.Keys.forEach((key: { EphemeraId: string; DataCategory: string }) => {
            draft[`${key.EphemeraId}#${key.DataCategory}`] = { ...key, ludicGraph: roomGraph.toStored() }
        })
        const prior = structuredClone(draft)
        multiKeyItem.reducer(draft)
        written.push(
            ...Object.values(draft).map((row) => ({ Update: row })),
            ...(multiKeyItem.cascade?.(prior, draft) ?? []),
            ...items.filter((item) => !('MultiKeyUpdate' in item)),
        )
    })
    return { transactWrite, written }
}

describe('spawnOneImprovisationObject', () => {
    const createImpl = jest.fn<ReturnType<typeof executeComponentCreation>, Parameters<typeof executeComponentCreation>>()
    const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
    const messageBus = { publish: jest.fn() }
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    const spawnDeps = () => ({
        messageBus: messageBus as any,
        streamEvent,
        buildEmbedImpl,
        createImpl,
    })

    beforeEach(() => {
        jest.clearAllMocks()
        buildEmbedImpl.mockResolvedValue(embedFailure())
        createImpl.mockResolvedValue({ ok: true, beatAnchorTime: 1 })
    })

    it('creates and places in one call: meta, target and the pair row as an existence item', async () => {
        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
        expect(buildEmbedImpl).toHaveBeenCalledWith('Skates')
        expect(createImpl).toHaveBeenCalledTimes(1)
        expect(createImpl).toHaveBeenCalledWith(expect.objectContaining({
            objectId: OBJECT_ID,
            meta: META,
            target: ROOM_ID,
            existenceItems: [PAIR_ITEM],
            messageBus,
            streamEvent,
        }))
    })

    it('adds the embedding row to the same commit when embed succeeds', async () => {
        const embedding = makeTestEmbedding()
        buildEmbedImpl.mockResolvedValue({ success: true, embedding })

        await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(createImpl.mock.calls[0][0].existenceItems).toEqual([
            PAIR_ITEM,
            { Put: { EphemeraId: OBJECT_ID, DataCategory: 'EMBEDDING#IMPROMPTU', embedding: embedding.toDynamoRecord() } },
        ])
    })

    it('writes situations and gloss onto the pair row', async () => {
        const situations = [{ reference: 'SITUATION#DEFAULT', payload: { prose: 'Gleaming.' } }] as any

        await spawnOneImprovisationObject({ ...spawnRow, situations, gloss: 'a pair of rocket skates' }, spawnDeps())

        expect(createImpl.mock.calls[0][0].existenceItems).toEqual([
            { Put: { ...PAIR_ITEM.Put, situations, gloss: 'a pair of rocket skates' } },
        ])
    })

    it('seeds the object caches only once the commit has persisted', async () => {
        await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(internalCache.ObjectEphemeraMeta.set).not.toHaveBeenCalled()
        createImpl.mock.calls[0][0].afterPersist!()
        expect(internalCache.ObjectEphemeraMeta.set).toHaveBeenCalledWith(OBJECT_ID, META)
        expect(internalCache.ImprovisationComponentData.set).toHaveBeenCalledTimes(1)
        expect(internalCache.ObjectEmbedding.invalidate).toHaveBeenCalledWith(OBJECT_ID)
        expect(internalCache.AffordanceRoomDeliverable.invalidate).toHaveBeenCalledWith(ROOM_ID)
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
        expect(createImpl.mock.calls[0][0].existenceItems).toEqual([PAIR_ITEM])
        consoleSpy.mockRestore()
    })

    it('a failed commit fails the spawn, with no compensating write', async () => {
        createImpl.mockResolvedValue({ ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: 'placement failed' })

        const result = await spawnOneImprovisationObject(spawnRow, spawnDeps())

        expect(result).toEqual({ ok: false, errorMessage: 'placement failed' })
        expect(createImpl).toHaveBeenCalledTimes(1)
    })

    describe('through the real kernel commit', () => {
        it('spawn is one transaction: the Object is born bound under the room\'s remainder, beside its existence rows', async () => {
            const { transactWrite, written } = makeRoomTransactWrite()

            const result = await spawnOneImprovisationObject(spawnRow, {
                ...spawnDeps(),
                createImpl: (args) => executeComponentCreation({ ...args, transactWrite }),
            })

            expect(result).toEqual({ ok: true, objectId: OBJECT_ID })
            expect(transactWrite).toHaveBeenCalledTimes(1)
            const metaPut = written.find((item) => item.Put?.DataCategory === 'Meta::Object')
            const presenceNodes = metaPut.Put.ludicGraph.nodes.filter((node: { tag: string }) => node.tag === 'Presence')
            expect(presenceNodes).toHaveLength(1)
            expect(presenceNodes[0].fromHostPresence).toEqual({ host: ROOM_ID, presence: parentRemainderKey(ROOM_ID) })
            expect(written).toEqual(expect.arrayContaining([PAIR_ITEM]))
        })

        it('a placement the commit refuses writes no Meta::Object row and seeds no cache', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
            // the Object is already a node of the room, so its placement is stale at commit time
            const { transactWrite, written } = makeRoomTransactWrite(
                testLudicGraph(ROOM_ID, { nodes: [{ tag: 'Object', universalKey: OBJECT_ID }] })
            )

            const result = await spawnOneImprovisationObject(spawnRow, {
                ...spawnDeps(),
                createImpl: (args) => executeComponentCreation({ ...args, transactWrite }),
            })

            expect(result.ok).toBe(false)
            expect(written.some((item) => item.Put?.DataCategory === 'Meta::Object')).toBe(false)
            expect(internalCache.ObjectEphemeraMeta.set).not.toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
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
        const createImpl = jest.fn<ReturnType<typeof executeComponentCreation>, Parameters<typeof executeComponentCreation>>()
            .mockResolvedValue({ ok: true, beatAnchorTime: 1 })
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
        buildEmbedImpl.mockImplementation(async (shortName) => {
            if (shortName === 'B') {
                return { success: false, errorMessage: 'Bedrock timeout' }
            }
            return { success: true, embedding: makeTestEmbedding() }
        })

        const realSpawnOne = (row: Parameters<typeof spawnOneImprovisationObject>[0], innerDeps: Parameters<typeof spawnOneImprovisationObject>[1]) =>
            spawnOneImprovisationObject(row, {
                ...innerDeps,
                buildEmbedImpl,
                createImpl,
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
        expect(createImpl).toHaveBeenCalledTimes(2)
        expect(createImpl.mock.calls[0][0].existenceItems).toHaveLength(2)
        expect(createImpl.mock.calls[1][0].existenceItems).toHaveLength(1)
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
