jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

const improvisationSetMock = jest.fn()
const improvisationInvalidateMock = jest.fn()
const objectMetaSetMock = jest.fn()
const objectMetaInvalidateMock = jest.fn()
const objectMetaGetMock = jest.fn()
const objectEmbeddingSetMock = jest.fn()
const objectEmbeddingInvalidateMock = jest.fn()
const objectEmbeddingGetMock = jest.fn()
const affordanceInvalidateMock = jest.fn()
const componentEphemeraMetaInvalidateMock = jest.fn()
const positionsInvalidateMock = jest.fn()

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ImprovisationComponentData: {
            set: (...args: unknown[]) => improvisationSetMock(...args),
            invalidate: (...args: unknown[]) => improvisationInvalidateMock(...args),
            get: jest.fn(),
        },
        ObjectEphemeraMeta: {
            set: (...args: unknown[]) => objectMetaSetMock(...args),
            invalidate: (...args: unknown[]) => objectMetaInvalidateMock(...args),
            get: (...args: unknown[]) => objectMetaGetMock(...args),
        },
        ObjectEmbedding: {
            set: (...args: unknown[]) => objectEmbeddingSetMock(...args),
            invalidate: (...args: unknown[]) => objectEmbeddingInvalidateMock(...args),
            get: (...args: unknown[]) => objectEmbeddingGetMock(...args),
        },
        AffordanceRoomDeliverable: {
            invalidate: (...args: unknown[]) => affordanceInvalidateMock(...args),
        },
        CoyoteGame: {
            get: jest.fn(),
        },
        ComponentEphemeraMeta: {
            get: jest.fn(),
            invalidate: (...args: unknown[]) => componentEphemeraMetaInvalidateMock(...args),
        },
        Positions: {
            invalidate: (...args: unknown[]) => positionsInvalidateMock(...args),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import type { EphemeraObjectEmbedding } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import { EMBEDDING_IMPROMPTU_DATA_CATEGORY } from '@tonylb/mtw-interfaces/ts/ephemeraEmbedding'
import {
    SemanticEmbedding,
    SEMANTIC_EMBEDDING_V1_DIMENSIONS,
    SEMANTIC_EMBEDDING_V1_ENCODING,
} from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import type { BuildShortNameSemanticEmbeddingResult } from './embedding/buildShortNameSemanticEmbedding'
import { hashShortNameForEmbedding } from './embedding/impromptuEmbeddingNeedsRefresh'
import {
    persistClearCoyoteGameImprovisationObjects,
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
    persistUpdateImprovisationObject,
} from './persistImprovisationObject'

const transactWriteMock = ephemeraDB.transactWrite as jest.Mock

const TEST_MODEL_ID = 'amazon.titan-embed-text-v2:0'

const makeTestEmbedding = (): SemanticEmbedding => {
    const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
    values[0] = 1
    return SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })
}

const makeEmbeddingRow = (
    shortName: string,
    overrides: Partial<EphemeraObjectEmbedding['embedding']> = {}
): EphemeraObjectEmbedding => ({
    EphemeraId: 'OBJECT#Anvil',
    DataCategory: EMBEDDING_IMPROMPTU_DATA_CATEGORY,
    embedding: {
        modelId: TEST_MODEL_ID,
        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
        encoding: SEMANTIC_EMBEDDING_V1_ENCODING,
        vector: new Uint8Array(SEMANTIC_EMBEDDING_V1_DIMENSIONS),
        sourceTextHash: hashShortNameForEmbedding(shortName.toLowerCase()),
        ...overrides,
    },
})

const defaultUpdateDeps = (priorComponent: StandardObject) => ({
    getMetaObject: async () => ({
        EphemeraId: 'OBJECT#Anvil' as const,
        DataCategory: 'Meta::Object' as const,
        stableKey: 'anvil',
    }),
    getImprovisationPair: async () => priorComponent,
})

describe('persistImprovisationObject', () => {
    const objectId = 'OBJECT#Anvil' as const
    const roomId = 'ROOM#VORTEX' as const

    beforeEach(() => {
        jest.clearAllMocks()
        transactWriteMock.mockResolvedValue(undefined)
    })

    it('persistSpawnImprovisationObject writes pair + Meta::Object in one transact', async () => {
        const result = await persistSpawnImprovisationObject({
            objectId,
            shortName: 'Anvil',
            stableKey: 'anvil',
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'Anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
        ])
        expect(improvisationSetMock).toHaveBeenCalled()
        expect(objectMetaSetMock).toHaveBeenCalledWith(objectId, expect.objectContaining({ stableKey: 'anvil' }))
        expect(objectEmbeddingInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(objectEmbeddingSetMock).not.toHaveBeenCalled()
    })

    it('persistSpawnImprovisationObject writes pair + Meta::Object + EMBEDDING#IMPROMPTU when embedding present', async () => {
        const values = Array.from({ length: SEMANTIC_EMBEDDING_V1_DIMENSIONS }, () => 0)
        values[0] = 1
        const embedding = SemanticEmbedding.fromFloat32(values, { modelId: TEST_MODEL_ID })

        const result = await persistSpawnImprovisationObject({
            objectId,
            shortName: 'Anvil',
            stableKey: 'anvil',
            embedding,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'Anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'EMBEDDING#IMPROMPTU',
                    embedding: expect.objectContaining({
                        modelId: TEST_MODEL_ID,
                        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
                        vector: expect.any(Uint8Array),
                    }),
                },
            },
        ])
        expect(transactWriteMock.mock.calls[0][0][2].Put.embedding.vector.byteLength)
            .toBe(SEMANTIC_EMBEDDING_V1_DIMENSIONS)
        expect(objectEmbeddingSetMock).toHaveBeenCalledWith(objectId, embedding)
        expect(objectEmbeddingInvalidateMock).not.toHaveBeenCalled()
    })

    it('persistSpawnImprovisationObject writes situations to the pair row and the cache-seeded StandardObject', async () => {
        const situations = [{
            reference: 'SITUATION#DEFAULT' as const,
            payload: { displayName: 'a heavy anvil', description: ['A cast-iron anvil sits here.'] },
        }]

        const result = await persistSpawnImprovisationObject({
            objectId,
            shortName: 'Anvil',
            stableKey: 'anvil',
            situations,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'Anvil',
                    situations,
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
        ])
        const cachedComponent = improvisationSetMock.mock.calls[0][2] as StandardObject
        expect(cachedComponent.situations.toJSON()).toEqual(situations)
    })

    it('persistDeleteImprovisationObject deletes pair, Meta::Object, and EMBEDDING#IMPROMPTU rows', async () => {
        const result = await persistDeleteImprovisationObject({ objectId, affectedRoomIds: [roomId] })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            { Delete: { EphemeraId: objectId, DataCategory: 'ASSET#IMPROVISATION' } },
            { Delete: { EphemeraId: objectId, DataCategory: 'Meta::Object' } },
            { Delete: { EphemeraId: objectId, DataCategory: 'EMBEDDING#IMPROMPTU' } },
        ])
        expect(improvisationInvalidateMock).toHaveBeenCalledWith(objectId, 'ASSET#IMPROVISATION')
        expect(objectMetaInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(objectEmbeddingInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(componentEphemeraMetaInvalidateMock).toHaveBeenCalledWith(roomId)
        expect(affordanceInvalidateMock).toHaveBeenCalledWith(roomId)
        expect(positionsInvalidateMock).toHaveBeenCalledWith(roomId)
    })

    it('persistDeleteImprovisationObject returns ok when rows are already absent', async () => {
        const result = await persistDeleteImprovisationObject({ objectId })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            { Delete: { EphemeraId: objectId, DataCategory: 'ASSET#IMPROVISATION' } },
            { Delete: { EphemeraId: objectId, DataCategory: 'Meta::Object' } },
            { Delete: { EphemeraId: objectId, DataCategory: 'EMBEDDING#IMPROMPTU' } },
        ])
    })

    it('persistUpdateImprovisationObject merges prior rows and re-embeds on shortName change', async () => {
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Old' })
        const embedding = makeTestEmbedding()
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
            .mockResolvedValue({ success: true, embedding })
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(makeEmbeddingRow('old'))

        const result = await persistUpdateImprovisationObject({
            objectId,
            shortName: 'New',
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(buildEmbedImpl).toHaveBeenCalledWith('New')
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'New',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'EMBEDDING#IMPROMPTU',
                    embedding: expect.objectContaining({
                        modelId: TEST_MODEL_ID,
                        dimensions: SEMANTIC_EMBEDDING_V1_DIMENSIONS,
                        vector: expect.any(Uint8Array),
                    }),
                },
            },
        ])
        expect(objectEmbeddingSetMock).toHaveBeenCalledWith(objectId, embedding)
    })

    it('persistUpdateImprovisationObject preserves prior situations when not explicitly overridden', async () => {
        const situations = [{
            reference: 'SITUATION#DEFAULT' as const,
            payload: { displayName: 'a heavy anvil', description: ['A cast-iron anvil sits here.'] },
        }]
        const priorComponent = new StandardObject({
            tag: 'Object',
            universalKey: objectId,
            shortName: 'Anvil',
            situations,
        })
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(makeEmbeddingRow('anvil'))

        const result = await persistUpdateImprovisationObject({
            objectId,
            tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'forge' }],
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            expect.objectContaining({
                Put: expect.objectContaining({
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    shortName: 'Anvil',
                    situations,
                }),
            }),
            expect.anything(),
        ])
        const cachedComponent = improvisationSetMock.mock.calls[0][2] as StandardObject
        expect(cachedComponent.situations.toJSON()).toEqual(situations)
    })

    it('persistUpdateImprovisationObject overwrites situations when explicitly provided', async () => {
        const priorSituations = [{
            reference: 'SITUATION#DEFAULT' as const,
            payload: { description: ['Old prose.'] },
        }]
        const nextSituations = [{
            reference: 'SITUATION#DEFAULT' as const,
            payload: { description: ['New prose.'] },
        }]
        const priorComponent = new StandardObject({
            tag: 'Object',
            universalKey: objectId,
            shortName: 'Anvil',
            situations: priorSituations,
        })
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(makeEmbeddingRow('anvil'))

        const result = await persistUpdateImprovisationObject({
            objectId,
            situations: nextSituations,
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            expect.objectContaining({
                Put: expect.objectContaining({ situations: nextSituations }),
            }),
            expect.anything(),
        ])
    })

    it('persistUpdateImprovisationObject skips embed when hash matches on trope-only update', async () => {
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Anvil' })
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(makeEmbeddingRow('anvil'))

        const result = await persistUpdateImprovisationObject({
            objectId,
            tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'forge' }],
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(buildEmbedImpl).not.toHaveBeenCalled()
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'Anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                    tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'forge' }],
                },
            },
        ])
        expect(objectEmbeddingSetMock).not.toHaveBeenCalled()
        expect(objectEmbeddingInvalidateMock).not.toHaveBeenCalled()
    })

    it('persistUpdateImprovisationObject backfills embedding when row absent on trope-only update', async () => {
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Anvil' })
        const embedding = makeTestEmbedding()
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
            .mockResolvedValue({ success: true, embedding })
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(undefined)

        const result = await persistUpdateImprovisationObject({
            objectId,
            tropeAffinitiesFailed: true,
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(buildEmbedImpl).toHaveBeenCalledWith('Anvil')
        expect(transactWriteMock.mock.calls[0][0]).toHaveLength(3)
        expect(objectEmbeddingSetMock).toHaveBeenCalledWith(objectId, embedding)
    })

    it('persistUpdateImprovisationObject proceeds without embedding when embed fails', async () => {
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Anvil' })
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
            .mockResolvedValue({ success: false, errorMessage: 'ThrottlingException' })
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(undefined)
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const result = await persistUpdateImprovisationObject({
            objectId,
            shortName: 'New',
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock.mock.calls[0][0]).toHaveLength(2)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[mtw.ephemera.objects] shortName embed failed; updating without embedding',
            expect.objectContaining({
                objectId,
                shortName: 'New',
                errorMessage: 'ThrottlingException',
            })
        )
        expect(objectEmbeddingInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(objectEmbeddingSetMock).not.toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
    })

    it('persistUpdateImprovisationObject re-embeds when sourceTextHash is missing on prior row', async () => {
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Anvil' })
        const embedding = makeTestEmbedding()
        const buildEmbedImpl = jest.fn<Promise<BuildShortNameSemanticEmbeddingResult>, [string]>()
            .mockResolvedValue({ success: true, embedding })
        const getImprovisationEmbedding = jest.fn().mockResolvedValue(
            makeEmbeddingRow('anvil', { sourceTextHash: undefined })
        )

        const result = await persistUpdateImprovisationObject({
            objectId,
        }, {
            ...defaultUpdateDeps(priorComponent),
            getImprovisationEmbedding,
            buildEmbedImpl,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(buildEmbedImpl).toHaveBeenCalledWith('Anvil')
        expect(transactWriteMock.mock.calls[0][0]).toHaveLength(3)
    })

    it('persistClearCoyoteGameImprovisationObjects deletes objects from game room graphs only', async () => {
        const objectTwo = 'OBJECT#Boulder' as const

        const result = await persistClearCoyoteGameImprovisationObjects({
            getGameRooms: async () => ['VORTEX', 'CORNER'],
            getRoomPositionGraph: async (room) => {
                if (room === 'ROOM#VORTEX') {
                    return {
                        EphemeraId: room,
                        DataCategory: 'Meta::Room',
                        positionGraph: {
                            nodes: [{ tag: 'Object', universalKey: objectId }],
                        },
                    }
                }
                if (room === 'ROOM#CORNER') {
                    return {
                        EphemeraId: room,
                        DataCategory: 'Meta::Room',
                        positionGraph: {
                            nodes: [{ tag: 'Object', universalKey: objectTwo }],
                        },
                    }
                }
                return undefined
            },
        })

        expect(result).toEqual({
            ok: true,
            deletedObjectIds: [objectId, objectTwo],
            affectedRoomIds: ['ROOM#VORTEX', 'ROOM#CORNER'],
        })
        expect(transactWriteMock).toHaveBeenCalledTimes(1)
        expect(transactWriteMock.mock.calls[0][0]).toHaveLength(6)
        expect(improvisationInvalidateMock).toHaveBeenCalledTimes(2)
    })

    it('persistClearCoyoteGameImprovisationObjects is a no-op when graphs have no Object nodes', async () => {
        const result = await persistClearCoyoteGameImprovisationObjects({
            getGameRooms: async () => ['VORTEX'],
            getRoomPositionGraph: async (room) => ({
                EphemeraId: room,
                DataCategory: 'Meta::Room',
                positionGraph: { nodes: [{ tag: 'Character', universalKey: 'CHARACTER#X' }] },
            }),
        })

        expect(result).toEqual({
            ok: true,
            deletedObjectIds: [],
            affectedRoomIds: ['ROOM#VORTEX'],
        })
        expect(transactWriteMock).not.toHaveBeenCalled()
    })
})
