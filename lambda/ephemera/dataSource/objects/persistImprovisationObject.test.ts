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
    destroyImprovisedObject,
} from './persistImprovisationObject'

const transactWriteMock = ephemeraDB.transactWrite as jest.Mock

describe('persistImprovisationObject', () => {
    const objectId = 'OBJECT#Anvil' as const
    const roomId = 'ROOM#VORTEX' as const

    beforeEach(() => {
        jest.clearAllMocks()
        transactWriteMock.mockResolvedValue(undefined)
    })

    const executeDestruction = jest.fn()
    // no messageBus override: the module's mocked bus is what the render-cache cleanup publishes to
    const destroyDeps = { positionsStreamEvent: jest.fn(), executeDestruction }

    it('destroyImprovisedObject commits once, with the pair and embedding rows as existenceItems and Meta::Object left to the kernel', async () => {
        executeDestruction.mockResolvedValue({ ok: true, froms: [roomId], beatAnchorTime: 1 })

        const result = await destroyImprovisedObject({ objectId, affectedRoomIds: [roomId] }, destroyDeps)

        expect(result).toEqual({ ok: true, objectId, froms: [roomId] })
        expect(executeDestruction).toHaveBeenCalledTimes(1)
        expect(executeDestruction).toHaveBeenCalledWith(expect.objectContaining({
            objectId,
            existenceItems: [
                { Delete: { EphemeraId: objectId, DataCategory: 'ASSET#IMPROVISATION' } },
                { Delete: { EphemeraId: objectId, DataCategory: 'EMBEDDING#IMPROMPTU' } },
            ],
        }))
        // no write outside the kernel
        expect(transactWriteMock).not.toHaveBeenCalled()
    })

    it('destroyImprovisedObject invalidates caches only once the commit has persisted, for the caller\'s rooms and the rooms it left', async () => {
        const otherRoomId = 'ROOM#CAFE' as const
        executeDestruction.mockImplementation(async (args: any) => {
            expect(improvisationInvalidateMock).not.toHaveBeenCalled()
            args.afterPersist([otherRoomId, 'CHARACTER#Alpha'])
            return { ok: true, froms: [otherRoomId], beatAnchorTime: 1 }
        })

        await destroyImprovisedObject({ objectId, affectedRoomIds: [roomId] }, destroyDeps)

        expect(improvisationInvalidateMock).toHaveBeenCalledWith(objectId, 'ASSET#IMPROVISATION')
        expect(objectMetaInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(objectEmbeddingInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(affordanceInvalidateMock).toHaveBeenCalledWith(roomId)
        expect(affordanceInvalidateMock).toHaveBeenCalledWith(otherRoomId)
        expect(affordanceInvalidateMock).toHaveBeenCalledTimes(2)
        expect(componentEphemeraMetaInvalidateMock).not.toHaveBeenCalled()
    })

    it('destroyImprovisedObject passes a failed commit through and cleans up nothing', async () => {
        executeDestruction.mockResolvedValue({ ok: false, errorMessage: 'stale' })

        const result = await destroyImprovisedObject({ objectId }, destroyDeps)

        expect(result).toEqual({ ok: false, errorMessage: 'stale' })
        expect(queryAllRenderCacheDataCategoriesForComponentMock).not.toHaveBeenCalled()
        expect(messageBusPublishMock).not.toHaveBeenCalled()
    })

    it('destroyImprovisedObject dispatches Delete Cache Records when the object has render-cache rows', async () => {
        executeDestruction.mockResolvedValue({ ok: true, froms: [roomId], beatAnchorTime: 1 })
        queryAllRenderCacheDataCategoriesForComponentMock.mockResolvedValueOnce([
            'CACHE#one',
            'Cache::perspective-key',
        ])

        const result = await destroyImprovisedObject({ objectId, affectedRoomIds: [roomId] }, destroyDeps)

        expect(result).toEqual({ ok: true, objectId, froms: [roomId] })
        expect(queryAllRenderCacheDataCategoriesForComponentMock).toHaveBeenCalledWith(objectId)
        expect(messageBusPublishMock).toHaveBeenCalledTimes(1)
        const published = messageBusPublishMock.mock.calls[0][0]
        expect(published.header.type).toBe('Delete Cache Records')
        await expect(published.getContent()).resolves.toMatchObject({
            componentId: objectId,
            dataCategories: ['CACHE#one', 'Cache::perspective-key'],
        })
    })

    it('destroyImprovisedObject does not dispatch Delete Cache Records when the object has no render-cache rows', async () => {
        executeDestruction.mockResolvedValue({ ok: true, froms: [], beatAnchorTime: 1 })

        const result = await destroyImprovisedObject({ objectId, affectedRoomIds: [roomId] }, destroyDeps)

        expect(result).toEqual({ ok: true, objectId, froms: [] })
        expect(messageBusPublishMock).not.toHaveBeenCalled()
    })

    it('destroyImprovisedObject still succeeds when render-cache cleanup fails', async () => {
        executeDestruction.mockResolvedValue({ ok: true, froms: [], beatAnchorTime: 1 })
        queryAllRenderCacheDataCategoriesForComponentMock.mockRejectedValueOnce(new Error('dynamo unavailable'))

        const result = await destroyImprovisedObject({ objectId, affectedRoomIds: [roomId] }, destroyDeps)

        expect(result).toEqual({ ok: true, objectId, froms: [] })
        expect(messageBusPublishMock).not.toHaveBeenCalled()
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
