jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

const queryAllRenderCacheDataCategoriesForComponentMock = jest.fn(async (_componentId: string) => [] as string[])
jest.mock('../renderCache/queryAllRenderCacheDataCategoriesForComponent', () => ({
    queryAllRenderCacheDataCategoriesForComponent: (componentId: string) =>
        queryAllRenderCacheDataCategoriesForComponentMock(componentId),
}))

const messageBusPublishMock = jest.fn()
jest.mock('../../messageBus', () => ({
    __esModule: true,
    default: {
        publish: (...args: unknown[]) => messageBusPublishMock(...args),
    },
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

import { glossFromComponent } from './objectShortName'
import {
    improvisationPairComponent,
    improvisationPairPutItem,
    persistDeleteImprovisationObject,
} from './persistImprovisationObject'

const transactWriteMock = ephemeraDB.transactWrite as jest.Mock

describe('persistImprovisationObject', () => {
    const objectId = 'OBJECT#Anvil' as const
    const roomId = 'ROOM#VORTEX' as const

    beforeEach(() => {
        jest.clearAllMocks()
        transactWriteMock.mockResolvedValue(undefined)
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
        expect(affordanceInvalidateMock).toHaveBeenCalledWith(roomId)
        // These rows touch no `Meta::Room` and no graph: the room's graph memo (just seeded by
        // the placement/removal commit) and its meta row stay valid.
        expect(componentEphemeraMetaInvalidateMock).not.toHaveBeenCalled()
        expect(positionsInvalidateMock).not.toHaveBeenCalled()
    })

    it('persistDeleteImprovisationObject dispatches Delete Cache Records when the object has render-cache rows', async () => {
        queryAllRenderCacheDataCategoriesForComponentMock.mockResolvedValueOnce([
            'CACHE#one',
            'Cache::perspective-key',
        ])

        const result = await persistDeleteImprovisationObject({ objectId, affectedRoomIds: [roomId] })

        expect(result).toEqual({ ok: true, objectId })
        expect(queryAllRenderCacheDataCategoriesForComponentMock).toHaveBeenCalledWith(objectId)
        expect(messageBusPublishMock).toHaveBeenCalledTimes(1)
        const published = messageBusPublishMock.mock.calls[0][0]
        expect(published.header.type).toBe('Delete Cache Records')
        await expect(published.getContent()).resolves.toMatchObject({
            componentId: objectId,
            dataCategories: ['CACHE#one', 'Cache::perspective-key'],
        })
    })

    it('persistDeleteImprovisationObject does not dispatch Delete Cache Records when the object has no render-cache rows', async () => {
        const result = await persistDeleteImprovisationObject({ objectId, affectedRoomIds: [roomId] })

        expect(result).toEqual({ ok: true, objectId })
        expect(messageBusPublishMock).not.toHaveBeenCalled()
    })

    it('persistDeleteImprovisationObject still succeeds when render-cache cleanup fails', async () => {
        queryAllRenderCacheDataCategoriesForComponentMock.mockRejectedValueOnce(new Error('dynamo unavailable'))

        const result = await persistDeleteImprovisationObject({ objectId, affectedRoomIds: [roomId] })

        expect(result).toEqual({ ok: true, objectId })
        expect(messageBusPublishMock).not.toHaveBeenCalled()
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

})

describe('improvisation pair builders', () => {
    const objectId = 'OBJECT#Anvil' as const

    it('write situations and gloss to the pair row and to the cache-seeded StandardObject', () => {
        const situations = [{
            reference: 'SITUATION#DEFAULT' as const,
            payload: { displayName: 'a heavy anvil', description: ['A cast-iron anvil sits here.'] },
        }]
        const fields = { objectId, shortName: 'Anvil', situations, gloss: 'a squat cast-iron anvil, chipped along one edge' }

        expect(improvisationPairPutItem(fields)).toEqual({
            Put: {
                EphemeraId: objectId,
                DataCategory: 'ASSET#IMPROVISATION',
                tag: 'Object',
                shortName: 'Anvil',
                situations,
                gloss: 'a squat cast-iron anvil, chipped along one edge',
            },
        })
        const component = improvisationPairComponent(fields)
        expect(component.situations.toJSON()).toEqual(situations)
        expect(glossFromComponent(component)).toBe('a squat cast-iron anvil, chipped along one edge')
    })

    it('omit empty situations and gloss', () => {
        expect(improvisationPairPutItem({ objectId, shortName: 'Anvil', situations: [], gloss: '' })).toEqual({
            Put: { EphemeraId: objectId, DataCategory: 'ASSET#IMPROVISATION', tag: 'Object', shortName: 'Anvil' },
        })
    })
})
